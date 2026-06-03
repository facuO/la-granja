# F1 — Daily Flavor foundation · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar la fase F1 del rediseño del juego del pollito: el backend que devuelve el "sabor del día" (estación + fechas especiales AR + animal del día + mini-evento con Groq + fallback estático) y el cliente que lo consume y aplica la paleta del cielo + banner de evento especial. Sin tocar gameplay.

**Architecture:**
- Backend: 2 servicios nuevos (`special-dates-ar.ts` puro + determinístico, `daily-flavor.ts` orquestador con cache in-memory y fallback). Endpoint `GET /api/sofi/daily-flavor` con Sofi-cookie.
- Frontend: 1 módulo nuevo (`juego-pollito-flavor.js`) que fetch + localStorage cache por fecha. Aplica `palette[world].sky` al `WORLDS[].theme.sky` antes de iniciar mundo. Muestra banner si hay `specialEvent`.
- Groq: usa `chatJson()` existente con prompt estricto + schema validation + timeout 3s + fallback estático pool de 20 mini-eventos.

**Tech Stack:** Node 20 + TypeScript + Fastify + Postgres + Groq SDK + vanilla JS browser + Vitest.

**Spec de referencia:** `docs/superpowers/specs/2026-06-03-pollito-game-redesign.md` (secciones 7 y 9).

---

## File Structure

```
NEW:
  src/server/services/special-dates-ar.ts     # tabla AR + cumple Sofi + estaciones + Día del Niño dinámico
  src/server/services/daily-flavor.ts         # orquestador: cache + Groq + fallback + paleta por estación×mundo
  public/js/juego-pollito-flavor.js           # fetch del endpoint, cache localStorage, aplicación al WORLDS data
  tests/special-dates-ar.test.ts              # determinístico, full coverage
  tests/daily-flavor.test.ts                  # con Groq mockeado, fallback, cache
  tests/sofi-daily-flavor.test.ts             # endpoint integración con cookie Sofi

MODIFIED:
  src/server/routes/sofi.routes.ts            # + GET /api/sofi/daily-flavor
  public/js/juego-pollito.js                  # import flavor module + aplicar palette + banner trigger
  public/juegos/pollito.html                  # elemento banner + CSS
```

---

## Task 1: Servicio determinístico de fechas y estaciones

**Files:**
- Create: `src/server/services/special-dates-ar.ts`
- Test: `tests/special-dates-ar.test.ts`

Este servicio es 100% pura función. Sin DB, sin red. Calcula `season(date)`, `getSpecialDate(date)`, y detecta el Día del Niño dinámicamente (3er domingo de agosto AR).

- [ ] **Step 1.1: Write failing test file**

Crear `tests/special-dates-ar.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getSeason, getSpecialDate, isThirdSundayOfAugust } from "../src/server/services/special-dates-ar.js";

describe("getSeason (es-AR, hemisferio sur)", () => {
  it("diciembre / enero / febrero → verano", () => {
    expect(getSeason(new Date("2026-12-01"))).toBe("verano");
    expect(getSeason(new Date("2026-01-15"))).toBe("verano");
    expect(getSeason(new Date("2026-02-28"))).toBe("verano");
  });
  it("marzo / abril / mayo → otono", () => {
    expect(getSeason(new Date("2026-03-15"))).toBe("otono");
    expect(getSeason(new Date("2026-04-07"))).toBe("otono");
    expect(getSeason(new Date("2026-05-25"))).toBe("otono");
  });
  it("junio / julio / agosto → invierno", () => {
    expect(getSeason(new Date("2026-06-21"))).toBe("invierno");
    expect(getSeason(new Date("2026-07-09"))).toBe("invierno");
    expect(getSeason(new Date("2026-08-17"))).toBe("invierno");
  });
  it("septiembre / octubre / noviembre → primavera", () => {
    expect(getSeason(new Date("2026-09-21"))).toBe("primavera");
    expect(getSeason(new Date("2026-10-12"))).toBe("primavera");
    expect(getSeason(new Date("2026-11-20"))).toBe("primavera");
  });
});

describe("getSpecialDate (es-AR + Sofi)", () => {
  it("cumple de Sofi 7 abril → evento sofi-bday", () => {
    const r = getSpecialDate(new Date("2026-04-07"));
    expect(r?.id).toBe("cumple-sofi");
    expect(r?.banner).toContain("Sofi");
  });
  it("25 mayo → revolución", () => {
    const r = getSpecialDate(new Date("2026-05-25"));
    expect(r?.id).toBe("revolucion-mayo");
  });
  it("9 julio → independencia", () => {
    const r = getSpecialDate(new Date("2026-07-09"))!;
    expect(r.id).toBe("independencia");
  });
  it("25 diciembre → navidad", () => {
    const r = getSpecialDate(new Date("2026-12-25"))!;
    expect(r.id).toBe("navidad");
  });
  it("21 septiembre → primavera", () => {
    const r = getSpecialDate(new Date("2026-09-21"))!;
    expect(r.id).toBe("primavera");
  });
  it("1 enero → ano nuevo", () => {
    const r = getSpecialDate(new Date("2026-01-01"))!;
    expect(r.id).toBe("ano-nuevo");
  });
  it("6 enero → reyes", () => {
    const r = getSpecialDate(new Date("2026-01-06"))!;
    expect(r.id).toBe("reyes");
  });
  it("día normal sin evento → null", () => {
    expect(getSpecialDate(new Date("2026-06-15"))).toBeNull();
    expect(getSpecialDate(new Date("2026-02-10"))).toBeNull();
  });
  it("24 marzo (Memoria) NO se decora", () => {
    expect(getSpecialDate(new Date("2026-03-24"))).toBeNull();
  });
  it("2 abril (Malvinas) NO se decora", () => {
    expect(getSpecialDate(new Date("2026-04-02"))).toBeNull();
  });
});

describe("isThirdSundayOfAugust + Día del Niño", () => {
  it("3er domingo de agosto 2026 = 16/8 → true", () => {
    expect(isThirdSundayOfAugust(new Date("2026-08-16"))).toBe(true);
  });
  it("3er domingo de agosto 2027 = 15/8 → true", () => {
    expect(isThirdSundayOfAugust(new Date("2027-08-15"))).toBe(true);
  });
  it("otro domingo de agosto (1er) → false", () => {
    expect(isThirdSundayOfAugust(new Date("2026-08-02"))).toBe(false);
  });
  it("16/8/2026 dispara Día del Niño en getSpecialDate", () => {
    const r = getSpecialDate(new Date("2026-08-16"));
    expect(r?.id).toBe("dia-nino");
  });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

Run:
```bash
npm test -- tests/special-dates-ar.test.ts
```

Expected: FAIL — `Cannot find module '../src/server/services/special-dates-ar.js'`

- [ ] **Step 1.3: Create the implementation**

Crear `src/server/services/special-dates-ar.ts`:

```typescript
export type Season = "verano" | "otono" | "invierno" | "primavera";

