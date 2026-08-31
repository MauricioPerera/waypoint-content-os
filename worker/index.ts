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

type PublishedBlock = { type?: string; content?: string; settings?: Record<string, unknown> };
type PublishedPage = { title: string; slug: string; status: string; blocks?: PublishedBlock[]; metadata?: Record<string, unknown> };
type PublishedEntry = { id?: string; title: string; slug?: string; type?: string; status: string; updatedAt?: string; data?: Record<string, unknown>; metadata?: Record<string, unknown> };

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safePublishedUrl(value: unknown) {
  const candidate = String(value ?? "").trim();
  if (candidate.startsWith("/")) return escapeHtml(candidate);
  try {
    const parsed = new URL(candidate);
    return ["http:", "https:"].includes(parsed.protocol) ? escapeHtml(parsed.toString()) : "#";
  } catch {
    return "#";
  }
}

function renderPublishedBlock(block: PublishedBlock) {
  const content = escapeHtml(block.content);
  const align = ["left", "center", "right"].includes(String(block.settings?.align)) ? String(block.settings?.align) : "left";
  const style = `text-align:${align};`;
  if (block.type === "button") return `<a class="page-button" style="${style}" href="${safePublishedUrl(block.settings?.url || "/")}">${content}</a>`;
  if (block.type === "image") return `<img class="page-image" src="${safePublishedUrl(block.content)}" alt="">`;
  if (block.type === "divider") return "<hr>";
  const heading = block.settings?.variant === "hero" ? " page-hero" : "";
  return `<div class="page-copy${heading}" style="${style}">${content}</div>`;
}

async function publishedPage(env: Env, slug: string) {
  if (!slug || slug.includes("/")) return null;
  const row = await env.DB.prepare("SELECT data FROM workspace_state WHERE id = ?1").bind("default").first<{ data: string }>();
  if (!row) return null;
  try {
    const state = JSON.parse(row.data) as { pages?: PublishedPage[] };
    return state.pages?.find((page) => page.slug === slug && page.status === "Published") || null;
  } catch {
    return null;
  }
}

function entrySlug(entry: PublishedEntry) {
  return String(entry.slug || entry.title).toLowerCase().replaceAll(" ", "-");
}

async function publishedEntries(env: Env) {
  const row = await env.DB.prepare("SELECT data FROM workspace_state WHERE id = ?1").bind("default").first<{ data: string }>();
  if (!row) return [];
  try {
    const state = JSON.parse(row.data) as { entries?: PublishedEntry[] };
    return (state.entries || []).filter((entry) => entry.status === "Published");
  } catch {
    return [];
  }
}

