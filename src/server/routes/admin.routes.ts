import type { FastifyPluginAsync } from "fastify";
import { requireParent } from "../auth/middleware.js";
import { setParentCookie } from "../auth/cookies.js";
import { query } from "../db.js";
import { sofiToken } from "../lib/ids.js";
import { config } from "../config.js";
import { generateTopicBlocks, validateResponse, rawToBlock, type RawBlock } from "../services/real-tutor.js";
import { HAND_CRAFTED_TOPIC_IDS } from "../services/stub-tutor.js";
import { enrichPhrase } from "../services/arasaac.js";

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // Login simple por password (single-tenant). Si match, levanta el user
  // de Papá (creado en la primera magic link) y setea el cookie igual
  // que el flow de magic link.
  fastify.post<{ Body: { password: string } }>(
    "/api/admin/password-login",
    {
      schema: {
        body: {
          type: "object",
          required: ["password"],
          properties: { password: { type: "string", minLength: 1, maxLength: 100 } },
        },
      },
    },
    async (req, reply) => {
      if (req.body.password !== config.adminPassword) {
        return reply.code(401).send({ ok: false, reason: "bad_password" });
      }
      // Single-tenant: el user de Papá es el que tiene PARENT_EMAIL.
      // Si no existe (nunca pidió magic link), lo creamos al vuelo.
      // users.name es NOT NULL — defaulteamos a 'Papá' en alta. En conflict
      // no pisamos el name por si la magic-link route ya lo había seteado.
      const { rows } = await query<{ id: string }>(
        `INSERT INTO users (email, name, role) VALUES ($1, 'Papá', 'parent')
         ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
         RETURNING id`,
        [config.parentEmail],
      );
      const userId = rows[0].id;
      setParentCookie(reply, userId);
      return reply.send({ ok: true });
    },
  );

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

  // List all topics with their generation status.
  fastify.get(
    "/api/admin/topics",
    { preHandler: requireParent },
    async () => {
      const { rows } = await query<{
        id: string;
        title: string;
        description: string;
        status: string;
        subject_name: string;
        generated_at: Date | null;
        generated_by_model: string | null;
        block_count: number | null;
      }>(
        `SELECT t.id, t.title, t.description, t.status,
                s.name AS subject_name,
                t.generated_at, t.generated_by_model,
                CASE
                  WHEN t.generated_blocks IS NULL THEN NULL
                  ELSE jsonb_array_length(t.generated_blocks)
                END AS block_count
           FROM topics t
           JOIN blocks b ON b.id = t.block_id
           JOIN subjects s ON s.id = b.subject_id
           WHERE s.active = true
           ORDER BY s.name, b.order_index, t.order_index`,
      );
      return { topics: rows };
    }
  );

  // Generación batch: corre el LLM secuencialmente sobre todos los topics
  // activos que no tienen generated_blocks ni están en HAND_CRAFTED_TOPIC_IDS.
  // Sincrónico — puede tardar varios minutos. Devuelve el resumen al final.
  // Idempotente: re-correr salta los ya generados.
  fastify.post(
    "/api/admin/topics/generate-missing",
    { preHandler: requireParent },
    async (req, reply) => {
      // Lista topics sin contenido (ni stub hand-crafted ni generated)
      const handCraftedClause = HAND_CRAFTED_TOPIC_IDS.length > 0
        ? `AND t.id::text NOT IN (${HAND_CRAFTED_TOPIC_IDS.map((_, i) => `$${i + 1}`).join(", ")})`
        : "";
      const { rows: empties } = await query<{ id: string; title: string; subject_name: string }>(
        `SELECT t.id, t.title, s.name AS subject_name
           FROM topics t
           JOIN blocks b ON b.id = t.block_id
           JOIN subjects s ON s.id = b.subject_id
          WHERE s.active = true
            AND t.generated_blocks IS NULL
            ${handCraftedClause}
          ORDER BY s.name, b.order_index, t.order_index`,
        HAND_CRAFTED_TOPIC_IDS,
      );

      const results: Array<{
        id: string;
        title: string;
        subject: string;
        ok: boolean;
        block_count?: number;
        error?: string;
      }> = [];

      for (const t of empties) {
        try {
          const r = await generateTopicBlocks(t.id);
          results.push({
            id: t.id,
            title: t.title,
            subject: t.subject_name,
            ok: true,
            block_count: r.blocks.length,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "unknown";
          req.log.error({ err, topic_id: t.id }, "topic generation failed in batch");
          results.push({
            id: t.id,
            title: t.title,
            subject: t.subject_name,
            ok: false,
            error: msg,
          });
        }
      }

      return reply.code(200).send({
        ok: true,
        total: empties.length,
        succeeded: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        results,
      });
    },
  );

  // Inyectar blocks pre-generados (por Opus en dev, o cualquier otra source).
  // Pasa por el MISMO validator + tokenizer ARASAAC que la generación con Groq.
  // El campo `model_name` queda registrado en generated_by_model para
  // trazabilidad (ej. 'claude-opus-4-7-dev' o 'manual').
  fastify.post<{
    Params: { id: string };
    Body: { blocks: RawBlock[]; model_name?: string };
  }>(
    "/api/admin/topics/:id/set-blocks",
    {
      preHandler: requireParent,
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["blocks"],
          properties: {
            blocks: { type: "array", minItems: 5, maxItems: 30 },
            model_name: { type: "string", maxLength: 100 },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        // Mismo validator que usa generateTopicBlocks — enforza apertura,
        // cierre concreto, question→feedback adyacente, voseo, etc.
        const rawBlocks = validateResponse({ blocks: req.body.blocks });
        const stubBlocks = rawBlocks.map(rawToBlock);

        // Enriquecer pictogramas ARASAAC (cache DB + API).
        for (const block of stubBlocks) {
          const phrase = "phrase" in block.content ? block.content.phrase : undefined;
          if (Array.isArray(phrase)) await enrichPhrase(phrase);
        }

        const modelName = req.body.model_name ?? "manual";
        const { rows } = await query<{ id: string }>(
          `UPDATE topics
              SET generated_blocks = $2,
                  generated_at = now(),
                  generated_by_model = $3
            WHERE id = $1
            RETURNING id`,
          [req.params.id, JSON.stringify(stubBlocks), modelName],
        );
        if (rows.length === 0) {
          return reply.code(404).send({ ok: false, reason: "topic_not_found" });
        }
        return reply.code(200).send({
          ok: true,
          block_count: stubBlocks.length,
          model: modelName,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown";
        req.log.error({ err }, "set-blocks failed");
        return reply.code(400).send({ ok: false, reason: msg });
      }
    },
  );

  // Clear generated content (revert to stub or default).
  fastify.delete<{ Params: { id: string } }>(
    "/api/admin/topics/:id/generated",
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
        `UPDATE topics
            SET generated_blocks = NULL,
                generated_at = NULL,
                generated_by_model = NULL
          WHERE id = $1`,
        [req.params.id],
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