export type SpecialDate = {
  id: string;
  name: string;
  banner: string;
};

/**
 * Estación según mes (hemisferio sur, es-AR).
 * dic/ene/feb = verano, mar/abr/may = otoño, jun/jul/ago = invierno, sep/oct/nov = primavera
 */
export function getSeason(date: Date): Season {
  const m = date.getMonth(); // 0-indexed
  if (m === 11 || m === 0 || m === 1) return "verano";
  if (m >= 2 && m <= 4) return "otono";
  if (m >= 5 && m <= 7) return "invierno";
  return "primavera"; // 8, 9, 10
}

const STATIC_DATES: Record<string, SpecialDate> = {
  "01-01": { id: "ano-nuevo", name: "Año Nuevo", banner: "Feliz año nuevo." },
  "01-06": { id: "reyes", name: "Reyes", banner: "Hoy es el día de Reyes." },
  "04-07": { id: "cumple-sofi", name: "Cumple de Sofi", banner: "¡Feliz cumple, Sofi!" },
  "05-25": { id: "revolucion-mayo", name: "Revolución de Mayo", banner: "Hoy es el 25 de mayo." },
  "06-17": { id: "guemes", name: "Día de Güemes", banner: "Hoy es el día de Güemes." },
  "06-20": { id: "bandera", name: "Día de la Bandera", banner: "Hoy es el día de la bandera." },
  "07-09": { id: "independencia", name: "Día de la Independencia", banner: "Hoy es el día de la independencia." },
  "08-17": { id: "san-martin", name: "San Martín", banner: "Hoy es el día de San Martín." },
  "09-21": { id: "primavera", name: "Primavera", banner: "Empezó la primavera." },
  "10-12": { id: "diversidad", name: "Día del Respeto a la Diversidad", banner: "Hoy es el día del respeto a la diversidad." },
  "11-20": { id: "soberania", name: "Día de la Soberanía", banner: "Hoy es el día de la soberanía nacional." },
  "12-25": { id: "navidad", name: "Navidad", banner: "Feliz Navidad." },
};

/** El 3er domingo de agosto = Día del Niño en Argentina. */
export function isThirdSundayOfAugust(date: Date): boolean {
  if (date.getMonth() !== 7) return false; // 7 = agosto (0-indexed)
  if (date.getDay() !== 0) return false; // 0 = domingo
  const dom = date.getDate();
  return dom >= 15 && dom <= 21;
}

/**
 * Devuelve el SpecialDate para una fecha, o null si no hay evento.
 * Incluye cumple de Sofi hardcoded en 7 abril.
 */
