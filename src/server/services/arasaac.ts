import { query } from "../db.js";
import { ARASAAC as STATIC_MAP, normalize, type PhraseUnit } from "./phrase-tokenizer.js";

/**
 * Resolución de pictogramas ARASAAC para palabras que NO están en el map
 * estático. Flujo:
 *
 *   1. Consultar tabla `arasaac_cache` (resoluciones previas + nulls explícitos).
 *   2. Si no está, consultar API de ARASAAC.
 *   3. Persistir el resultado (incluso null) para no volver a llamar.
 *
 * El map estático (`STATIC_MAP`) tiene prioridad y bloquea el auto-lookup:
 * si una palabra está ahí (con número o con null), no se consulta. Esto
 * permite override manual cuando ARASAAC devuelve match incorrecto
 * (ej. "oracion" → "rezar").
 */

const API_TIMEOUT_MS = 4000;

async function fetchFromArasaacApi(term: string): Promise<number | null> {
  const url = `https://api.arasaac.org/api/pictograms/es/search/${encodeURIComponent(term)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ _id?: number; keywords?: Array<{ keyword?: string }> }>;
    if (!Array.isArray(data) || data.length === 0) return null;
    const top = data[0];
    if (!top || typeof top._id !== "number") return null;
    // Heurística contra falsos positivos: el top match debe tener `term` (o muy
    // cercano) como uno de sus keywords. Si no, devolver null — preferimos
    // "sin pictograma" antes que "pictograma erróneo".
    const kws = (top.keywords ?? [])
      .map((k) => (k.keyword ?? "").toLowerCase())
      .filter(Boolean);
    const termLower = term.toLowerCase();
    const hasGoodMatch = kws.some((k) => k === termLower || k.startsWith(termLower) || termLower.startsWith(k));
    if (!hasGoodMatch) return null;
    return top._id;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFromCache(normalized: string): Promise<{ picto_id: number | null } | null> {
  const { rows } = await query<{ picto_id: number | null }>(
    `SELECT picto_id FROM arasaac_cache WHERE word_normalized = $1`,
    [normalized],
  );
  return rows[0] ?? null;
}

async function persistToCache(
  normalized: string,
  picto_id: number | null,
  source: "api" | "manual_override" | "manual_null",
): Promise<void> {
  await query(
    `INSERT INTO arasaac_cache (word_normalized, picto_id, source)
     VALUES ($1, $2, $3)
     ON CONFLICT (word_normalized) DO NOTHING`,
    [normalized, picto_id, source],
  );
}

/**
 * Resuelve un pictograma para `word`. Devuelve el ID, o null si no hay
 * uno bueno. Hace cache automático. NO usa el map estático (la idea es
 * que llamadores ya filtraron palabras que estaban en el static map).
 */
export async function lookupAndCache(word: string): Promise<number | null> {
  const normalized = normalize(word);
  if (!normalized) return null;

  // 1. Cache DB
  const cached = await fetchFromCache(normalized);
  if (cached) return cached.picto_id;

  // 2. API
  const id = await fetchFromArasaacApi(normalized);

  // 3. Persistir (incluso null)
  await persistToCache(normalized, id, "api").catch((err) => {
    console.error("arasaac cache insert failed", err);
  });

  return id;
}

/**
 * Recorre un PhraseUnit[], encuentra unidades sin .pic que NO están en el
 * map estático, las resuelve vía cache+API y muta cada unit con el pic
 * encontrado. No-op para palabras que están en static (con o sin pic).
 */
export async function enrichPhrase(phrase: PhraseUnit[]): Promise<void> {
  for (const unit of phrase) {
    if (!("word" in unit)) continue;
    if (unit.pic !== undefined) continue;
    const normalized = normalize(unit.word);
    if (!normalized) continue;
    // Si está en el map estático (incluso con valor null), no consultar API.
    // El null estático es un override consciente; respetarlo.
    if (normalized in STATIC_MAP) continue;
    const id = await lookupAndCache(normalized);
    if (id !== null) unit.pic = id;
  }
}
