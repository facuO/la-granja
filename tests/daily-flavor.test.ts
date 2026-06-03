import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock del SDK de Groq igual que en sofi-chat.test.ts
const completionsCreate = vi.fn();
vi.mock("groq-sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: completionsCreate } },
  })),
}));

import { getDailyFlavor, _clearCacheForTests } from "../src/server/services/daily-flavor.js";

function mockGroqJson(payload: object) {
  return { choices: [{ message: { content: JSON.stringify(payload) } }] };
}

describe("getDailyFlavor", () => {
  beforeEach(() => {
    completionsCreate.mockReset();
    _clearCacheForTests();
  });

  it("incluye paleta determinística por estación", async () => {
    completionsCreate.mockResolvedValue(mockGroqJson({
      animalOfDay: "vaca",
      miniEvent: { type: "npc-pollito", world: "corral", text: "Un pollito te saluda." },
    }));
    const r = await getDailyFlavor(new Date(2026, 5, 15)); // invierno
    expect(r.season).toBe("invierno");
    expect(r.palette.corral.sky).toHaveLength(3);
    expect(r.palette.campo.sky).toHaveLength(3);
    expect(r.palette.estanque.sky).toHaveLength(3);
    expect(r.palette.granero.sky).toHaveLength(3);
  });

  it("paletas de invierno vs verano son distintas", async () => {
    completionsCreate.mockResolvedValue(mockGroqJson({
      animalOfDay: "vaca",
      miniEvent: { type: "npc-pollito", world: "corral", text: "Un pollito te saluda." },
    }));
    const invierno = await getDailyFlavor(new Date(2026, 5, 15));
    _clearCacheForTests();
    const verano = await getDailyFlavor(new Date(2026, 11, 15));
    expect(invierno.palette.corral.sky[0]).not.toEqual(verano.palette.corral.sky[0]);
  });

  it("incluye specialEvent cuando aplica", async () => {
    completionsCreate.mockResolvedValue(mockGroqJson({
      animalOfDay: "gallina",
      miniEvent: { type: "egg-color", world: "corral", text: "Un huevo rosa apareció." },
    }));
    const r = await getDailyFlavor(new Date(2026, 3, 7)); // cumple Sofi
    expect(r.specialEvent?.id).toBe("cumple-sofi");
  });

  it("specialEvent es null en día normal", async () => {
    completionsCreate.mockResolvedValue(mockGroqJson({
      animalOfDay: "oveja",
      miniEvent: { type: "extra-flower", world: "campo", text: "Flores nuevas en el campo." },
    }));
    const r = await getDailyFlavor(new Date(2026, 5, 15));
    expect(r.specialEvent).toBeNull();
  });

  it("usa Groq para animalOfDay y miniEvent cuando responde OK", async () => {
    completionsCreate.mockResolvedValue(mockGroqJson({
      animalOfDay: "pato",
      miniEvent: { type: "hat-on-animal", world: "estanque", text: "El pato trae un sombrero." },
    }));
    const r = await getDailyFlavor(new Date(2026, 5, 15));
    expect(r.animalOfDay.id).toBe("pato");
    expect(r.animalOfDay.appearsIn).toBe("estanque");
    expect(r.miniEvent.text).toBe("El pato trae un sombrero.");
    expect(completionsCreate).toHaveBeenCalledOnce();
  });

  it("usa fallback cuando Groq rechaza", async () => {
    completionsCreate.mockRejectedValue(new Error("groq down"));
    const r = await getDailyFlavor(new Date(2026, 5, 15));
    expect(r.animalOfDay.id).toMatch(/^(vaca|oveja|gallina|caballo|pato|cerdo|cabra)$/);
    expect(r.miniEvent.text.length).toBeGreaterThan(0);
    expect(r.miniEvent.text.length).toBeLessThanOrEqual(100);
  });

  it("usa fallback cuando Groq devuelve JSON inválido", async () => {
    completionsCreate.mockResolvedValue({ choices: [{ message: { content: "no json {{" } }] });
    const r = await getDailyFlavor(new Date(2026, 5, 15));
    expect(r.animalOfDay.id).toMatch(/^(vaca|oveja|gallina|caballo|pato|cerdo|cabra)$/);
  });

  it("usa fallback cuando schema validation falla (animal inválido)", async () => {
    completionsCreate.mockResolvedValue(mockGroqJson({
      animalOfDay: "dragón",
      miniEvent: { type: "npc-pollito", world: "corral", text: "ok" },
    }));
    const r = await getDailyFlavor(new Date(2026, 5, 15));
    expect(r.animalOfDay.id).not.toBe("dragón");
  });

  it("cachea por fecha — segundo call con misma fecha NO llama Groq de nuevo", async () => {
    completionsCreate.mockResolvedValue(mockGroqJson({
      animalOfDay: "cabra",
      miniEvent: { type: "npc-pollito", world: "campo", text: "Un pollito te saluda." },
    }));
    const r1 = await getDailyFlavor(new Date(2026, 5, 15));
    const r2 = await getDailyFlavor(new Date(2026, 5, 15));
    expect(completionsCreate).toHaveBeenCalledOnce();
    expect(r1).toBe(r2);
  });

  it("fechas distintas → llamadas distintas a Groq", async () => {
    completionsCreate.mockResolvedValue(mockGroqJson({
      animalOfDay: "vaca",
      miniEvent: { type: "npc-pollito", world: "corral", text: "ok" },
    }));
    await getDailyFlavor(new Date(2026, 5, 15));
    await getDailyFlavor(new Date(2026, 5, 16));
    expect(completionsCreate).toHaveBeenCalledTimes(2);
  });

  it("usa fallback cuando Groq tarda más de 3s", async () => {
    completionsCreate.mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve(mockGroqJson({
        animalOfDay: "vaca", miniEvent: { type: "npc-pollito", world: "corral", text: "x" },
      })), 5000);
    }));
    const r = await getDailyFlavor(new Date(2026, 5, 15));
    expect(r.animalOfDay.id).toMatch(/^(vaca|oveja|gallina|caballo|pato|cerdo|cabra)$/);
  }, 6000);

  it("fallback NO se cachea — segundo call reintenta Groq", async () => {
    // Primera llamada: Groq falla, usa fallback
    completionsCreate.mockRejectedValueOnce(new Error("groq down"));
    const r1 = await getDailyFlavor(new Date(2026, 5, 15));
    expect(r1.animalOfDay.id).toMatch(/^(vaca|oveja|gallina|caballo|pato|cerdo|cabra)$/);
    expect(completionsCreate).toHaveBeenCalledOnce();

    // Segunda llamada: Groq responde OK → debería volver a llamar (no usar cache)
    completionsCreate.mockResolvedValueOnce(mockGroqJson({
      animalOfDay: "vaca",
      miniEvent: { type: "npc-pollito", world: "corral", text: "Un pollito te saluda." },
    }));
    const r2 = await getDailyFlavor(new Date(2026, 5, 15));
    expect(completionsCreate).toHaveBeenCalledTimes(2);
    expect(r2.miniEvent.text).toBe("Un pollito te saluda.");
  });

  it("animalOfDay.name es display capitalizado, no el id lowercase", async () => {
    completionsCreate.mockResolvedValue(mockGroqJson({
      animalOfDay: "vaca",
      miniEvent: { type: "npc-pollito", world: "corral", text: "Hola." },
    }));
    const r = await getDailyFlavor(new Date(2026, 5, 15));
    expect(r.animalOfDay.id).toBe("vaca");
    expect(r.animalOfDay.name).toBe("Vaca");
  });
});
