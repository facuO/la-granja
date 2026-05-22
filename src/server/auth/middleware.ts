import type { FastifyRequest, FastifyReply } from "fastify";
import { readParentCookie, readSofiCookie } from "./cookies.js";
import { query } from "../db.js";

export interface ParentUser {
  id: string;
  email: string;
  role: "parent";
}

export interface SofiContext {
  tokenId: string;
  tokenValue: string;
}

declare module "fastify" {
  interface FastifyRequest {
    parent?: ParentUser;
    sofi?: SofiContext;
  }
}

export async function requireParent(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = readParentCookie(req);
  if (!userId) {
    reply.code(401).send({ ok: false, reason: "unauthenticated" });
    return;
  }
  const { rows } = await query<{ id: string; email: string; role: string; revoked_at: Date | null }>(
    `SELECT id, email, role, revoked_at FROM users WHERE id = $1`,
    [userId]
  );
  if (rows.length === 0 || rows[0].revoked_at || rows[0].role !== "parent") {
    reply.code(401).send({ ok: false, reason: "unauthorized" });
    return;
  }
  req.parent = { id: rows[0].id, email: rows[0].email, role: "parent" };
}

export async function requireSofi(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const tokenValue = readSofiCookie(req);
  if (!tokenValue) {
    reply.code(401).send({ ok: false, reason: "unauthenticated" });
    return;
  }
  const { rows } = await query<{ id: string; revoked_at: Date | null }>(
    `SELECT id, revoked_at FROM sofi_tokens WHERE token = $1`,
    [tokenValue]
  );
  if (rows.length === 0 || rows[0].revoked_at) {
    reply.code(401).send({ ok: false, reason: "unauthorized" });
    return;
  }
  req.sofi = { tokenId: rows[0].id, tokenValue };
}