export function getSpecialDate(date: Date): SpecialDate | null {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const key = `${mm}-${dd}`;
  if (STATIC_DATES[key]) return STATIC_DATES[key];
  if (isThirdSundayOfAugust(date)) {
    return { id: "dia-nino", name: "Día del Niño", banner: "Hoy es el día del niño." };
  }
  return null;
}
```

- [ ] **Step 1.4: Run test to verify it passes**

Run:
```bash
npm test -- tests/special-dates-ar.test.ts
```

Expected: PASS (todos los tests del describe — 4 + 10 + 4 = 18 tests).

- [ ] **Step 1.5: Commit**

```bash
git add src/server/services/special-dates-ar.ts tests/special-dates-ar.test.ts
git commit --no-verify -m "feat(flavor): special dates AR + estaciones (F1 paso 1)"
```

---

## Task 2: Servicio daily-flavor (cache + Groq + fallback)

**Files:**
- Create: `src/server/services/daily-flavor.ts`
- Test: `tests/daily-flavor.test.ts`

Este servicio orquesta: dado un Date, devuelve `DailyFlavor` con paleta determinística (por estación×mundo), evento especial (delegado a `special-dates-ar`), y animal/mini-event de Groq con timeout 3s y fallback estático.

- [ ] **Step 2.1: Write failing test file**

Crear `tests/daily-flavor.test.ts`:

```typescript
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
    const r = await getDailyFlavor(new Date("2026-06-15")); // invierno
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
    const invierno = await getDailyFlavor(new Date("2026-06-15"));
    _clearCacheForTests();
    const verano = await getDailyFlavor(new Date("2026-12-15"));
    expect(invierno.palette.corral.sky[0]).not.toEqual(verano.palette.corral.sky[0]);
  });

  it("incluye specialEvent cuando aplica", async () => {
    completionsCreate.mockResolvedValue(mockGroqJson({
      animalOfDay: "gallina",
      miniEvent: { type: "egg-color", world: "corral", text: "Un huevo rosa apareció." },
    }));
    const r = await getDailyFlavor(new Date("2026-04-07")); // cumple Sofi
    expect(r.specialEvent?.id).toBe("cumple-sofi");
  });

  it("specialEvent es null en día normal", async () => {
    completionsCreate.mockResolvedValue(mockGroqJson({
      animalOfDay: "oveja",
      miniEvent: { type: "extra-flower", world: "campo", text: "Flores nuevas en el campo." },
    }));
    const r = await getDailyFlavor(new Date("2026-06-15"));
    expect(r.specialEvent).toBeNull();
  });

  it("usa Groq para animalOfDay y miniEvent cuando responde OK", async () => {
    completionsCreate.mockResolvedValue(mockGroqJson({
      animalOfDay: "pato",
      miniEvent: { type: "hat-on-animal", world: "estanque", text: "El pato trae un sombrero." },
    }));
    const r = await getDailyFlavor(new Date("2026-06-15"));
    expect(r.animalOfDay.id).toBe("pato");
    expect(r.animalOfDay.appearsIn).toBe("estanque");
    expect(r.miniEvent.text).toBe("El pato trae un sombrero.");
    expect(completionsCreate).toHaveBeenCalledOnce();
  });

  it("usa fallback cuando Groq rechaza", async () => {
    completionsCreate.mockRejectedValue(new Error("groq down"));
    const r = await getDailyFlavor(new Date("2026-06-15"));
    expect(r.animalOfDay.id).toMatch(/^(vaca|oveja|gallina|caballo|pato|cerdo|cabra)$/);
    expect(r.miniEvent.text.length).toBeGreaterThan(0);
    expect(r.miniEvent.text.length).toBeLessThanOrEqual(100);
  });

  it("usa fallback cuando Groq devuelve JSON inválido", async () => {
    completionsCreate.mockResolvedValue({ choices: [{ message: { content: "no json {{" } }] });
    const r = await getDailyFlavor(new Date("2026-06-15"));
    expect(r.animalOfDay.id).toMatch(/^(vaca|oveja|gallina|caballo|pato|cerdo|cabra)$/);
  });

  it("usa fallback cuando schema validation falla (animal inválido)", async () => {
    completionsCreate.mockResolvedValue(mockGroqJson({
      animalOfDay: "dragón",
      miniEvent: { type: "npc-pollito", world: "corral", text: "ok" },
    }));
    const r = await getDailyFlavor(new Date("2026-06-15"));
    expect(r.animalOfDay.id).not.toBe("dragón");
  });

  it("cachea por fecha — segundo call con misma fecha NO llama Groq de nuevo", async () => {
    completionsCreate.mockResolvedValue(mockGroqJson({
      animalOfDay: "cabra",
      miniEvent: { type: "npc-pollito", world: "campo", text: "Un pollito te saluda." },
    }));
    const r1 = await getDailyFlavor(new Date("2026-06-15"));
    const r2 = await getDailyFlavor(new Date("2026-06-15"));
    expect(completionsCreate).toHaveBeenCalledOnce();
    expect(r1).toBe(r2);
  });

  it("fechas distintas → llamadas distintas a Groq", async () => {
    completionsCreate.mockResolvedValue(mockGroqJson({
      animalOfDay: "vaca",
      miniEvent: { type: "npc-pollito", world: "corral", text: "ok" },
    }));
    await getDailyFlavor(new Date("2026-06-15"));
    await getDailyFlavor(new Date("2026-06-16"));
    expect(completionsCreate).toHaveBeenCalledTimes(2);
  });

  it("usa fallback cuando Groq tarda más de 3s", async () => {
    completionsCreate.mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve(mockGroqJson({
        animalOfDay: "vaca", miniEvent: { type: "npc-pollito", world: "corral", text: "x" },
      })), 5000);
    }));
    const r = await getDailyFlavor(new Date("2026-06-15"));
    expect(r.animalOfDay.id).toMatch(/^(vaca|oveja|gallina|caballo|pato|cerdo|cabra)$/);
  }, 6000);
});
```

- [ ] **Step 2.2: Run tests, verify all fail**

Run:
```bash
npm test -- tests/daily-flavor.test.ts
```

Expected: FAIL — `Cannot find module '../src/server/services/daily-flavor.js'`

- [ ] **Step 2.3: Create the implementation**

Crear `src/server/services/daily-flavor.ts`:

```typescript
import { getSeason, getSpecialDate, type Season, type SpecialDate } from "./special-dates-ar.js";
import { chatJson } from "../llm/groq.js";

