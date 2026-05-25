import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";

// IMPORTANT: el mock se setea ANTES de importar nada que llegue a real-tutor.
// `vi.mock` está hoisted por vitest, así que aplica antes de los imports.
vi.mock("../src/server/llm/groq.js", () => ({
  chatJson: vi.fn(),
}));

import { makeTestApp } from "./helpers/app.js";
import { testPool, closeTestPool, resetDb } from "./helpers/db.js";
import { applyMigrations, getParentCookie, getSofiCookie } from "./helpers/cookies.js";
import { chatJson } from "../src/server/llm/groq.js";
import type { FastifyInstance } from "fastify";

// IDs sembrados por las migrations
// - seed-dev-data.cjs crea TOPIC_DONE (status 'done' después de la clase4)
// - clase4-geografia.cjs crea TOPIC_FEATURED (status 'featured')
// - seed-dev-data.cjs crea TOPIC_UPCOMING (status 'upcoming')
const TOPIC_FEATURED = "44444444-4444-4444-4444-444444444401"; // Países limítrofes (featured)
const TOPIC_DONE = "33333333-3333-3333-3333-333333333332"; // Provincias y regiones (done)
const TOPIC_UPCOMING = "33333333-3333-3333-3333-333333333334"; // Relieves y climas (upcoming)
const SUBJECT_SOCIALES = "11111111-1111-1111-1111-111111111111";

/** Una respuesta válida del LLM para `validateResponse` en real-tutor.ts. */
function validLlmResponse() {
  return {
    blocks: [
      { kind: "explanation", text: "Las provincias son partes de Argentina." },
      { kind: "explanation", text: "Cada provincia tiene un gobernador." },
      { kind: "explanation", text: "Argentina tiene 23 provincias." },
      { kind: "explanation", text: "También tiene CABA." },
      { kind: "explanation", text: "Las regiones agrupan provincias por geografía." },
      {
        kind: "question",
        question: "multiple_choice",
        text: "¿Cuántas provincias tiene Argentina?",
        options: ["22", "23", "24"],
        correct_index: 1,
      },
      { kind: "feedback", text: "Acertaste. Argentina tiene 23 provincias." },
    ],
  };
}

