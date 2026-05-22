import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { makeTestApp } from "./helpers/app.js";
import { testPool, closeTestPool, resetDb } from "./helpers/db.js";
import type { FastifyInstance } from "fastify";

async function applyMigrations() {
  const { runner } = await import("node-pg-migrate");
  await runner({
    databaseUrl: process.env.DATABASE_URL!,
    dir: "migrations",
    direction: "up",
    migrationsTable: "pgmigrations",
    log: () => {},
  });
}

async function loginAsParent(app: FastifyInstance): Promise<string> {
  await app.inject({
    method: "POST",
    url: "/api/auth/request-magic-link",
    payload: { email: process.env.PARENT_EMAIL ?? "facuompre@gmail.com" },
  });
  const { rows } = await testPool.query<{ token: string }>(
    "SELECT token FROM magic_links LIMIT 1"
  );
  const res = await app.inject({
    method: "GET",
    url: `/api/auth/verify?token=${rows[0].token}`,
  });
  const cookies = res.headers["set-cookie"] as string | string[];
  return Array.isArray(cookies) ? cookies.join("; ") : cookies;
}

describe("POST /api/admin/sofi-tokens", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await makeTestApp();
  });

  beforeEach(async () => {
    await resetDb();
    await applyMigrations();
  });

  afterAll(async () => {
    await app.close();
    await closeTestPool();
  });

  it("rejects unauthenticated request", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/sofi-tokens",
      payload: { device_name: "Laptop personal" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("creates token when authenticated as parent", async () => {
    const cookie = await loginAsParent(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/sofi-tokens",
      headers: { cookie },
      payload: { device_name: "Laptop personal" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.url).toMatch(/\/s\/[\w-]+$/);

    const { rows } = await testPool.query("SELECT count(*)::int AS c FROM sofi_tokens");
    expect(rows[0].c).toBe(1);
  });

  it("revokes token via DELETE", async () => {
    const cookie = await loginAsParent(app);
    const create = await app.inject({
      method: "POST",
      url: "/api/admin/sofi-tokens",
      headers: { cookie },
      payload: { device_name: "Notebook cole" },
    });
    const id = create.json().id;

    const del = await app.inject({
      method: "DELETE",
      url: `/api/admin/sofi-tokens/${id}`,
      headers: { cookie },
    });
    expect(del.statusCode).toBe(200);

    const { rows } = await testPool.query(
      "SELECT revoked_at FROM sofi_tokens WHERE id = $1",
      [id]
    );
    expect(rows[0].revoked_at).not.toBeNull();
  });

  it("entry point /s/:token sets cookie for valid token", async () => {
    const cookie = await loginAsParent(app);
    const create = await app.inject({
      method: "POST",
      url: "/api/admin/sofi-tokens",
      headers: { cookie },
      payload: { device_name: "Laptop personal" },
    });
    const url = create.json().url;
    const token = url.split("/s/")[1];

    const res = await app.inject({ method: "GET", url: `/s/${token}` });
    expect(res.statusCode).toBe(302);
    expect(res.headers["set-cookie"]).toBeTruthy();
    expect(res.headers.location).toBe("/sofi.html");
  });

  it("entry point /s/:token rejects unknown token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/s/this-token-does-not-exist-1234567890",
    });
    expect(res.statusCode).toBe(401);
  });

  it("entry point /s/:token rejects revoked token", async () => {
    const cookie = await loginAsParent(app);
    const create = await app.inject({
      method: "POST",
      url: "/api/admin/sofi-tokens",
      headers: { cookie },
      payload: { device_name: "Test" },
    });
    const id = create.json().id;
    const url = create.json().url;
    const token = url.split("/s/")[1];

    await app.inject({
      method: "DELETE",
      url: `/api/admin/sofi-tokens/${id}`,
      headers: { cookie },
    });

    const res = await app.inject({ method: "GET", url: `/s/${token}` });
    expect(res.statusCode).toBe(401);
  });
});
