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

/** Nombres display capitalizados. El `id` es lowercase para usar como key/identifier. */
const ANIMAL_DISPLAY_NAMES: Record<AnimalId, string> = {
  vaca: "Vaca",
  oveja: "Oveja",
  gallina: "Gallina",
  caballo: "Caballo",
  pato: "Pato",
  cerdo: "Cerdo",
  cabra: "Cabra",
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

function fallbackForDate(date: Date): { animalOfDay: AnimalId; miniEvent: { type: MiniEventType; world: WorldId; text: string } } {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  return {
    animalOfDay: VALID_ANIMALS[dayOfYear % VALID_ANIMALS.length],
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
  let usedFallback = false;
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
    usedFallback = true;
  }

  const result: DailyFlavor = {
    date: dateKey,
    season,
    specialEvent,
    animalOfDay: {
      id: llmData.animalOfDay,
      name: ANIMAL_DISPLAY_NAMES[llmData.animalOfDay],
      appearsIn: ANIMAL_HOMES[llmData.animalOfDay],
    },
    miniEvent: llmData.miniEvent,
    palette,
  };
  // Solo cacheamos si el LLM respondió bien — sino reintentamos next call.
  if (!usedFallback) cache.set(dateKey, result);
  return result;
}