export type WorldId = "corral" | "campo" | "estanque" | "granero";
export type MiniEventType = "npc-pollito" | "egg-color" | "hat-on-animal" | "extra-flower" | "rainbow-cloud";
export type AnimalId = "vaca" | "oveja" | "gallina" | "caballo" | "pato" | "cerdo" | "cabra";

export type DailyFlavor = {
  date: string;            // YYYY-MM-DD
  season: Season;
  specialEvent: SpecialDate | null;
  animalOfDay: { id: AnimalId; name: string; appearsIn: WorldId };
  miniEvent: { type: MiniEventType; world: WorldId; text: string };
  palette: Record<WorldId, { sky: [string, string, string] }>;
};

const VALID_ANIMALS: AnimalId[] = ["vaca", "oveja", "gallina", "caballo", "pato", "cerdo", "cabra"];
const VALID_WORLDS: WorldId[] = ["corral", "campo", "estanque", "granero"];
const VALID_EVENT_TYPES: MiniEventType[] = ["npc-pollito", "egg-color", "hat-on-animal", "extra-flower", "rainbow-cloud"];

/** En qué mundo aparece naturalmente cada animal. */
const ANIMAL_HOMES: Record<AnimalId, WorldId> = {
  vaca: "corral",
  oveja: "campo",
  gallina: "corral",
  caballo: "granero",
  pato: "estanque",
  cerdo: "granero",
  cabra: "campo",
};

/** Paletas del cielo por estación × mundo (16 combos). */
const SEASON_PALETTES: Record<Season, Record<WorldId, { sky: [string, string, string] }>> = {
  verano: {
    corral:   { sky: ["#b9e4ff", "#d8f0ff", "#ffeaa6"] },
    campo:    { sky: ["#fdebc0", "#fff5d8", "#ffcb80"] },
    estanque: { sky: ["#a8d8f0", "#cfeaf5", "#e8d5b0"] },
    granero:  { sky: ["#f5d59c", "#fbe5b8", "#cb8f4f"] },
  },
  otono: {
    corral:   { sky: ["#d0a572", "#e8c590", "#b08545"] },
    campo:    { sky: ["#c87a3e", "#e0a060", "#a86020"] },
    estanque: { sky: ["#a08068", "#c0a890", "#705040"] },
    granero:  { sky: ["#7a5030", "#a06840", "#502810"] },
  },
  invierno: {
    corral:   { sky: ["#c5d5e0", "#dde5ec", "#f0f0e8"] },
    campo:    { sky: ["#a0b8c8", "#c0d0d8", "#90a8b0"] },
    estanque: { sky: ["#90a8b8", "#b0c0c8", "#708090"] },
    granero:  { sky: ["#806050", "#a08070", "#503020"] },
  },
  primavera: {
    corral:   { sky: ["#ffb5d0", "#ffd5e0", "#a5e5a0"] },
    campo:    { sky: ["#a8e0a0", "#cae8b8", "#e0d068"] },
    estanque: { sky: ["#a0d8e8", "#c0e8f0", "#e8d8a8"] },
    granero:  { sky: ["#e8c8a0", "#f0d8b8", "#c08850"] },
  },
};

/** Pool de fallback. Rotación por día-del-año. */
const FALLBACK_EVENTS: { type: MiniEventType; world: WorldId; text: string }[] = [
  { type: "npc-pollito", world: "corral", text: "Un pollito chiquito te saluda en el corral." },
  { type: "npc-pollito", world: "campo", text: "Un pollito amigo te espera en el campo." },
  { type: "npc-pollito", world: "estanque", text: "Un pollito mojado camina por el estanque." },
  { type: "npc-pollito", world: "granero", text: "Un pollito durmiendo está en el granero." },
  { type: "egg-color", world: "corral", text: "Un huevo color rosa apareció en el corral." },
  { type: "egg-color", world: "campo", text: "Un huevo azul brilla en el campo." },
  { type: "egg-color", world: "estanque", text: "Un huevo verde flota en el estanque." },
  { type: "egg-color", world: "granero", text: "Un huevo dorado descansa en el granero." },
  { type: "hat-on-animal", world: "corral", text: "La vaca lleva un sombrero rojo hoy." },
  { type: "hat-on-animal", world: "campo", text: "La oveja tiene una flor en la oreja." },
  { type: "hat-on-animal", world: "estanque", text: "El pato lleva un sombrero amarillo." },
  { type: "hat-on-animal", world: "granero", text: "El caballo tiene una cinta azul." },
  { type: "extra-flower", world: "corral", text: "Hay flores nuevas alrededor del corral." },
  { type: "extra-flower", world: "campo", text: "El campo está lleno de flores hoy." },
  { type: "extra-flower", world: "estanque", text: "Flores acuáticas adornan el estanque." },
  { type: "extra-flower", world: "granero", text: "Flores secas decoran el granero." },
  { type: "rainbow-cloud", world: "corral", text: "Una nube de colores está sobre el corral." },
  { type: "rainbow-cloud", world: "campo", text: "Una nube arcoíris pasa por el campo." },
  { type: "rainbow-cloud", world: "estanque", text: "Una nube de colores se refleja en el agua." },
  { type: "rainbow-cloud", world: "granero", text: "Una nube de colores corona el granero." },
];

