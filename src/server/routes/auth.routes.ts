import type { FastifyPluginAsync } from "fastify";
import { requestMagicLink, verifyMagicLink } from "../auth/magic-link.js";
import { setParentCookie, clearAuthCookies } from "../auth/cookies.js";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: { email: string } }>("/api/auth/request-magic-link", {
    schema: {
      body: {
        type: "object",
        required: ["email"],
        properties: { email: { type: "string", format: "email" } },
      },
    },
  }, async (req, reply) => {
    await requestMagicLink(req.body.email);
    return reply.code(200).send({ ok: true });
  });

  fastify.get<{ Querystring: { token: string } }>("/api/auth/verify", {
    schema: {
      querystring: {
        type: "object",
        required: ["token"],
        properties: { token: { type: "string", minLength: 16 } },
      },
    },
  }, async (req, reply) => {
    const result = await verifyMagicLink(req.query.token);
    if (!result.ok) {
      return reply.code(401).send({ ok: false, reason: result.reason });
    }
    setParentCookie(reply, result.userId);
    return reply.redirect("/admin.html");
  });

  fastify.post("/api/auth/logout", async (_req, reply) => {
    clearAuthCookies(reply);
    return { ok: true };
  });
};
