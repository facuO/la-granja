import type { FastifyPluginAsync } from "fastify";
import { query } from "../db.js";
import { setSofiCookie } from "../auth/cookies.js";
import { requireSofi } from "../auth/middleware.js";
import { getSubjectsForSofi } from "../services/subjects.js";
import { startSession, nextBlock, finishSession } from "../services/sessions.js";

export const sofiRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { token: string } }>("/s/:token", async (req, reply) => {
    const { rows } = await query<{ id: string; revoked_at: Date | null }>(
      `SELECT id, revoked_at FROM sofi_tokens WHERE token = $1`,
      [req.params.token]
    );

    if (rows.length === 0 || rows[0].revoked_at) {
      return reply.code(401).type("text/html").send(`
        <html><body>
          <p>Este link no funciona. Pedile a Papá uno nuevo.</p>
        </body></html>
      `);
    }

    setSofiCookie(reply, req.params.token);
    return reply.redirect("/sofi.html");
  });

  fastify.get(
    "/api/sofi/subjects",
    { preHandler: requireSofi },
    async () => {
      const subjects = await getSubjectsForSofi({ difficultMode: false });
      return { subjects };
    }
  );

  fastify.post<{ Body: { topic_id: string } }>(
    "/api/sofi/sessions",
    {
      preHandler: requireSofi,
      schema: {
        body: {
          type: "object",
          required: ["topic_id"],
          properties: { topic_id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (req, reply) => {
      try {
        const result = await startSession({ topicId: req.body.topic_id });
        return reply.code(201).send({
          ok: true,
          session_id: result.sessionId,
          steps_planned: result.stepsPlanned,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown";
        return reply.code(400).send({ ok: false, reason: msg });
      }
    }
  );

  fastify.post<{ Params: { id: string } }>(
    "/api/sofi/sessions/:id/next-block",
    {
      preHandler: requireSofi,
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (req, reply) => {
      try {
        const result = await nextBlock(req.params.id);
        return reply.send(result);
      } catch {
        return reply.code(404).send({ ok: false, reason: "session_not_found" });
      }
    }
  );

  fastify.post<{ Params: { id: string } }>(
    "/api/sofi/sessions/:id/finish",
    {
      preHandler: requireSofi,
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (req, reply) => {
      const result = await finishSession(req.params.id);
      return reply.send(result);
    }
  );
};