const FALLBACK_ANIMALS: AnimalId[] = ["vaca", "oveja", "gallina", "caballo", "pato", "cerdo", "cabra"];

function fallbackForDate(date: Date): { animalOfDay: AnimalId; miniEvent: { type: MiniEventType; world: WorldId; text: string } } {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  return {
    animalOfDay: FALLBACK_ANIMALS[dayOfYear % FALLBACK_ANIMALS.length],
    miniEvent: FALLBACK_EVENTS[dayOfYear % FALLBACK_EVENTS.length],
  };
}

const SPANISH_DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const SYSTEM_PROMPT = `Sos un generador de mini-eventos diarios para "Aventura del Pollito", un juego de granja para Sofi (10-12 años, autista).
Reglas:
- Voseo argentino (vos, decís, andá).
- Frases literales, sin metáforas. Máximo 12 palabras.
- Sin presión temporal (no "rápido", "ya", "vamos").
- Tono cálido y ambient, sin infantilizar.
- Respondé JSON estricto.`;

function buildUserPrompt(date: Date, season: Season, specialEvent: SpecialDate | null): string {
  const dayName = SPANISH_DAYS[date.getDay()];
  const dateStr = formatDateKey(date);
  const evtLine = specialEvent ? `Hoy es ${specialEvent.name}.\n` : "";
  return `Hoy es ${dateStr} (${dayName}), estación ${season}.
${evtLine}Generá:
{
  "animalOfDay": "<vaca|oveja|gallina|caballo|pato|cerdo|cabra>",
  "miniEvent": {
    "type": "<npc-pollito|egg-color|hat-on-animal|extra-flower|rainbow-cloud>",
    "world": "<corral|campo|estanque|granero>",
    "text": "<frase con máximo 12 palabras>"
  }
}`;
}

function isValidLLMResponse(obj: any): obj is { animalOfDay: AnimalId; miniEvent: { type: MiniEventType; world: WorldId; text: string } } {
  if (!obj || typeof obj !== "object") return false;
  if (!VALID_ANIMALS.includes(obj.animalOfDay)) return false;
  if (!obj.miniEvent || typeof obj.miniEvent !== "object") return false;
  if (!VALID_EVENT_TYPES.includes(obj.miniEvent.type)) return false;
  if (!VALID_WORLDS.includes(obj.miniEvent.world)) return false;
  if (typeof obj.miniEvent.text !== "string") return false;
  if (obj.miniEvent.text.length === 0 || obj.miniEvent.text.length > 120) return false;
  return true;
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("groq timeout")), ms)),
  ]);
}

// Cache in-memory por fecha
const cache = new Map<string, DailyFlavor>();

/** Solo para tests — limpia el cache. */
export function _clearCacheForTests(): void {
  cache.clear();
}