describe("admin topics endpoints", () => {
  let app: FastifyInstance;
  let parentCookie: string;

  beforeAll(async () => {
    app = await makeTestApp();
  });

  beforeEach(async () => {
    await resetDb();
    await applyMigrations();
    vi.mocked(chatJson).mockReset();
    parentCookie = await getParentCookie(app);
  });

  afterAll(async () => {
    await app.close();
    await closeTestPool();
  });

  describe("GET /api/admin/topics", () => {
    it("rejects without parent cookie", async () => {
      const res = await app.inject({ method: "GET", url: "/api/admin/topics" });
      expect(res.statusCode).toBe(401);
    });

    it("rejects sofi cookie (parent-only endpoint)", async () => {
      const sofiCookie = await getSofiCookie(app);
      const res = await app.inject({
        method: "GET",
        url: "/api/admin/topics",
        headers: { cookie: sofiCookie },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns all topics with subject_name and generation status", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/admin/topics",
        headers: { cookie: parentCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body.topics)).toBe(true);
      expect(body.topics.length).toBeGreaterThan(0);

      const topic = body.topics.find((t: { id: string }) => t.id === TOPIC_FEATURED);
      expect(topic).toBeDefined();
      // Estructura: id, title, description, status, subject_name, generated_at, generated_by_model, block_count
      expect(topic).toMatchObject({
        id: TOPIC_FEATURED,
        title: expect.any(String),
        status: "featured",
        subject_name: "Ciencias Sociales",
      });
      // Sin contenido generado todavía.
      expect(topic.generated_at).toBeNull();
      expect(topic.generated_by_model).toBeNull();
      expect(topic.block_count).toBeNull();
    });

    it("includes block_count once generated_blocks is populated", async () => {
      // Inyectamos generated_blocks directamente.
      await testPool.query(
        `UPDATE topics
            SET generated_blocks = $2::jsonb,
                generated_at = now(),
                generated_by_model = 'test-model'
          WHERE id = $1`,
        [
          TOPIC_FEATURED,
          JSON.stringify([
            { block_kind: "explanation", content: { text: "Hola" } },
            { block_kind: "explanation", content: { text: "Mundo" } },
          ]),
        ]
      );

      const res = await app.inject({
        method: "GET",
        url: "/api/admin/topics",
        headers: { cookie: parentCookie },
      });
      const body = res.json();
      const topic = body.topics.find((t: { id: string }) => t.id === TOPIC_FEATURED);
      expect(topic.block_count).toBe(2);
      expect(topic.generated_by_model).toBe("test-model");
      expect(topic.generated_at).not.toBeNull();
    });
  });

  describe("POST /api/admin/topics/:id/generate", () => {
    it("rejects without parent cookie", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/admin/topics/${TOPIC_FEATURED}/generate`,
      });
      expect(res.statusCode).toBe(401);
      // chatJson nunca debería llamarse.
      expect(chatJson).not.toHaveBeenCalled();
    });

    it("rejects invalid uuid", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/admin/topics/not-a-uuid/generate",
        headers: { cookie: parentCookie },
      });
      expect(res.statusCode).toBe(400);
      expect(chatJson).not.toHaveBeenCalled();
    });

    it("happy path: persists generated_blocks + generated_at + model", async () => {
      vi.mocked(chatJson).mockResolvedValueOnce(validLlmResponse());

      const res = await app.inject({
        method: "POST",
        url: `/api/admin/topics/${TOPIC_FEATURED}/generate`,
        headers: { cookie: parentCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.ok).toBe(true);
      expect(body.block_count).toBe(7);
      expect(typeof body.model).toBe("string");

      // chatJson fue llamado una vez con system + user prompts.
      expect(chatJson).toHaveBeenCalledTimes(1);
      const arg = vi.mocked(chatJson).mock.calls[0][0];
      expect(arg.system).toContain("REGLAS NO NEGOCIABLES");
      expect(arg.user).toContain("TEMA:");
      expect(arg.user).toContain("Países limítrofes");

      // Persistencia en DB.
      const { rows } = await testPool.query<{
        generated_blocks: unknown;
        generated_at: Date | null;
        generated_by_model: string | null;
      }>(
        `SELECT generated_blocks, generated_at, generated_by_model FROM topics WHERE id = $1`,
        [TOPIC_FEATURED]
      );
      expect(rows[0].generated_blocks).not.toBeNull();
      expect(Array.isArray(rows[0].generated_blocks)).toBe(true);
      expect(rows[0].generated_at).not.toBeNull();
      expect(rows[0].generated_by_model).toBeTruthy();
    });

    it("returns 500 when LLM throws", async () => {
      vi.mocked(chatJson).mockRejectedValueOnce(new Error("Groq devolvió respuesta vacía"));

      const res = await app.inject({
        method: "POST",
        url: `/api/admin/topics/${TOPIC_FEATURED}/generate`,
        headers: { cookie: parentCookie },
      });
      expect(res.statusCode).toBe(500);
      expect(res.json()).toMatchObject({ ok: false, reason: "Groq devolvió respuesta vacía" });

      // No persistió nada.
      const { rows } = await testPool.query(
        `SELECT generated_blocks FROM topics WHERE id = $1`,
        [TOPIC_FEATURED]
      );
      expect(rows[0].generated_blocks).toBeNull();
    });

    it("returns 500 with topic_not_found when topic doesn't exist", async () => {
      vi.mocked(chatJson).mockResolvedValueOnce(validLlmResponse());
      // UUID válido pero inexistente.
      const fakeId = "99999999-9999-9999-9999-999999999999";
      const res = await app.inject({
        method: "POST",
        url: `/api/admin/topics/${fakeId}/generate`,
        headers: { cookie: parentCookie },
      });
      // generateTopicBlocks tira "topic_not_found" antes de llamar al LLM.
      expect(res.statusCode).toBe(500);
      expect(res.json().reason).toBe("topic_not_found");
      expect(chatJson).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /api/admin/topics/:id/generated", () => {
    it("rejects without parent cookie", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/api/admin/topics/${TOPIC_FEATURED}/generated`,
      });
      expect(res.statusCode).toBe(401);
    });

    it("rejects invalid uuid", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/admin/topics/not-a-uuid/generated",
        headers: { cookie: parentCookie },
      });
      expect(res.statusCode).toBe(400);
    });

    it("clears generated_blocks/generated_at/generated_by_model", async () => {
      // Sembrar contenido generado.
      await testPool.query(
        `UPDATE topics
            SET generated_blocks = '[{"block_kind":"explanation","content":{"text":"x"}}]'::jsonb,
                generated_at = now(),
                generated_by_model = 'test-model'
          WHERE id = $1`,
        [TOPIC_FEATURED]
      );
      const before = await testPool.query(
        `SELECT generated_blocks IS NOT NULL AS has FROM topics WHERE id = $1`,
        [TOPIC_FEATURED]
      );
      expect(before.rows[0].has).toBe(true);

      const res = await app.inject({
        method: "DELETE",
        url: `/api/admin/topics/${TOPIC_FEATURED}/generated`,
        headers: { cookie: parentCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ ok: true });

      const after = await testPool.query<{
        gb: unknown;
        ga: Date | null;
        gm: string | null;
      }>(
        `SELECT generated_blocks AS gb, generated_at AS ga, generated_by_model AS gm
           FROM topics WHERE id = $1`,
        [TOPIC_FEATURED]
      );
      expect(after.rows[0].gb).toBeNull();
      expect(after.rows[0].ga).toBeNull();
      expect(after.rows[0].gm).toBeNull();
    });

    it("is idempotent (DELETE on a topic without generated content)", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/api/admin/topics/${TOPIC_FEATURED}/generated`,
        headers: { cookie: parentCookie },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("session uses generated_blocks when available", () => {
    it("startSession snapshots generated_blocks into session.metadata.blocks", async () => {
      // Inyectar generated_blocks que difieren del stub para detectar cuál se usó.
      const customBlocks = [
        { block_kind: "explanation", content: { text: "Bloque generado A" } },
        { block_kind: "explanation", content: { text: "Bloque generado B" } },
        { block_kind: "feedback", content: { text: "Cierre", tone: "positive" } },
      ];
      await testPool.query(
        `UPDATE topics
            SET generated_blocks = $2::jsonb,
                generated_at = now(),
                generated_by_model = 'test-model'
          WHERE id = $1`,
        [TOPIC_FEATURED, JSON.stringify(customBlocks)]
      );

      const sofiCookie = await getSofiCookie(app);
      const start = await app.inject({
        method: "POST",
        url: "/api/sofi/sessions",
        headers: { cookie: sofiCookie },
        payload: { topic_id: TOPIC_FEATURED },
      });
      expect(start.statusCode).toBe(201);
      const sessionId = start.json().session_id;
      expect(start.json().steps_planned).toBe(customBlocks.length);

      // Verificar que metadata.blocks contiene el snapshot de los generated_blocks.
      const { rows } = await testPool.query<{
        metadata: { blocks?: unknown[] };
        subject_id: string;
      }>(`SELECT metadata, subject_id FROM sessions WHERE id = $1`, [sessionId]);
      expect(rows[0].metadata).toBeDefined();
      expect(rows[0].metadata.blocks).toBeDefined();
      expect(Array.isArray(rows[0].metadata.blocks)).toBe(true);
      expect(rows[0].metadata.blocks).toHaveLength(customBlocks.length);
      expect(rows[0].metadata.blocks![0]).toMatchObject({
        block_kind: "explanation",
        content: { text: "Bloque generado A" },
      });
      expect(rows[0].subject_id).toBe(SUBJECT_SOCIALES);

      // next-block sirve los bloques del snapshot (no del stub).
      const first = await app.inject({
        method: "POST",
        url: `/api/sofi/sessions/${sessionId}/next-block`,
        headers: { cookie: sofiCookie },
      });
      expect(first.statusCode).toBe(200);
      expect(first.json().block.content.text).toBe("Bloque generado A");
    });

    it("startSession on a topic without generated_blocks falls back to stub registry", async () => {
      const sofiCookie = await getSofiCookie(app);
      const start = await app.inject({
        method: "POST",
        url: "/api/sofi/sessions",
        headers: { cookie: sofiCookie },
        payload: { topic_id: TOPIC_FEATURED },
      });
      expect(start.statusCode).toBe(201);
      const sessionId = start.json().session_id;
      // El stub para "Provincias y regiones" tiene N bloques (>0).
      expect(start.json().steps_planned).toBeGreaterThan(0);

      // metadata.blocks debe estar snapshoteado (no vacío).
      const { rows } = await testPool.query<{ metadata: { blocks?: unknown[] } }>(
        `SELECT metadata FROM sessions WHERE id = $1`,
        [sessionId]
      );
      expect(Array.isArray(rows[0].metadata.blocks)).toBe(true);
      expect(rows[0].metadata.blocks!.length).toBeGreaterThan(0);
    });

    it("topic_not_eligible still applies regardless of generated_blocks", async () => {
      // Aunque el topic upcoming tenga generated_blocks, startSession debería rechazarlo.
      await testPool.query(
        `UPDATE topics
            SET generated_blocks = '[{"block_kind":"explanation","content":{"text":"x"}}]'::jsonb
          WHERE id = $1`,
        [TOPIC_UPCOMING]
      );

      const sofiCookie = await getSofiCookie(app);
      const start = await app.inject({
        method: "POST",
        url: "/api/sofi/sessions",
        headers: { cookie: sofiCookie },
        payload: { topic_id: TOPIC_UPCOMING },
      });
      expect(start.statusCode).toBe(400);
      expect(start.json().reason).toBe("topic_not_eligible");
    });
  });
});
