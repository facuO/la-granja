import type { FastifyPluginAsync } from "fastify";
import { requireParent } from "../auth/middleware.js";
import { query } from "../db.js";
import { sofiToken } from "../lib/ids.js";
import { config } from "../config.js";
import { generateTopicBlocks } from "../services/real-tutor.js";

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: { device_name: string } }>(
    "/api/admin/sofi-tokens",
    {
      preHandler: requireParent,
      schema: {
        body: {
          type: "object",
          required: ["device_name"],
          properties: { device_name: { type: "string", minLength: 1, maxLength: 80 } },
        },
      },
    },
    async (req, reply) => {
      const token = sofiToken();
      const { rows } = await query<{ id: string }>(
        `INSERT INTO sofi_tokens (token, device_name) VALUES ($1, $2) RETURNING id`,
        [token, req.body.device_name]
      );
      return reply.code(201).send({
        ok: true,
        id: rows[0].id,
        url: `${config.appBaseUrl}/s/${token}`,
      });
    }
  );

  fastify.get(
    "/api/admin/sofi-tokens",
    { preHandler: requireParent },
    async () => {
      const { rows } = await query(
        `SELECT id, device_name, created_at, revoked_at
           FROM sofi_tokens
          ORDER BY created_at DESC`
      );
      return { tokens: rows };
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    "/api/admin/sofi-tokens/:id",
    {
      preHandler: requireParent,
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (req, reply) => {
      await query(
        `UPDATE sofi_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`,
        [req.params.id]
      );
      return reply.code(200).send({ ok: true });
    }
  );

  // Trigger LLM generation of pedagogical blocks for a topic.
  // Reads topic.title + description + key_concepts from DB, calls Groq,
  // validates the response, and persists into topic.generated_blocks.
  fastify.post<{ Params: { id: string } }>(
    "/api/admin/topics/:id/generate",
    {
      preHandler: requireParent,
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
        const result = await generateTopicBlocks(req.params.id);
        return reply.code(200).send({
          ok: true,
          block_count: result.blocks.length,
          model: result.model,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown";
        req.log.error({ err }, "topic generation failed");
        return reply.code(500).send({ ok: false, reason: msg });
      }
    }
  );
};