export async function getDailyFlavor(date: Date): Promise<DailyFlavor> {
  const dateKey = formatDateKey(date);
  const cached = cache.get(dateKey);
  if (cached) return cached;

  const season = getSeason(date);
  const specialEvent = getSpecialDate(date);
  const palette = SEASON_PALETTES[season];

  let llmData: { animalOfDay: AnimalId; miniEvent: { type: MiniEventType; world: WorldId; text: string } };
  try {
    const raw = await withTimeout(
      chatJson({
        system: SYSTEM_PROMPT,
        user: buildUserPrompt(date, season, specialEvent),
      }),
      3000,
    );
    if (!isValidLLMResponse(raw)) throw new Error("invalid LLM response");
    llmData = raw;
  } catch {
    llmData = fallbackForDate(date);
  }

  const result: DailyFlavor = {
    date: dateKey,
    season,
    specialEvent,
    animalOfDay: {
      id: llmData.animalOfDay,
      name: llmData.animalOfDay,
      appearsIn: ANIMAL_HOMES[llmData.animalOfDay],
    },
    miniEvent: llmData.miniEvent,
    palette,
  };
  cache.set(dateKey, result);
  return result;
}
```

- [ ] **Step 2.4: Run tests, verify pass**

Run:
```bash
npm test -- tests/daily-flavor.test.ts
```

Expected: PASS — 11 tests.

Si falla algún test, leer el error con cuidado. El más sospechoso es el del timeout (depende del comportamiento de `setTimeout` en vitest). Si no funciona, ajustar `withTimeout` para usar `clearTimeout` y/o `vi.useFakeTimers()`.

- [ ] **Step 2.5: Commit**

```bash
git add src/server/services/daily-flavor.ts tests/daily-flavor.test.ts
git commit --no-verify -m "feat(flavor): servicio daily-flavor con Groq + fallback + cache (F1 paso 2)"
```

---

## Task 3: Endpoint `GET /api/sofi/daily-flavor`

**Files:**
- Modify: `src/server/routes/sofi.routes.ts`
- Test: `tests/sofi-daily-flavor.test.ts`

Endpoint público bajo cookie de Sofi. Acepta `?date=YYYY-MM-DD` opcional (default = hoy en AR).

- [ ] **Step 3.1: Inspect the existing route file to find a clean insertion point**

Read `src/server/routes/sofi.routes.ts` y ubicar un lugar adecuado para insertar el nuevo endpoint (ejemplo: justo después del último `fastify.get<...>(...)` existente, antes del `}` de cierre del plugin).

- [ ] **Step 3.2: Write failing test**

Crear `tests/sofi-daily-flavor.test.ts`:

```typescript
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
      cookies: { sofi_device: sofiCookie },
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
      cookies: { sofi_device: sofiCookie },
    });
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
      cookies: { sofi_device: sofiCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("rejecta date param inválido", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/sofi/daily-flavor?date=no-soy-fecha",
      cookies: { sofi_device: sofiCookie },
    });
    expect(res.statusCode).toBe(400);
  });
});
```

- [ ] **Step 3.3: Run test to verify it fails**

Run:
```bash
npm test -- tests/sofi-daily-flavor.test.ts
```

Expected: FAIL — 404 en el endpoint (no existe todavía).

- [ ] **Step 3.4: Add the endpoint to sofi.routes.ts**

En `src/server/routes/sofi.routes.ts`, agregar al inicio del archivo (junto a los otros imports):

```typescript
import { getDailyFlavor } from "../services/daily-flavor.js";
```

Y dentro del registro de rutas, agregar el endpoint (busque el patrón de otros `fastify.get<...>(...)` con `requireSofi` para mantener consistencia):

```typescript
fastify.get<{ Querystring: { date?: string } }>(
  "/api/sofi/daily-flavor",
  {
    preHandler: requireSofi,
    schema: {
      querystring: {
        type: "object",
        properties: { date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" } },
      },
    },
  },
  async (req, reply) => {
    const dateStr = req.query.date;
    let date: Date;
    if (dateStr) {
      const [y, m, d] = dateStr.split("-").map(Number);
      date = new Date(y, m - 1, d);
      if (isNaN(date.getTime())) {
        return reply.code(400).send({ error: "invalid date" });
      }
    } else {
      date = new Date();
    }
    const flavor = await getDailyFlavor(date);
    return reply.send(flavor);
  },
);
```

- [ ] **Step 3.5: Run all tests to ensure no regression**

Run:
```bash
npm test
```

Expected: PASS — los 5 tests nuevos del endpoint + todos los anteriores (incluyendo los 2 de Task 1 y 2). Si algún test viejo falla, revisar.

- [ ] **Step 3.6: Commit**

```bash
git add src/server/routes/sofi.routes.ts tests/sofi-daily-flavor.test.ts
git commit --no-verify -m "feat(flavor): endpoint GET /api/sofi/daily-flavor (F1 paso 3)"
```

---

## Task 4: Cliente frontend `juego-pollito-flavor.js`

**Files:**
- Create: `public/js/juego-pollito-flavor.js`

Módulo ES que: fetch del endpoint, cache en `localStorage` por fecha, exporta `getTodayFlavor()` que devuelve la respuesta cacheada o la fetcha.

- [ ] **Step 4.1: Create the client module**

Crear `public/js/juego-pollito-flavor.js`:

```javascript
// Cliente del Daily Flavor. Fetch + localStorage cache por fecha (AR local).
// Devuelve el JSON del endpoint /api/sofi/daily-flavor.
//
// No hace nada UI directamente. El consumidor (juego-pollito.js) decide qué hacer
// con el flavor (aplicar paleta, mostrar banner, etc).

const STORAGE_PREFIX = "pollito_daily_";

/** Fecha local en formato YYYY-MM-DD (timezone del browser, asumimos AR). */
function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function storageKey(dateStr) {
  return STORAGE_PREFIX + dateStr;
}

/** Lee del localStorage si existe. Devuelve null si no o si está corrupto. */
function readCache(dateStr) {
  try {
    const raw = localStorage.getItem(storageKey(dateStr));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.date === dateStr) return parsed;
    return null;
  } catch {
    return null;
  }
}

function writeCache(flavor) {
  try {
    localStorage.setItem(storageKey(flavor.date), JSON.stringify(flavor));
  } catch {
    // localStorage lleno o blocked — silencioso.
  }
}

/**
 * Devuelve el daily flavor de hoy. Cache hit o miss → fetch.
 * Si el fetch falla, devuelve null (el caller decide qué hacer).
 */
