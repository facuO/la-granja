import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";

const completionsCreate = vi.fn();
vi.mock("groq-sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: completionsCreate } },
  })),
}));

import { makeTestApp } from "./helpers/app.js";
import { closeTestPool, resetDb } from "./helpers/db.js";
import { applyMigrations, getSofiCookie } from "./helpers/cookies.js";
import { _clearCacheForTests } from "../src/server/services/daily-flavor.js";
import type { FastifyInstance } from "fastify";

function mockGroqJson(payload: object) {
  return { choices: [{ message: { content: JSON.stringify(payload) } }] };
}

describe("GET /api/sofi/daily-flavor", () => {
  let app: FastifyInstance;
  let sofiCookie: string;

  beforeAll(async () => {
    app = await makeTestApp();
  });

  beforeEach(async () => {
    await resetDb();
    await applyMigrations();
    completionsCreate.mockReset();
    _clearCacheForTests();
    sofiCookie = await getSofiCookie(app);
  });

  afterAll(async () => {
    await app.close();
    await closeTestPool();
  });

  it("rejects sin cookie de Sofi", async () => {
    const res = await app.inject({ method: "GET", url: "/api/sofi/daily-flavor?date=2026-06-15" });
    expect(res.statusCode).toBe(401);
  });

  it("devuelve flavor con paleta, animal, miniEvent", async () => {
    completionsCreate.mockResolvedValue(mockGroqJson({
      animalOfDay: "vaca",
      miniEvent: { type: "npc-pollito", world: "corral", text: "Un pollito te saluda." },
    }));
    const res = await app.inject({
      method: "GET",
      url: "/api/sofi/daily-flavor?date=2026-06-15",
      headers: { cookie: sofiCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.date).toBe("2026-06-15");
    expect(body.season).toBe("invierno");
    expect(body.palette.corral.sky).toHaveLength(3);
    expect(body.animalOfDay.id).toBe("vaca");
    expect(body.miniEvent.world).toBe("corral");
  });

  it("dispara specialEvent en el cumple de Sofi 7/4", async () => {
    completionsCreate.mockResolvedValue(mockGroqJson({
      animalOfDay: "gallina",
      miniEvent: { type: "egg-color", world: "corral", text: "Un huevo rosa apareció." },
    }));
    const res = await app.inject({
      method: "GET",
      url: "/api/sofi/daily-flavor?date=2026-04-07",
      headers: { cookie: sofiCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.specialEvent.id).toBe("cumple-sofi");
    expect(body.specialEvent.banner).toContain("Sofi");
  });

  it("acepta sin date param y usa fecha actual", async () => {
    completionsCreate.mockResolvedValue(mockGroqJson({
      animalOfDay: "oveja",
      miniEvent: { type: "npc-pollito", world: "campo", text: "Un pollito amigo te espera." },
    }));
    const res = await app.inject({
      method: "GET",
      url: "/api/sofi/daily-flavor",
      headers: { cookie: sofiCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("rejecta date param con formato inválido", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/sofi/daily-flavor?date=no-soy-fecha",
      headers: { cookie: sofiCookie },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejecta date param con overflow (2026-13-99)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/sofi/daily-flavor?date=2026-13-99",
      headers: { cookie: sofiCookie },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejecta date param con día inválido para el mes (2026-02-30)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/sofi/daily-flavor?date=2026-02-30",
      headers: { cookie: sofiCookie },
    });
    expect(res.statusCode).toBe(400);
  });
});
