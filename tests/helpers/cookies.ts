import type { FastifyInstance } from "fastify";
import { testPool } from "./db.js";

/**
 * Inserta un sofi_token de test y entra por `/s/:token` para que el server
 * setee la cookie `sofi_device`. Devuelve el header `cookie` listo para
 * pasar a `app.inject({ headers: { cookie } })`.
 */
export async function getSofiCookie(
  app: FastifyInstance,
  opts: { token?: string; deviceName?: string } = {}
): Promise<string> {
  const token = opts.token ?? "test-sofi-token-12345";
  const deviceName = opts.deviceName ?? "Test device";
  await testPool.query(
    `INSERT INTO sofi_tokens (token, device_name)
     VALUES ($1, $2)
     ON CONFLICT (token) DO NOTHING`,
    [token, deviceName]
  );
  const res = await app.inject({ method: "GET", url: `/s/${token}` });
  const cookies = res.headers["set-cookie"] as string | string[];
  return Array.isArray(cookies) ? cookies.join("; ") : cookies;
}

/**
 * Saca cookie de parent vía magic link.
 *
 * NOTA: arrancamos por magic link (no por password-login) porque la INSERT
 * de password-login está rota — no setea `name` y choca con el NOT NULL
 * de `users.name`. Ver tests/admin-password-login.test.ts.
 */
export async function getParentCookie(app: FastifyInstance): Promise<string> {
  // 1. Pedimos magic link. El flow crea al user de Papá si no existe.
  await app.inject({
    method: "POST",
    url: "/api/auth/request-magic-link",
    payload: { email: process.env.PARENT_EMAIL ?? "facuompre@gmail.com" },
  });
  // 2. Sacamos el token del DB (en producción también se lee de DB — sin email).
  const { rows } = await testPool.query<{ token: string }>(
    "SELECT token FROM magic_links ORDER BY expires_at DESC LIMIT 1"
  );
  if (rows.length === 0) {
    throw new Error("getParentCookie: no magic_link row created");
  }
  // 3. Verify → setea cookie de parent.
  const verify = await app.inject({
    method: "GET",
    url: `/api/auth/verify?token=${rows[0].token}`,
  });
  if (verify.statusCode !== 302) {
    throw new Error(`getParentCookie: verify failed (${verify.statusCode})`);
  }
  const cookies = verify.headers["set-cookie"] as string | string[];
  return Array.isArray(cookies) ? cookies.join("; ") : cookies;
}

/**
 * Corre las migraciones (idempotente). Usar en `beforeEach` después de `resetDb()`.
 */
export async function applyMigrations(): Promise<void> {
  const { runner } = await import("node-pg-migrate");
  await runner({
    databaseUrl: process.env.DATABASE_URL!,
    dir: "migrations",
    direction: "up",
    migrationsTable: "pgmigrations",
    log: () => {},
  });
}