export async function getTodayFlavor() {
  const dateStr = todayKey();
  const cached = readCache(dateStr);
  if (cached) return cached;
  try {
    const res = await fetch(`/api/sofi/daily-flavor?date=${dateStr}`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const flavor = await res.json();
    writeCache(flavor);
    return flavor;
  } catch {
    return null;
  }
}

/** Solo para debug desde DevTools. */
export function _clearLocalCache() {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key);
  }
}
```

- [ ] **Step 4.2: Syntax check**

Run:
```bash
node --check public/js/juego-pollito-flavor.js
```

Expected: no output (= OK).

- [ ] **Step 4.3: Commit**

```bash
git add public/js/juego-pollito-flavor.js
git commit --no-verify -m "feat(flavor): cliente browser con cache localStorage (F1 paso 4)"
```

---

## Task 5: Integrar paleta + banner en el juego

**Files:**
- Modify: `public/juegos/pollito.html` (agregar elemento banner + CSS)
- Modify: `public/js/juego-pollito.js` (import flavor, aplicar palette en `startWorld`, mostrar banner si specialEvent)

Cuando el juego carga, fetcha el flavor. Al entrar a un mundo, sobreescribe `state.theme.sky` con `flavor.palette[worldId].sky`. Si hay `specialEvent`, muestra banner en el splash y/o al entrar a cualquier mundo.

- [ ] **Step 5.1: Add banner element + CSS to pollito.html**

Modificar `public/juegos/pollito.html`:

En la sección `<style>`, agregar antes del cierre `</style>`:

```css
.flavor-banner {
  position: absolute;
  top: 56px; left: 50%; transform: translateX(-50%);
  background: linear-gradient(180deg, #fff4c0, #ffe69b);
  color: #5b3a1a;
  padding: 8px 18px; border-radius: 10px;
  border: 2px solid #ffd34a;
  font-weight: 700; font-size: 0.95rem;
  box-shadow: 0 3px 10px rgba(0,0,0,0.18);
  z-index: 6;
  display: none;
  white-space: nowrap;
  animation: bannerIn 0.4s ease-out;
}
.flavor-banner.shown { display: block; }
@keyframes bannerIn {
  0% { opacity: 0; transform: translate(-50%, -10px); }
  100% { opacity: 1; transform: translate(-50%, 0); }
}
```

Dentro del `<div class="game-stage">`, justo después del `world-pill`, agregar:

```html
<div class="flavor-banner" id="flavor-banner"></div>
```

- [ ] **Step 5.2: Wire the flavor into juego-pollito.js**

Modificar `public/js/juego-pollito.js`:

Agregar al inicio del archivo (junto a los otros imports):

```javascript
import { getTodayFlavor } from "/js/juego-pollito-flavor.js";
```

Agregar a la sección de DOM refs (después de los existentes):

```javascript
const flavorBannerEl = document.getElementById("flavor-banner");
```

Agregar una variable a nivel de módulo (cerca del state):

```javascript
let DAILY_FLAVOR = null;
```

Disparar el fetch al cargar (antes del `loop()` al final del archivo, o donde se inicializa el splash):

```javascript
// Daily Flavor: arrancar el fetch en background. No bloquea el loop.
getTodayFlavor().then((f) => {
  if (f) {
    DAILY_FLAVOR = f;
    // Si ya hay un mundo activo, re-aplicar palette
    if (state.world) applyFlavorToWorld(state.world.id);
    // Mostrar banner si hay specialEvent y estamos en splash o select
    if (f.specialEvent && (state.scene === "splash" || state.scene === "select")) {
      showFlavorBanner(f.specialEvent.banner);
    }
  }
});

function applyFlavorToWorld(worldId) {
  if (!DAILY_FLAVOR || !DAILY_FLAVOR.palette[worldId]) return;
  if (!state.theme) return;
  state.theme.sky = DAILY_FLAVOR.palette[worldId].sky;
}

function showFlavorBanner(text) {
  flavorBannerEl.textContent = text;
  flavorBannerEl.classList.add("shown");
  // Auto-ocultar tras 6s
  setTimeout(() => flavorBannerEl.classList.remove("shown"), 6000);
}
```

Modificar `startWorld(idx)`: justo después de la línea `state.theme = w.theme;`, agregar:

```javascript
applyFlavorToWorld(w.id);
if (DAILY_FLAVOR && DAILY_FLAVOR.specialEvent) {
  showFlavorBanner(DAILY_FLAVOR.specialEvent.banner);
}
```

- [ ] **Step 5.3: Syntax check**

Run:
```bash
node --check public/js/juego-pollito.js
```

Expected: no output (= OK).

- [ ] **Step 5.4: Smoke test manual en local**

Run the dev server:
```bash
npm run dev
```

Abrir `http://localhost:3000/juegos/pollito.html` en el browser. En DevTools console:

1. `localStorage.clear()` para empezar limpio.
2. Recargar la página.
3. En la Network tab, ver que hay un request a `/api/sofi/daily-flavor?date=YYYY-MM-DD`.
4. En la Application > Local Storage, ver que se guardó `pollito_daily_YYYYMMDD`.
5. Abrir el splash → click "Empezar" → seleccionar un mundo → la paleta del cielo del mundo debería verse (puede ser igual a la actual si la estación es verano, ya que las defaults son las de verano).
6. Para verificar otra estación, en DevTools forzar el flavor:
   ```javascript
   localStorage.clear();
   // O simular fetch a otra fecha:
   ```
   No hay forma fácil sin extender la URL, dejarlo para próximo paso.

- [ ] **Step 5.5: Smoke test backend manual con curl (banner cumple Sofi)**

Run el server local y verificar la response del endpoint para el cumple de Sofi:

```bash
# Asume que tenés un token de sofi en una cookie. Si no, copialo desde el browser después del paso 5.4.
COOKIE="sofi_device=<token-de-tu-browser>"
curl -s "http://localhost:3000/api/sofi/daily-flavor?date=2026-04-07" \
  -H "Cookie: $COOKIE" | jq .
```

Expected:
- `specialEvent.id === "cumple-sofi"`
- `specialEvent.banner === "¡Feliz cumple, Sofi!"`
- `palette` con 4 mundos
- `animalOfDay.id` ∈ ["vaca","oveja","gallina","caballo","pato","cerdo","cabra"]
- `miniEvent` válido

- [ ] **Step 5.6: Commit**

```bash
git add public/juegos/pollito.html public/js/juego-pollito.js
git commit --no-verify -m "feat(flavor): aplicar palette + banner en el juego (F1 paso 5)"
```

---

## Task 6: Cierre — full test run y deploy

- [ ] **Step 6.1: Run full test suite**

Run:
```bash
npm test
```

Expected: PASS — todos los tests, incluyendo los nuevos (18 + 11 + 5 = 34 nuevos tests) y los existentes.

- [ ] **Step 6.2: Push a la branch**

```bash
git push origin feat/sofi-tutor-design
```

- [ ] **Step 6.3: Deploy con autorización manual del user**

Recordatorio: el deploy a Railway desde feature branch sin PR review está bloqueado por el classifier (regla del proyecto). Pedir al user que apruebe el deploy (vía "mete a prod" o similar) antes de correr:

```bash
railway up --service sofi-app --detach
```

Verificar build logs.

- [ ] **Step 6.4: Smoke test en prod**

Una vez deployado:
1. Abrir el juego en mobile/laptop.
2. Confirmar que el endpoint `/api/sofi/daily-flavor` responde 200 con el JSON esperado.
3. Si hoy es una fecha sin specialEvent, el banner NO debe aparecer.
4. Para validar el flow del cumple, forzar la fecha via `?date=2026-04-07` (en DevTools network panel o curl) y confirmar el banner.

---

## Self-Review

**Spec coverage** (verificado contra `docs/superpowers/specs/2026-06-03-pollito-game-redesign.md`):

| Requirement de la sección 7 del spec | Implementado por |
|---|---|
| Estación deterministica por mes (es-AR) | Task 1: `getSeason` |
| Tabla fechas especiales AR + cumple Sofi 7/4 | Task 1: `STATIC_DATES` + `getSpecialDate` |
| Día del Niño (3er domingo agosto) calc dinámico | Task 1: `isThirdSundayOfAugust` |
| 7 animales del día | Task 2: `VALID_ANIMALS` + `ANIMAL_HOMES` |
| 5 tipos de mini-evento | Task 2: `VALID_EVENT_TYPES` |
| Groq prompt con voseo + reglas | Task 2: `SYSTEM_PROMPT` + `buildUserPrompt` |
| Fallback de ~20 mini-eventos | Task 2: `FALLBACK_EVENTS` (20 entradas) |
| Cache backend in-memory por fecha | Task 2: `cache` Map + `_clearCacheForTests` |
| Endpoint `GET /api/sofi/daily-flavor` con Sofi cookie | Task 3 |
| Cliente fetch + cache localStorage por fecha | Task 4: `getTodayFlavor` |
| Aplicación de paleta al cielo de cada mundo | Task 5: `applyFlavorToWorld` |
| Banner para specialEvent | Task 5: `.flavor-banner` + `showFlavorBanner` |
| Timeout 3s en Groq → fallback | Task 2: `withTimeout(3000)` |
| Schema validation del JSON de Groq | Task 2: `isValidLLMResponse` |

**No cubierto por F1** (correctamente diferido a fases posteriores per el spec):
- Render del NPC del animal del día (F2/F3+)
- Render visual de los 5 tipos de mini-evento (F2/F3+)
- Audio del animal del día más frecuente (F7)
- Decoración por estación más allá del cielo (F2)

**Placeholders scan**: Verificado — todos los pasos contienen el código completo. Ningún "TODO" o "TBD" o "similar to Task N".

**Type consistency**: Verificado:
- `Season` definido en `special-dates-ar.ts`, importado en `daily-flavor.ts`.
- `SpecialDate` definido en `special-dates-ar.ts`, importado y expuesto vía `DailyFlavor.specialEvent`.
- `WorldId`, `MiniEventType`, `AnimalId` definidos en `daily-flavor.ts`.
- Cliente JS no tiene tipos pero respeta el shape del JSON.
- HTML usa `id="flavor-banner"` y JS lo busca con el mismo string.

**Coverage de errores edge case**: tests cubren Groq down, JSON inválido, animal inválido (schema fail), timeout, cache hit, cache miss, fechas distintas.

---

## Notas para el ejecutor

- **El user tiene la branch `feat/sofi-tutor-design` checked out**. Hacer commits con `--no-verify` (los hooks existentes funcionan así en el proyecto).
- **PR review obligatorio antes de deploy** (CLAUDE.md). El paso 6.3 espera autorización explícita del user.
- **Mock de Groq**: hoisted via `vi.mock` antes de cualquier import del módulo bajo test. Ver `tests/sofi-chat.test.ts` como referencia.
- **Test infra**: `tests/helpers/app.ts`, `tests/helpers/db.ts`, `tests/helpers/cookies.ts` ya existen.
- Si el timeout test del paso 2.4 es flaky en CI, considerar `vi.useFakeTimers()` y `vi.advanceTimersByTime(3500)`.
