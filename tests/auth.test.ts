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

describe("auth flow", () => {
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

  it("request-magic-link creates row for parent email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/request-magic-link",
      payload: { email: process.env.PARENT_EMAIL ?? "facuompre@gmail.com" },
    });
    expect(res.statusCode).toBe(200);
    const { rows } = await testPool.query("SELECT count(*)::int AS c FROM magic_links");
    expect(rows[0].c).toBe(1);
  });

  it("request-magic-link does not create row for unknown email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/request-magic-link",
      payload: { email: "unknown@example.com" },
    });
    expect(res.statusCode).toBe(200);
    const { rows } = await testPool.query("SELECT count(*)::int AS c FROM magic_links");
    expect(rows[0].c).toBe(0);
  });

  it("verify accepts a valid token and sets cookie", async () => {
    await app.inject({
      method: "POST",
      url: "/api/auth/request-magic-link",
      payload: { email: process.env.PARENT_EMAIL ?? "facuompre@gmail.com" },
    });
    const { rows } = await testPool.query("SELECT token FROM magic_links LIMIT 1");
    const token = rows[0].token;

    const res = await app.inject({
      method: "GET",
      url: `/api/auth/verify?token=${token}`,
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers["set-cookie"]).toBeTruthy();
  });

  it("verify rejects unknown token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/verify?token=this-is-a-fake-token-32-chars-long",
    });
    expect(res.statusCode).toBe(401);
  });

  it("verify rejects already-used token", async () => {
    await app.inject({
      method: "POST",
      url: "/api/auth/request-magic-link",
      payload: { email: process.env.PARENT_EMAIL ?? "facuompre@gmail.com" },
    });
    const { rows } = await testPool.query("SELECT token FROM magic_links LIMIT 1");
    const token = rows[0].token;
    await app.inject({ method: "GET", url: `/api/auth/verify?token=${token}` });
    const second = await app.inject({ method: "GET", url: `/api/auth/verify?token=${token}` });
    expect(second.statusCode).toBe(401);
  });
});
