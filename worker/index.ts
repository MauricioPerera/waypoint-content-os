import framework from "../dist/server/index.js";

interface Env {
  DB: D1Database;
}

type Framework = {
  (request: Request, env: Env, ctx: ExecutionContext): Promise<Response>;
};

const app = framework as unknown as Framework;
const headers = {
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json; charset=utf-8",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

async function state(request: Request, env: Env) {
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT data, updated_at FROM workspace_state WHERE id = ?1",
    )
      .bind("default")
      .first<{ data: string; updated_at: string }>();
    return json({
      state: row ? JSON.parse(row.data) : null,
      updatedAt: row?.updated_at || null,
    });
  }
  if (request.method !== "PUT") return json({ error: "Method not allowed" }, 405);
  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const updatedAt = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO workspace_state (id, data, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
  )
    .bind("default", JSON.stringify(data), updatedAt)
    .run();
  return json({ status: "saved", updatedAt });
}

async function registry(request: Request, env: Env, key: string) {
  if (request.method === "OPTIONS") return new Response(null, { headers });
  const id = `registry:${key}`;
  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT data, updated_at FROM workspace_state WHERE id = ?1",
    )
      .bind(id)
      .first<{ data: string; updated_at: string }>();
    return json({ data: row ? JSON.parse(row.data) : null, updatedAt: row?.updated_at || null });
  }
  if (request.method !== "PUT") return json({ error: "Method not allowed" }, 405);
  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const updatedAt = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO workspace_state (id, data, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
  )
    .bind(id, JSON.stringify(data), updatedAt)
    .run();
  return json({ status: "saved", updatedAt });
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname === "/api/state") return state(request, env);
    if (url.pathname.startsWith("/api/registry/"))
      return registry(request, env, url.pathname.slice("/api/registry/".length));
    return app(request, env, ctx);
  },
};

export default worker;
