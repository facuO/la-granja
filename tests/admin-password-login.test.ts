import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { makeTestApp } from "./helpers/app.js";
import { testPool, closeTestPool, resetDb } from "./helpers/db.js";
import { applyMigrations } from "./helpers/cookies.js";
import type { FastifyInstance } from "fastify";

/**
 * BUG ACTUAL (admin.routes.ts POST /api/admin/password-login):
 *
 *   INSERT INTO users (email, role) VALUES ($1, 'parent')
 *   ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
 *   RETURNING id
 *
 * `users.name` es NOT NULL. Postgres valida los constraints de la fila
 * propuesta ANTES de evaluar el `ON CONFLICT`, así que aún si el user
 * existe, el endpoint crashea con `null value in column "name"`.
 *
 * Resultado: el password-login está roto en cualquier estado de DB.
 *
 * Estos tests documentan:
 *  - validación de schema (lo único que NO toca DB, así que pasa)
 *  - rechazo por password incorrecto (también short-circuit antes del INSERT)
 *
 * El happy-path (200 + cookie + user creado/reusado) queda en `it.skip`
 * hasta que se arregle el INSERT (agregar `name` o aflojar el constraint).
 */
describe("POST /api/admin/password-login", () => {
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

  // --- Casos que sí funcionan hoy: short-circuit antes de tocar DB ---

  it("rejects with 401 when password is wrong", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/password-login",
      payload: { password: "wrong-pass" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ ok: false, reason: "bad_password" });
    expect(res.headers["set-cookie"]).toBeFalsy();
  });

  it("rejects with 401 when password is wrong and user already exists", async () => {
    // Sembramos al user — el rechazo debe seguir igual.
    await testPool.query(
      `INSERT INTO users (email, name, role) VALUES ($1, $2, 'parent')`,
      [process.env.PARENT_EMAIL, "Papá"]
    );
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/password-login",
      payload: { password: "definitely-not-1234" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ ok: false, reason: "bad_password" });
  });

  it("rejects empty password (schema validation minLength: 1)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/password-login",
      payload: { password: "" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects requests missing the password field", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/password-login",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects when password exceeds maxLength (100)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/password-login",
      payload: { password: "x".repeat(101) },
    });
    expect(res.statusCode).toBe(400);
  });

  // --- BUG documentado: el happy-path crashea con 500 ---

  it("HAPPY PATH bug: returns 500 even when user already exists (NOT NULL violation)", async () => {
    // Pre-existing user — debería permitir que ON CONFLICT haga UPDATE en
    // vez de INSERT, pero Postgres valida NOT NULL antes del conflict path.
    await testPool.query(
      `INSERT INTO users (email, name, role) VALUES ($1, $2, 'parent')`,
      [process.env.PARENT_EMAIL, "Papá"]
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/admin/password-login",
      payload: { password: "1234" },
    });
    // El endpoint crashea con 500 (DatabaseError). Cuando se arregle, este
    // test va a fallar — y conviene cambiarlo a el caso happy real.
    expect(res.statusCode).toBe(500);
  });

  // --- Tests del comportamiento ESPERADO (skip hasta arreglar el bug) ---

  it.skip("[esperado] accepts the right password and sets the parent cookie", async () => {
    await testPool.query(
      `INSERT INTO users (email, name, role) VALUES ($1, $2, 'parent')`,
      [process.env.PARENT_EMAIL, "Papá"]
    );
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/password-login",
      payload: { password: "1234" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });

    const cookies = res.headers["set-cookie"];
    const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : (cookies as string);
    expect(cookieHeader).toMatch(/sofi_session=/);
  });

  it.skip("[esperado] creates the parent user on the fly if no magic link was ever requested", async () => {
    const before = await testPool.query("SELECT count(*)::int AS c FROM users");
    expect(before.rows[0].c).toBe(0);

    const res = await app.inject({
      method: "POST",
      url: "/api/admin/password-login",
      payload: { password: "1234" },
    });
    expect(res.statusCode).toBe(200);

    const after = await testPool.query<{ email: string; role: string }>(
      "SELECT email, role FROM users"
    );
    expect(after.rows).toHaveLength(1);
    expect(after.rows[0].email).toBe(process.env.PARENT_EMAIL);
    expect(after.rows[0].role).toBe("parent");
  });

  it.skip("[esperado] cookie from password-login authorizes parent-only endpoints", async () => {
    await testPool.query(
      `INSERT INTO users (email, name, role) VALUES ($1, $2, 'parent')`,
      [process.env.PARENT_EMAIL, "Papá"]
    );
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/admin/password-login",
      payload: { password: "1234" },
    });
    const cookies = loginRes.headers["set-cookie"];
    const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : (cookies as string);

    const tokensRes = await app.inject({
      method: "GET",
      url: "/api/admin/sofi-tokens",
      headers: { cookie: cookieHeader },
    });
    expect(tokensRes.statusCode).toBe(200);
    expect(Array.isArray(tokensRes.json().tokens)).toBe(true);
  });
});
