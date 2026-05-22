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

async function getSofiCookie(app: FastifyInstance): Promise<string> {
  await testPool.query(
    `INSERT INTO sofi_tokens (token, device_name)
     VALUES ('test-sofi-token-12345', 'Test device')`
  );
  const res = await app.inject({ method: "GET", url: "/s/test-sofi-token-12345" });
  const cookies = res.headers["set-cookie"] as string | string[];
  return Array.isArray(cookies) ? cookies.join("; ") : cookies;
}

describe("GET /api/sofi/subjects", () => {
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

  it("returns Sociales with featured + available + done topics", async () => {
    const cookie = await getSofiCookie(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/sofi/subjects",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.subjects).toHaveLength(1);
    const sociales = body.subjects[0];
    expect(sociales.name).toBe("Ciencias Sociales");

    const statuses = sociales.topics.map((t: { status: string }) => t.status);
    expect(statuses).toContain("featured");
    expect(statuses).toContain("available");
    expect(statuses).toContain("done");
    expect(statuses).not.toContain("upcoming");

    expect(sociales.topics[0].status).toBe("featured");
  });

  it("rejects unauthenticated", async () => {
    const res = await app.inject({ method: "GET", url: "/api/sofi/subjects" });
    expect(res.statusCode).toBe(401);
  });
});
