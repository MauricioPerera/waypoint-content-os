import framework from "../dist/server/index.js";

interface Env {
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
  ASSETS?: { fetch(request: Request): Promise<Response> };
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

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signWebhook(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(signature));
}

async function dispatchWebhook(request: Request, env: Env) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, request);
  if (!await currentUser(request, env)) return json({ error: "Unauthorized" }, 401, request);
  let body: { url?: string; event?: string; id?: string; payload?: unknown; secret?: string };
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400, request); }
  const rawUrl = body.url?.trim() || "";
  const event = body.event?.trim() || "";
  const secret = body.secret || "";
  if (!rawUrl || !event || !secret) return json({ error: "url, event y secret son obligatorios" }, 400, request);
  let target: URL;
  try { target = new URL(rawUrl); } catch { return json({ error: "URL de webhook inválida" }, 400, request); }
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password)
    return json({ error: "El webhook solo admite URLs HTTP(S) sin credenciales embebidas" }, 400, request);
  const deliveryId = body.id?.trim() || `evt_${randomToken(12)}`;
  const document = { event, id: deliveryId, occurredAt: new Date().toISOString(), payload: body.payload ?? {} };
  const serialized = JSON.stringify(document);
  const signature = await signWebhook(serialized, secret);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(target.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Waypoint-Event": event,
        "X-Waypoint-Delivery": deliveryId,
        "X-Waypoint-Signature": `sha256=${signature}`,
      },
      body: serialized,
      signal: controller.signal,
    });
    const responseText = (await response.text()).slice(0, 2048);
    return json({
      status: response.ok ? "delivered" : "failed",
      deliveryId,
      event,
      targetStatus: response.status,
      response: responseText,
    }, response.ok ? 200 : 502, request);
  } catch (error) {
    return json({ status: "failed", deliveryId, error: error instanceof Error ? error.message : "Webhook delivery failed" }, 502, request);
  } finally {
    clearTimeout(timeout);
  }
}

async function issuePasswordReset(request: Request, env: Env, ctx: ExecutionContext, email: string) {
  const user = await env.DB.prepare("SELECT id, name, email FROM auth_users WHERE email = ?1").bind(email).first<{ id: string; name: string; email: string }>();
  if (user) {
    const token = randomToken();
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await env.DB.prepare("DELETE FROM auth_password_resets WHERE user_id = ?1 OR expires_at <= ?2").bind(user.id, new Date().toISOString()).run();
    await env.DB.prepare("INSERT INTO auth_password_resets (id, user_id, token_hash, expires_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5)")
      .bind(randomToken(16), user.id, await digest(token), expires, new Date().toISOString()).run();
    const url = `${new URL(request.url).origin}/?reset=${encodeURIComponent(token)}`;
    ctx.waitUntil(sendEmail(env, user.email, "Restablece tu contraseña de Waypoint", `<p>Hola ${user.name},</p><p>Restablece tu contraseña desde <a href="${url}">este enlace</a>. Expira en 30 minutos.</p>`));
  }
}

