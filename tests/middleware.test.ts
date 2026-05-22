import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { buildApp } from "../src/server/index.js";
import { testPool, closeTestPool, resetDb } from "./helpers/db.js";
import { requireParent, requireSofi } from "../src/server/auth/middleware.js";
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

describe("auth middleware", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Build app without calling ready() so we can add test routes first
    app = await buildApp();
    app.get("/test-parent", { preHandler: requireParent }, async (req) => {
      return { id: req.parent!.id, email: req.parent!.email };
    });
    app.get("/test-sofi", { preHandler: requireSofi }, async (req) => {
      return { tokenId: req.sofi!.tokenId };
    });
    await app.ready();
  });

  beforeEach(async () => {
    await resetDb();
    await applyMigrations();
  });

  afterAll(async () => {
    await app.close();
    await closeTestPool();
  });

  it("requireParent rejects without cookie", async () => {
    const res = await app.inject({ method: "GET", url: "/test-parent" });
    expect(res.statusCode).toBe(401);
  });

  it("requireSofi rejects without cookie", async () => {
    const res = await app.inject({ method: "GET", url: "/test-sofi" });
    expect(res.statusCode).toBe(401);
  });
});
