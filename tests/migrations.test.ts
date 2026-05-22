import { describe, it, expect, afterAll } from "vitest";
import { testPool, closeTestPool } from "./helpers/db.js";

describe("schema", () => {
  afterAll(async () => {
    await closeTestPool();
  });

  const expectedTables = [
    "users",
    "magic_links",
    "sofi_tokens",
    "subjects",
    "blocks",
    "topics",
    "sessions",
    "messages",
  ];

  it.each(expectedTables)("table %s exists", async (table) => {
    const res = await testPool.query(
      `SELECT to_regclass($1) AS regclass`,
      [`public.${table}`]
    );
    expect(res.rows[0].regclass).not.toBeNull();
  });

  it("constraints work — invalid role rejected on users", async () => {
    await expect(
      testPool.query(
        `INSERT INTO users (email, name, role) VALUES ($1, $2, $3)`,
        ["x@x.com", "X", "invalid"]
      )
    ).rejects.toThrow();
  });
});
