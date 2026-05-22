import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { makeTestApp } from "../helpers/app.js";
import { testPool, closeTestPool, resetDb } from "../helpers/db.js";
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

describe("E2E full flow", () => {
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

  it("parent login → sofi token creation → sofi entry → session start → 4 blocks → finish", async () => {
    // 1. Parent requests magic link
    await app.inject({
      method: "POST",
      url: "/api/auth/request-magic-link",
      payload: { email: process.env.PARENT_EMAIL ?? "facuompre@gmail.com" },
    });

    // 2. Parent verifies and gets cookie
    const { rows: linkRows } = await testPool.query("SELECT token FROM magic_links LIMIT 1");
    const verify = await app.inject({
      method: "GET",
      url: `/api/auth/verify?token=${linkRows[0].token}`,
    });
    const parentCookie = verify.headers["set-cookie"] as string | string[];
    const parentCookieHeader = Array.isArray(parentCookie) ? parentCookie.join("; ") : parentCookie;

    // 3. Parent creates Sofi token
    const createToken = await app.inject({
      method: "POST",
      url: "/api/admin/sofi-tokens",
      headers: { cookie: parentCookieHeader },
      payload: { device_name: "Test laptop" },
    });
    expect(createToken.statusCode).toBe(201);
    const tokenUrl = createToken.json().url;
    const tokenValue = tokenUrl.split("/s/")[1];

    // 4. Sofi enters via /s/:token
    const enter = await app.inject({ method: "GET", url: `/s/${tokenValue}` });
    expect(enter.statusCode).toBe(302);
    const sofiCookie = enter.headers["set-cookie"] as string | string[];
    const sofiCookieHeader = Array.isArray(sofiCookie) ? sofiCookie.join("; ") : sofiCookie;

    // 5. Sofi fetches subjects
    const subjects = await app.inject({
      method: "GET",
      url: "/api/sofi/subjects",
      headers: { cookie: sofiCookieHeader },
    });
    expect(subjects.statusCode).toBe(200);
    const subjectsBody = subjects.json();
    const featured = subjectsBody.subjects[0].topics.find(
      (t: { id: string; status: string }) => t.status === "featured"
    );
    expect(featured).toBeDefined();

    // 6. Sofi starts session on the featured topic (whatever it currently is)
    const start = await app.inject({
      method: "POST",
      url: "/api/sofi/sessions",
      headers: { cookie: sofiCookieHeader },
      payload: { topic_id: featured.id },
    });
    const sessionId = start.json().session_id;

    // 7. Loop next-block until done
    let blocks = 0;
    while (blocks < 10) {
      const res = await app.inject({
        method: "POST",
        url: `/api/sofi/sessions/${sessionId}/next-block`,
        headers: { cookie: sofiCookieHeader },
      });
      if (res.json().done) break;
      blocks++;
    }
    expect(blocks).toBe(4);

    // 8. Finish
    const finish = await app.inject({
      method: "POST",
      url: `/api/sofi/sessions/${sessionId}/finish`,
      headers: { cookie: sofiCookieHeader },
    });
    expect(finish.statusCode).toBe(200);

    // 9. Verify session is finished in DB
    const { rows: sRows } = await testPool.query(
      "SELECT status, steps_completed FROM sessions WHERE id = $1",
      [sessionId]
    );
    expect(sRows[0].status).toBe("finished");
    expect(sRows[0].steps_completed).toBe(4);
  });
});
