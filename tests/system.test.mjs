import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const baseUrl = (process.env.WAYPOINT_BASE_URL || "https://waypoint-content-os.rckflr.workers.dev").replace(/\/$/, "");

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("WebMCP tools have unique names", async () => {
  const code = await source("src/mcp/tools.ts");
  const names = [...code.matchAll(/\bname:\s*["']([^"']+)["']/g)].map((match) => match[1]);
  assert.ok(names.length >= 100, `expected at least 100 tools, found ${names.length}`);
  assert.equal(new Set(names).size, names.length, "duplicate WebMCP tool names detected");
});

test("WebMCP registration is defensive against duplicates", async () => {
  const code = await source("src/mcp/register.tsx");
  assert.match(code, /findIndex\(candidate=>candidate\.name===tool\.name\)/);
  assert.match(code, /registerTools\(unique\)/);
  assert.match(code, /unregister/);
});

test("Cloudflare configuration includes persistent D1 and R2 bindings", async () => {
  const config = await source("wrangler.jsonc");
  assert.match(config, /\"binding\":\s*\"DB\"/);
  assert.match(config, /\"binding\":\s*\"MEDIA_BUCKET\"/);
  assert.match(config, /\"database_id\":/);
  assert.match(config, /\"bucket_name\":/);
});

test("plugin extension surface supports install, hooks, actions, and persistence", async () => {
  const page = await source("app/page.tsx");
  const tools = await source("src/mcp/tools.ts");
  assert.match(page, /Install declarative plugin/);
  assert.match(page, /toggleHook/);
  assert.match(page, /runAction/);
  assert.match(page, /\/api\/registry\/hooks/);
  assert.match(page, /\/api\/registry\/actions/);
  assert.match(tools, /plugin/);
  assert.match(tools, /hook/);
  assert.match(tools, /action/);
});

test("public application renders the authentication shell", async () => {
  const response = await fetch(`${baseUrl}/`, { redirect: "manual" });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Welcome back|Sign in|Iniciar sesión|Loading Waypoint|Waypoint — Agent-first/i);
});

test("protected API routes reject anonymous requests", async () => {
  const paths = [
    "/api/state",
    "/api/registry/settings",
    "/api/registry/hooks",
    "/api/registry/actions",
    "/api/media/upload",
    "/media/not-found",
  ];

  const results = await Promise.all(paths.map(async (path) => {
    const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
    return [path, response.status];
  }));

  for (const [path, status] of results) assert.equal(status, 401, `${path} should require authentication`);
});