async function auth(request: Request, env: Env, ctx: ExecutionContext, action: string) {
  if (request.method === "OPTIONS") return new Response(null, { headers: apiHeaders(request) });
  if (action === "reset-request" && request.method === "POST") {
    let body: { email?: string };
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400, request); }
    const email = body.email?.trim().toLowerCase() || "";
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Email inválido" }, 400, request);
    await issuePasswordReset(request, env, ctx, email);
    return json({ status: "sent" }, 200, request);
  }
  if (action === "reset" && request.method === "POST") {
    let body: { token?: string; password?: string };
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400, request); }
    if (!body.token || !body.password || body.password.length < 12) return json({ error: "Token o contraseña inválidos" }, 400, request);
    const row = await env.DB.prepare("SELECT id, user_id FROM auth_password_resets WHERE token_hash = ?1 AND used_at IS NULL AND expires_at > ?2")
      .bind(await digest(body.token), new Date().toISOString()).first<{ id: string; user_id: string }>();
    if (!row) return json({ error: "El enlace es inválido o expiró" }, 400, request);
    const salt = new Uint8Array(16); crypto.getRandomValues(salt);
    await env.DB.prepare("UPDATE auth_users SET password_hash = ?1, password_salt = ?2 WHERE id = ?3")
      .bind(await passwordHash(body.password, salt), bytesToBase64(salt), row.user_id).run();
    await env.DB.prepare("UPDATE auth_password_resets SET used_at = ?1 WHERE id = ?2").bind(new Date().toISOString(), row.id).run();
    await env.DB.prepare("DELETE FROM auth_sessions WHERE user_id = ?1").bind(row.user_id).run();
    return json({ status: "password_reset" }, 200, request);
  }
  if (action === "password" && request.method === "POST") {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Unauthorized" }, 401, request);
    let body: { currentPassword?: string; password?: string };
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400, request); }
    if (!body.currentPassword || !body.password || body.password.length < 12) return json({ error: "Contraseña inválida" }, 400, request);
    const row = await env.DB.prepare("SELECT password_hash, password_salt FROM auth_users WHERE id = ?1").bind(user.id).first<{ password_hash: string; password_salt: string }>();
    if (!row || await passwordHash(body.currentPassword, base64ToBytes(row.password_salt)) !== row.password_hash) return json({ error: "Contraseña actual incorrecta" }, 401, request);
    const salt = new Uint8Array(16); crypto.getRandomValues(salt);
    await env.DB.prepare("UPDATE auth_users SET password_hash = ?1, password_salt = ?2 WHERE id = ?3").bind(await passwordHash(body.password, salt), bytesToBase64(salt), user.id).run();
    return json({ status: "password_changed" }, 200, request);
  }
  if (action === "status" && request.method === "GET") {
    const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM auth_users").first<{ count: number }>();
    return json({ setupRequired: !row?.count }, 200, request);
  }
  if (action === "me" && request.method === "GET") {
    const user = await currentUser(request, env);
    return user ? json({ user }, 200, request) : json({ error: "Unauthorized" }, 401, request);
  }
  if (action === "users" && request.method === "GET") {
    if (!await currentUser(request, env)) return json({ error: "Unauthorized" }, 401, request);
    const result = await env.DB.prepare("SELECT id, name, email, role, created_at FROM auth_users ORDER BY created_at ASC").all<AuthUser & { created_at: string }>();
    return json({ users: result.results.map((user) => ({ ...user, status: "Active", capabilities: [] })) }, 200, request);
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

async function media(request: Request, env: Env, key: string) {
  if (!await currentUser(request, env)) return json({ error: "Unauthorized" }, 401, request);
  if (request.method === "GET") {
    const object = await env.MEDIA_BUCKET.get(key);
    if (!object) return new Response("Not found", { status: 404 });
    const headers = new Headers(apiHeaders(request));
    headers.set("Content-Type", object.httpMetadata?.contentType || "application/octet-stream");
    headers.set("Cache-Control", "private, max-age=3600");
    return new Response(object.body, { headers });
  }
  if (request.method === "DELETE") {
    await env.MEDIA_BUCKET.delete(key);
    return json({ status: "deleted", key }, 200, request);
  }
  return json({ error: "Method not allowed" }, 405, request);
}

async function uploadMedia(request: Request, env: Env) {
  if (!await currentUser(request, env)) return json({ error: "Unauthorized" }, 401, request);
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, request);
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return json({ error: "Archivo requerido" }, 400, request);
  if (file.size > 10 * 1024 * 1024) return json({ error: "El archivo supera el límite de 10 MB" }, 413, request);
  const contentType = file.type || "application/octet-stream";
  const allowed = /^(image|audio|video)\//.test(contentType) || ["application/pdf", "text/plain", "application/json"].includes(contentType);
  if (!allowed) return json({ error: "Tipo de archivo no permitido" }, 415, request);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || "upload";
  const key = `media/${randomToken(12)}-${safeName}`;
  await env.MEDIA_BUCKET.put(key, file.stream(), { httpMetadata: { contentType, cacheControl: "private, max-age=3600" } });
  return json({ key, url: `${new URL(request.url).origin}/media/${encodeURIComponent(key)}`, name: file.name, mimeType: contentType, size: file.size }, 201, request);
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/api/auth/")) return auth(request, env, ctx, path.slice("/api/auth/".length));
    if (path === "/api/media/upload") return uploadMedia(request, env);
    if (path === "/api/webhooks/dispatch") return dispatchWebhook(request, env);
    if (path.startsWith("/media/")) return media(request, env, decodeURIComponent(path.slice("/media/".length)));
    if (path === "/api/state") return state(request, env);
    if (path.startsWith("/api/registry/")) return registry(request, env, path.slice("/api/registry/".length));
    if (env.ASSETS && (path.startsWith("/_next/") || path === "/favicon.svg")) {
      const asset = await env.ASSETS.fetch(request);
      if (asset.status !== 404) return asset;
    }
    return app(request, env, ctx);
  },
};

export default worker;
