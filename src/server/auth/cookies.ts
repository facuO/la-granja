import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";

export function setParentCookie(reply: FastifyReply, userId: string): void {
  reply.setCookie(config.sessionCookieName, userId, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
    signed: true,
    path: "/",
    maxAge: config.parentCookieMaxDays * 24 * 60 * 60,
  });
}

export function setSofiCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(config.sofiCookieName, token, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
    signed: true,
    path: "/",
    maxAge: config.sofiCookieMaxDays * 24 * 60 * 60,
  });
}

export function readParentCookie(req: FastifyRequest): string | null {
  const raw = req.cookies[config.sessionCookieName];
  if (!raw) return null;
  const unsigned = req.unsignCookie(raw);
  return unsigned.valid ? unsigned.value : null;
}

export function readSofiCookie(req: FastifyRequest): string | null {
  const raw = req.cookies[config.sofiCookieName];
  if (!raw) return null;
  const unsigned = req.unsignCookie(raw);
  return unsigned.valid ? unsigned.value : null;
}

export function clearAuthCookies(reply: FastifyReply): void {
  reply.clearCookie(config.sessionCookieName, { path: "/" });
  reply.clearCookie(config.sofiCookieName, { path: "/" });
}
