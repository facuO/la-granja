// GROQ_API_KEY se setea en `tests/setup.ts` (vitest setupFiles). Como
// `config.ts` resuelve la key al importarse, tiene que estar disponible
// antes de cualquier import — el setup file corre antes que los tests.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";

// Mock del SDK de Groq. Tiene que estar antes de cualquier import que llegue
// a real-chat.ts. `vi.mock` está hoisted.
const completionsCreate = vi.fn();
vi.mock("groq-sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: { completions: { create: completionsCreate } },
    })),
  };
});

import { makeTestApp } from "./helpers/app.js";
import { testPool, closeTestPool, resetDb } from "./helpers/db.js";
import { applyMigrations, getSofiCookie } from "./helpers/cookies.js";
import type { FastifyInstance } from "fastify";

/** Devuelve la shape esperada del cliente Groq cuando `response_format: json_object`. */
function mockGroqJsonResponse(text: string) {
  return {
    choices: [{ message: { content: JSON.stringify({ text }) } }],
  };
}

describe("POST /api/sofi/chat", () => {
  let app: FastifyInstance;
  let sofiCookie: string;

  beforeAll(async () => {
    app = await makeTestApp();
  });

  beforeEach(async () => {
    await resetDb();
    await applyMigrations();
    completionsCreate.mockReset();
    sofiCookie = await getSofiCookie(app);
  });

  afterAll(async () => {
    await app.close();
    await closeTestPool();
  });

  it("rejects without sofi cookie", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/sofi/chat",
      payload: { message: "Hola" },
    });
    expect(res.statusCode).toBe(401);
    expect(completionsCreate).not.toHaveBeenCalled();
  });

  it("rejects when message is missing (schema validation)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/sofi/chat",
      headers: { cookie: sofiCookie },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(completionsCreate).not.toHaveBeenCalled();
  });

  it("rejects when message is empty string", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/sofi/chat",
      headers: { cookie: sofiCookie },
      payload: { message: "" },
    });
    expect(res.statusCode).toBe(400);
    expect(completionsCreate).not.toHaveBeenCalled();
  });

  it("happy path: returns { text, phrase } with tokenized response", async () => {
    completionsCreate.mockResolvedValueOnce(
      mockGroqJsonResponse("Argentina es un país. Está en Sudamérica.")
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/sofi/chat",
      headers: { cookie: sofiCookie },
      payload: { message: "¿Qué es Argentina?" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.text).toBe("Argentina es un país. Está en Sudamérica.");
    expect(Array.isArray(body.phrase)).toBe(true);
    // El tokenizer agrega units con `word` o `break`. Al menos un word.
    const hasWord = body.phrase.some((u: { word?: string }) => typeof u.word === "string");
    expect(hasWord).toBe(true);
  });

  it("passes history + new message to the LLM with system prompt", async () => {
    completionsCreate.mockResolvedValueOnce(mockGroqJsonResponse("Ok."));

    await app.inject({
      method: "POST",
      url: "/api/sofi/chat",
      headers: { cookie: sofiCookie },
      payload: {
        history: [
          { role: "user", content: "Hola" },
          { role: "assistant", content: "Hola Sofi." },
        ],
        message: "¿Cómo estás?",
      },
    });

    expect(completionsCreate).toHaveBeenCalledTimes(1);
    const arg = completionsCreate.mock.calls[0][0];
    expect(arg.response_format).toEqual({ type: "json_object" });

    const msgs: { role: string; content: string }[] = arg.messages;
    // System prompt + history + nuevo mensaje.
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("REGLAS NO NEGOCIABLES");
    expect(msgs[1]).toEqual({ role: "user", content: "Hola" });
    expect(msgs[2]).toEqual({ role: "assistant", content: "Hola Sofi." });
    expect(msgs[3]).toEqual({ role: "user", content: "¿Cómo estás?" });
  });

  it("trims history to the last 12 turns", async () => {
    completionsCreate.mockResolvedValueOnce(mockGroqJsonResponse("Ok."));

    // 20 turnos en history.
    const history = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `turno-${i}`,
    }));

    await app.inject({
      method: "POST",
      url: "/api/sofi/chat",
      headers: { cookie: sofiCookie },
      payload: { history, message: "nuevo" },
    });

    const arg = completionsCreate.mock.calls[0][0];
    const msgs: { role: string; content: string }[] = arg.messages;
    // 1 system + 12 history + 1 new user = 14
    expect(msgs.length).toBe(14);
    // Los últimos 12 turnos: turno-8 .. turno-19
    expect(msgs[1].content).toBe("turno-8");
    expect(msgs[12].content).toBe("turno-19");
    expect(msgs[13].content).toBe("nuevo");
  });

  it("returns 500 when LLM throws", async () => {
    completionsCreate.mockRejectedValueOnce(new Error("groq exploded"));

    const res = await app.inject({
      method: "POST",
      url: "/api/sofi/chat",
      headers: { cookie: sofiCookie },
      payload: { message: "Hola" },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ ok: false, reason: "groq exploded" });
  });

  it("returns 500 when LLM returns invalid JSON", async () => {
    completionsCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "not-json-at-all" } }],
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/sofi/chat",
      headers: { cookie: sofiCookie },
      payload: { message: "Hola" },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json().reason).toContain("JSON");
  });

  it("returns 500 when LLM returns empty content", async () => {
    completionsCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "" } }],
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/sofi/chat",
      headers: { cookie: sofiCookie },
      payload: { message: "Hola" },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json().reason).toContain("vacía");
  });

  it("returns 500 when LLM JSON has no `text` field", async () => {
    completionsCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ otro: "valor" }) } }],
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/sofi/chat",
      headers: { cookie: sofiCookie },
      payload: { message: "Hola" },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json().reason).toContain("text");
  });
});
