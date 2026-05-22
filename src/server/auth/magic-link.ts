import { query } from "../db.js";
import { shortToken } from "../lib/ids.js";
import { sendMagicLink } from "../email/resend.js";
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

  const link = `${config.appBaseUrl}/api/auth/verify?token=${token}`;
  await sendMagicLink(normalized, link);
}

export type VerifyResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; reason: "not_found" | "expired" | "already_used" };

export async function verifyMagicLink(token: string): Promise<VerifyResult> {
  const { rows } = await query<{
    id: string;
    user_id: string;
    expires_at: Date;
    used_at: Date | null;
    role: string;
    revoked_at: Date | null;
  }>(
    `SELECT ml.id, ml.user_id, ml.expires_at, ml.used_at, u.role, u.revoked_at
       FROM magic_links ml
       JOIN users u ON u.id = ml.user_id
      WHERE ml.token = $1
      LIMIT 1`,
    [token]
  );

  if (rows.length === 0) return { ok: false, reason: "not_found" };

  const link = rows[0];
  if (link.used_at) return { ok: false, reason: "already_used" };
  if (new Date(link.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  if (link.revoked_at) return { ok: false, reason: "not_found" };

  await query(`UPDATE magic_links SET used_at = now() WHERE id = $1`, [link.id]);

  return { ok: true, userId: link.user_id, role: link.role };
}
