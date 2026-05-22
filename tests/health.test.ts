import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { makeTestApp } from "./helpers/app.js";
import type { FastifyInstance } from "fastify";

describe("GET /healthz", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await makeTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns status ok", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ok");
    expect(typeof body.time).toBe("string");
  });
});
