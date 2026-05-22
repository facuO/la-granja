import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { makeTestApp } from "./helpers/app.js";
import { testPool, closeTestPool, resetDb } from "./helpers/db.js";
import type { FastifyInstance } from "fastify";

const FEATURED_TOPIC_ID = "33333333-3333-3333-3333-333333333332";
const UPCOMING_TOPIC_ID = "33333333-3333-3333-3333-333333333334";

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

describe("session lifecycle", () => {
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

  it("next-block accepts POST with empty body and application/json", async () => {
    // Regression: browsers may send POSTs with content-type: application/json
    // and an empty body. Fastify's default JSON parser rejects those, but we
    // override it to treat empty body as undefined.
    const cookie = await getSofiCookie(app);
    const start = await app.inject({
      method: "POST",
      url: "/api/sofi/sessions",
      headers: { cookie, "content-type": "application/json" },
      payload: { topic_id: FEATURED_TOPIC_ID },
    });
    const sessionId = start.json().session_id;

    const res = await app.inject({
      method: "POST",
      url: `/api/sofi/sessions/${sessionId}/next-block`,
      headers: { cookie, "content-type": "application/json", "content-length": "0" },
      payload: "",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().block).toBeDefined();
  });

  it("starts a session, fetches all blocks, finishes", async () => {
    const cookie = await getSofiCookie(app);

    const start = await app.inject({
      method: "POST",
      url: "/api/sofi/sessions",
      headers: { cookie },
      payload: { topic_id: FEATURED_TOPIC_ID },
    });
    expect(start.statusCode).toBe(201);
    const sessionId = start.json().session_id;

    const kinds: string[] = [];
    for (let i = 0; i < 10; i++) {
      const res = await app.inject({
        method: "POST",
        url: `/api/sofi/sessions/${sessionId}/next-block`,
        headers: { cookie },
      });
      const body = res.json();
      if (body.done) break;
      kinds.push(body.block.block_kind);
    }

    expect(kinds).toEqual(["explanation", "visual", "question", "feedback"]);

    const finish = await app.inject({
      method: "POST",
      url: `/api/sofi/sessions/${sessionId}/finish`,
      headers: { cookie },
    });
    expect(finish.statusCode).toBe(200);
    expect(typeof finish.json().summary).toBe("string");

    const { rows } = await testPool.query(
      `SELECT status FROM sessions WHERE id = $1`,
      [sessionId]
    );
    expect(rows[0].status).toBe("finished");
  });

  it("rejects starting session on upcoming topic", async () => {
    const cookie = await getSofiCookie(app);
    const start = await app.inject({
      method: "POST",
      url: "/api/sofi/sessions",
      headers: { cookie },
      payload: { topic_id: UPCOMING_TOPIC_ID },
    });
    expect(start.statusCode).toBe(400);
    expect(start.json().reason).toBe("topic_not_eligible");
  });

  it("países limítrofes session emits a multi_select question", async () => {
    const PAISES_LIMITROFES = "44444444-4444-4444-4444-444444444401";
    const cookie = await getSofiCookie(app);

    const start = await app.inject({
      method: "POST",
      url: "/api/sofi/sessions",
      headers: { cookie },
      payload: { topic_id: PAISES_LIMITROFES },
    });
    expect(start.statusCode).toBe(201);
    expect(start.json().steps_planned).toBeGreaterThanOrEqual(10);
    const sessionId = start.json().session_id;

    const blocks: { block_kind: string; content: { kind?: string } }[] = [];
    for (let i = 0; i < 50; i++) {
      const res = await app.inject({
        method: "POST",
        url: `/api/sofi/sessions/${sessionId}/next-block`,
        headers: { cookie },
      });
      const body = res.json();
      if (body.done) break;
      blocks.push(body.block);
    }

    const questions = blocks.filter((b) => b.block_kind === "question");
    expect(questions).toHaveLength(1);
    expect(questions[0].content.kind).toBe("multi_select");
    // Should have several explanation blocks before the question
    const explanations = blocks.filter((b) => b.block_kind === "explanation");
    expect(explanations.length).toBeGreaterThanOrEqual(8);
  });

  it("V/F session emits 2 true_false questions", async () => {
    const VF_TOPIC = "44444444-4444-4444-4444-444444444403";
    const cookie = await getSofiCookie(app);

    const start = await app.inject({
      method: "POST",
      url: "/api/sofi/sessions",
      headers: { cookie },
      payload: { topic_id: VF_TOPIC },
    });
    expect(start.json().steps_planned).toBeGreaterThanOrEqual(10);
    const sessionId = start.json().session_id;

    const kinds: string[] = [];
    const questionKinds: string[] = [];
    for (let i = 0; i < 50; i++) {
      const res = await app.inject({
        method: "POST",
        url: `/api/sofi/sessions/${sessionId}/next-block`,
        headers: { cookie },
      });
      const body = res.json();
      if (body.done) break;
      kinds.push(body.block.block_kind);
      if (body.block.block_kind === "question") {
        questionKinds.push(body.block.content.kind);
      }
    }

    expect(questionKinds).toEqual(["true_false", "true_false"]);
    // Feedback comes right after each question
    const feedbackCount = kinds.filter((k) => k === "feedback").length;
    expect(feedbackCount).toBe(2);
  });
});