function entryBody(entry: PublishedEntry) {
  const body = typeof entry.data?.body === "string" ? entry.data.body : "";
  if (!body.trim()) return `<p class="entry-copy">Esta entrada está publicada en Waypoint Content OS.</p>`;
  return body
    .split(/\r?\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p class="entry-copy">${escapeHtml(paragraph)}</p>`)
    .join("");
}

function publicBlogShell(title: string, description: string, content: string) {
  return new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} — Waypoint</title><meta name="description" content="${escapeHtml(description)}"><style>:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#101314;color:#f4f6f2}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top left,#263629 0,#101314 42%);min-height:100vh}.public-site{width:min(1040px,calc(100% - 40px));margin:0 auto;padding:32px 0 72px}.brand{color:#d7ff4f;font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.public-shell{margin-top:72px;padding:clamp(26px,6vw,72px);border:1px solid #39413b;border-radius:28px;background:#171c1bdb;box-shadow:0 20px 80px #0008}.public-shell h1{margin:0 0 14px;font-size:clamp(42px,8vw,82px);line-height:.98;letter-spacing:-.06em}.lede{color:#bec8c0;font-size:20px;line-height:1.5}.entry-list{display:grid;gap:16px;margin-top:42px}.entry-card{display:block;padding:24px;border:1px solid #39413b;border-radius:18px;color:#f4f6f2;text-decoration:none;background:#111615aa}.entry-card:hover{border-color:#d7ff4f}.entry-card h2{margin:0 0 10px;font-size:clamp(23px,3vw,34px);letter-spacing:-.04em}.entry-card p,.entry-copy{color:#bec8c0;font-size:18px;line-height:1.55}.entry-meta{color:#d7ff4f;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.entry-head{margin-bottom:34px}.entry-copy{max-width:760px;margin:20px 0}.entry-details{display:flex;flex-wrap:wrap;gap:10px;margin-top:34px;color:#9eaaa1;font-size:13px}.entry-details span{padding:8px 10px;border:1px solid #39413b;border-radius:999px}.back-link{display:inline-block;margin-top:42px;color:#d7ff4f;font-weight:800;text-decoration:none}</style></head><body><main class="public-site"><div class="brand">Waypoint Content OS</div><section class="public-shell">${content}</section></main></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

function renderPublicBlog(entries: PublishedEntry[]) {
  const articles = entries.filter((entry) => !entry.type || entry.type === "Article");
  const cards = articles.map((entry) => {
    const slug = encodeURIComponent(entrySlug(entry));
    const excerpt = typeof entry.data?.body === "string" ? entry.data.body : "Contenido publicado en Waypoint Content OS.";
    return `<a class="entry-card" href="/article/${slug}"><div class="entry-meta">${escapeHtml(entry.type || "Article")}</div><h2>${escapeHtml(entry.title)}</h2><p>${escapeHtml(excerpt.slice(0, 180))}${excerpt.length > 180 ? "…" : ""}</p></a>`;
  }).join("");
  const content = `<div class="entry-head"><div class="entry-meta">PUBLICACIÓN</div><h1>Blog</h1><p class="lede">Entradas estructuradas, publicadas y listas para ser consumidas por personas o agentes.</p></div><div class="entry-list">${cards || `<p class="lede">Todavía no hay entradas publicadas.</p>`}</div>`;
  return publicBlogShell("Blog", "Entradas publicadas en Waypoint Content OS.", content);
}

function renderPublicEntry(entry: PublishedEntry) {
  const authors = typeof entry.data?.authors === "string" ? entry.data.authors : "";
  const topics = typeof entry.data?.topics === "string" ? entry.data.topics : "";
  const readingTime = typeof entry.data?.reading_time === "string" ? entry.data.reading_time : "";
  const details = [authors && `Autor: ${authors}`, topics && `Temas: ${topics}`, readingTime && `Lectura: ${readingTime}`].filter(Boolean).map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  const content = `<div class="entry-head"><div class="entry-meta">${escapeHtml(entry.type || "Article")} · PUBLICADO</div><h1>${escapeHtml(entry.title)}</h1>${entry.updatedAt ? `<p class="lede">Actualizado ${escapeHtml(new Date(entry.updatedAt).toLocaleDateString("es-MX"))}</p>` : ""}</div>${entryBody(entry)}${details ? `<div class="entry-details">${details}</div>` : ""}<a class="back-link" href="/blog">← Volver al blog</a>`;
  return publicBlogShell(entry.title, `Entrada publicada: ${entry.title}`, content);
}

async function renderPublishedEntry(env: Env, slug: string) {
  const entry = (await publishedEntries(env)).find((item) => entrySlug(item) === slug);
  return entry ? renderPublicEntry(entry) : null;
}

async function renderPublishedPage(env: Env, slug: string) {
  const page = await publishedPage(env, slug);
  if (!page) return null;
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.metadata?.seoDescription || `Página publicada en Waypoint Content OS: ${page.title}`);
  const blocks = (page.blocks || []).map(renderPublishedBlock).join("\n");
  return new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} — Waypoint</title><meta name="description" content="${description}"><style>:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#101314;color:#f4f6f2}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top left,#263629 0,#101314 42%);min-height:100vh}.published-page{width:min(960px,calc(100% - 40px));margin:0 auto;padding:32px 0 72px}.page-brand{color:#d7ff4f;font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.page-shell{margin-top:72px;padding:clamp(28px,7vw,84px);border:1px solid #39413b;border-radius:28px;background:#171c1bdb;box-shadow:0 20px 80px #0008}.page-title{margin:0 0 40px;font-size:clamp(42px,8vw,86px);line-height:.98;letter-spacing:-.06em}.page-copy{margin:18px 0;color:#bec8c0;font-size:clamp(18px,2.4vw,25px);line-height:1.5}.page-hero{color:#f4f6f2;font-size:clamp(34px,6vw,66px);font-weight:800;line-height:1.02;letter-spacing:-.05em}.page-button{display:inline-block;margin-top:18px;padding:14px 20px;border-radius:12px;background:#d7ff4f;color:#101314;font-weight:800;text-decoration:none}.page-image{display:block;max-width:100%;height:auto;border-radius:18px;margin:24px auto}.page-shell hr{border:0;border-top:1px solid #4a554c;margin:32px 0}</style></head><body><main class="published-page"><div class="page-brand">Waypoint Content OS</div><article class="page-shell"><h1 class="page-title">${title}</h1>${blocks}</article></main></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
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
    if (request.method === "GET" && path === "/blog") return renderPublicBlog(await publishedEntries(env));
    if (request.method === "GET" && path.startsWith("/article/")) {
      const slug = decodeURIComponent(path.slice("/article/".length).replace(/\/$/, ""));
      const entry = await renderPublishedEntry(env, slug);
      if (entry) return entry;
      return new Response("Not found", { status: 404 });
    }
    if (env.ASSETS && (path.startsWith("/_next/") || path === "/favicon.svg")) {
      const asset = await env.ASSETS.fetch(request);
      if (asset.status !== 404) return asset;
    }
    if (request.method === "GET" && path !== "/" && !path.includes(".")) {
      const page = await renderPublishedPage(env, decodeURIComponent(path.slice(1).replace(/\/$/, "")));
      if (page) return page;
    }
    return app(request, env, ctx);
  },
};

export default worker;
