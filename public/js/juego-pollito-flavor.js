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
