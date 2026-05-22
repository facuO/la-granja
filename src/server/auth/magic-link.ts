import { query } from "../db.js";
import { shortToken } from "../lib/ids.js";
import { config } from "../config.js";

const EXPIRATION_MINUTES = 15;

export async function requestMagicLink(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const isParent = normalized === config.parentEmail.toLowerCase();

  const { rows: users } = await query<{ id: string; revoked_at: Date | null }>(
    `SELECT id, revoked_at FROM users WHERE lower(email) = $1 LIMIT 1`,
    [normalized]
  );

  let userId: string;

  if (users.length === 0) {
    if (!isParent) return;
    const { rows: created } = await query<{ id: string }>(
      `INSERT INTO users (email, name, role) VALUES ($1, $2, 'parent') RETURNING id`,
      [normalized, "Papá"]
    );
    userId = created[0].id;
  } else {
    if (users[0].revoked_at) return;
    userId = users[0].id;
  }

  const token = shortToken();
  const expiresAt = new Date(Date.now() + EXPIRATION_MINUTES * 60 * 1000);

  await query(
    `INSERT INTO magic_links (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  );

  // No email integration: the link is queryable from the magic_links table.
  // Operator (or Postgres MCP) retrieves it directly.
}

export type VerifyResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; reason: "not_found" | "expired" | "already_used" };

export async function verifyMagicLink(token: string): Promise<VerifyResult> {
  // Atomically claim the link: only succeeds if token exists, not used, not expired.
  const { rows, rowCount } = await query<{ user_id: string }>(
    `UPDATE magic_links
        SET used_at = now()
      WHERE token = $1
        AND used_at IS NULL
        AND expires_at > now()
     RETURNING user_id`,
    [token]
  );

  if (rowCount === 1) {
    const { rows: userRows } = await query<{ role: string; revoked_at: Date | null }>(
      `SELECT role, revoked_at FROM users WHERE id = $1`,
      [rows[0].user_id]
    );
    if (userRows.length === 0 || userRows[0].revoked_at) {
      return { ok: false, reason: "not_found" };
    }
    return { ok: true, userId: rows[0].user_id, role: userRows[0].role };
  }

  // Claim failed — figure out why (for the 401 response reason).
  const { rows: diag } = await query<{ used_at: Date | null; expires_at: Date }>(
    `SELECT used_at, expires_at FROM magic_links WHERE token = $1`,
    [token]
  );
  if (diag.length === 0) return { ok: false, reason: "not_found" };
  if (diag[0].used_at) return { ok: false, reason: "already_used" };
  return { ok: false, reason: "expired" };
}
