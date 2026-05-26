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
    const sociales = body.subjects.find(
      (s: { name: string }) => s.name === "Ciencias Sociales"
    );
    expect(sociales).toBeDefined();

    const statuses = sociales.topics.map((t: { status: string }) => t.status);
    expect(statuses).toContain("featured");
    expect(statuses).toContain("available");
    expect(statuses).toContain("done");
    expect(statuses).not.toContain("upcoming");

    expect(sociales.topics[0].status).toBe("featured");
  });

  it("returns Lengua, Matemática and Naturales with their seeded topics", async () => {
    const cookie = await getSofiCookie(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/sofi/subjects",
      headers: { cookie },
    });
    const body = res.json();
    const names = body.subjects.map((s: { name: string }) => s.name).sort();
    expect(names).toContain("Lengua");
    expect(names).toContain("Matemática");
    expect(names).toContain("Ciencias Naturales");

    // Each newly-seeded subject has 1 featured + 2 available topics (seeded in
    // 1779748122797_seed-topics-lengua-mate-naturales).
    for (const subjectName of ["Lengua", "Matemática", "Ciencias Naturales"]) {
      const subj = body.subjects.find((s: { name: string }) => s.name === subjectName);
      expect(subj.topics.length).toBeGreaterThanOrEqual(3);
      const statuses = subj.topics.map((t: { status: string }) => t.status);
      expect(statuses).toContain("featured");
      expect(statuses).toContain("available");
      expect(subj.topics[0].status).toBe("featured");
    }
  });

  it("rejects unauthenticated", async () => {
    const res = await app.inject({ method: "GET", url: "/api/sofi/subjects" });
    expect(res.statusCode).toBe(401);
  });
});
