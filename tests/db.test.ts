import { describe, it, expect, afterAll } from "vitest";
import { testPool, closeTestPool } from "./helpers/db.js";

describe("Postgres connection", () => {
  afterAll(async () => {
    await closeTestPool();
  });

  it("can connect and run a basic query", async () => {
    const res = await testPool.query("SELECT 1 as n");
    expect(res.rows[0].n).toBe(1);
  });
});
