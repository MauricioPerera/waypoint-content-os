import framework from "../dist/server/index.js";

interface Env {
  DB: D1Database;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
}

type Framework = (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>;
type AuthUser = { id: string; name: string; email: string; role: string };
const app = framework as unknown as Framework;
const SESSION_COOKIE = "waypoint_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function apiHeaders(request?: Request) {
  const origin = request?.headers.get("Origin");
  return {
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  };
}

function json(data: unknown, status = 200, request?: Request, extra: HeadersInit = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...apiHeaders(request), ...extra } });
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function base64Url(value: string) {
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomToken(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return base64Url(bytesToBase64(bytes));
}

async function digest(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64Url(bytesToBase64(new Uint8Array(hash)));
}

async function passwordHash(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: salt as BufferSource, iterations: 100_000, hash: "SHA-256" }, key, 256);
  return base64Url(bytesToBase64(new Uint8Array(bits)));
}

function parseCookies(request: Request) {
  return Object.fromEntries(
    (request.headers.get("Cookie") || "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key, value]) => key && value)
      .map(([key, ...value]) => [key, value.join("=")]),
  );
}

function sessionCookie(token: string, maxAge = SESSION_TTL_SECONDS) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

async function currentUser(request: Request, env: Env): Promise<AuthUser | null> {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = await digest(token);
  const row = await env.DB.prepare(`SELECT u.id, u.name, u.email, u.role, s.expires_at FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id WHERE s.token_hash = ?1`)
    .bind(tokenHash).first<AuthUser & { expires_at: string }>();
  if (!row || Date.parse(row.expires_at) <= Date.now()) {
    if (row) await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ?1").bind(tokenHash).run();
    return null;
  }
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

async function createSession(env: Env, userId: string) {
  const token = randomToken();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString();
  await env.DB.prepare("INSERT INTO auth_sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5)")
    .bind(randomToken(16), userId, await digest(token), expires, now.toISOString()).run();
  return token;
}

async function sendEmail(env: Env, to: string, subject: string, html: string) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) return;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to: [to], subject, html }),
  });
  if (!response.ok) console.error("resend_email_failed", response.status);
}

async function auth(request: Request, env: Env, ctx: ExecutionContext, action: string) {
  if (request.method === "OPTIONS") return new Response(null, { headers: apiHeaders(request) });
  if (action === "status" && request.method === "GET") {
    const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM auth_users").first<{ count: number }>();
    return json({ setupRequired: !row?.count }, 200, request);
  }
  if (action === "me" && request.method === "GET") {
    const user = await currentUser(request, env);
    return user ? json({ user }, 200, request) : json({ error: "Unauthorized" }, 401, request);
  }
  if (action === "logout" && request.method === "POST") {
    const token = parseCookies(request)[SESSION_COOKIE];
    if (token) await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ?1").bind(await digest(token)).run();
    return json({ status: "logged_out" }, 200, request, { "Set-Cookie": sessionCookie("", 0) });
  }
  if ((action !== "login" && action !== "register") || request.method !== "POST") return json({ error: "Method not allowed" }, 405, request);
  let body: { name?: string; email?: string; password?: string };
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400, request); }
  const email = body.email?.trim().toLowerCase() || "";
  const password = body.password || "";
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 12) return json({ error: "Email inválido o contraseña demasiado corta (mínimo 12 caracteres)" }, 400, request);
  const existing = await env.DB.prepare("SELECT id, name, email, role, password_hash, password_salt FROM auth_users WHERE email = ?1").bind(email)
    .first<AuthUser & { password_hash: string; password_salt: string }>();
  if (action === "register") {
    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM auth_users").first<{ count: number }>();
    if (count?.count) return json({ error: "El registro inicial ya fue completado" }, 409, request);
    const name = body.name?.trim() || "";
    if (name.length < 2) return json({ error: "El nombre es obligatorio" }, 400, request);
    const salt = new Uint8Array(16); crypto.getRandomValues(salt);
    const user = { id: `usr_${randomToken(12)}`, name, email, role: "administrator" };
    await env.DB.prepare("INSERT INTO auth_users (id, name, email, role, password_hash, password_salt, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
      .bind(user.id, user.name, user.email, user.role, await passwordHash(password, salt), bytesToBase64(salt), new Date().toISOString()).run();
    const token = await createSession(env, user.id);
    ctx.waitUntil(sendEmail(env, email, "Tu espacio Waypoint está listo", `<p>Hola ${name}, tu espacio Waypoint ya está configurado.</p>`));
    return json({ user }, 201, request, { "Set-Cookie": sessionCookie(token) });
  }
  if (!existing || (await passwordHash(password, base64ToBytes(existing.password_salt))) !== existing.password_hash) return json({ error: "Credenciales inválidas" }, 401, request);
  const user = { id: existing.id, name: existing.name, email: existing.email, role: existing.role };
  return json({ user }, 200, request, { "Set-Cookie": sessionCookie(await createSession(env, user.id)) });
}

async function state(request: Request, env: Env) {
  if (request.method === "OPTIONS") return new Response(null, { headers: apiHeaders(request) });
  if (!await currentUser(request, env)) return json({ error: "Unauthorized" }, 401, request);
  if (request.method === "GET") {
    const row = await env.DB.prepare("SELECT data, updated_at FROM workspace_state WHERE id = ?1").bind("default").first<{ data: string; updated_at: string }>();
    return json({ state: row ? JSON.parse(row.data) : null, updatedAt: row?.updated_at || null }, 200, request);
  }
  if (request.method !== "PUT") return json({ error: "Method not allowed" }, 405, request);
  let data: unknown; try { data = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400, request); }
  const updatedAt = new Date().toISOString();
  await env.DB.prepare("INSERT INTO workspace_state (id, data, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at").bind("default", JSON.stringify(data), updatedAt).run();
  return json({ status: "saved", updatedAt }, 200, request);
}

async function registry(request: Request, env: Env, key: string) {
  if (request.method === "OPTIONS") return new Response(null, { headers: apiHeaders(request) });
  if (!await currentUser(request, env)) return json({ error: "Unauthorized" }, 401, request);
  const id = `registry:${key}`;
  if (request.method === "GET") {
    const row = await env.DB.prepare("SELECT data, updated_at FROM workspace_state WHERE id = ?1").bind(id).first<{ data: string; updated_at: string }>();
    return json({ data: row ? JSON.parse(row.data) : null, updatedAt: row?.updated_at || null }, 200, request);
  }
  if (request.method !== "PUT") return json({ error: "Method not allowed" }, 405, request);
  let data: unknown; try { data = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400, request); }
  const updatedAt = new Date().toISOString();
  await env.DB.prepare("INSERT INTO workspace_state (id, data, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at").bind(id, JSON.stringify(data), updatedAt).run();
  return json({ status: "saved", updatedAt }, 200, request);
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/api/auth/")) return auth(request, env, ctx, path.slice("/api/auth/".length));
    if (path === "/api/state") return state(request, env);
    if (path.startsWith("/api/registry/")) return registry(request, env, path.slice("/api/registry/".length));
    return app(request, env, ctx);
  },
};

export default worker;
