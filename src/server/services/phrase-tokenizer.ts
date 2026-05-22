// Pictogram mapping + tokenizer shared between stub-tutor (hand-crafted topics)
// and real-tutor (LLM-generated topics).
//
// Given Spanish text, returns a PhraseUnit[] where each word has an optional
// ARASAAC pictogram id, plus {break:true} markers at newlines. The frontend
// renders this as a SAAC-style table (pictogram above word, line breaks
// preserved).

export type PhraseUnit =
  | { word: string; pic?: number }
  | { break: true };

export const ARASAAC: Record<string, number | null> = {
  argentina: 8030,
  // Para Sofi "país" implica Argentina (su país). Usamos el pictograma de
  // Argentina (silueta con bandera celeste-blanca) para que sea más concreto.
  pais: 8030,
  paises: 8030,
  limitrofe: 8483,
  limitrofes: 8483,
  vecino: 26529,
  sur: 8228,
  norte: 8178,
  este: 7095,
  oeste: 8179,
  america: 5377,
  sudamerica: 34387,
  noreste: 27913,
  mapa: 5505,
  cuaderno: 2359,
  mirar: 6564,
  mira: 6564,
  miras: 6564,
  ver: 6564,
  leer: 7141,
  escribir: 2380,
  pensar: 38796,
  contar: 2714,
  oceano: 2925,
  atlantico: 32699,
  pacifico: null,
  mar: 2925,
  rio: 2811,
  montana: 2909,
  montanas: 2909,
  monte: 2909,
  cordillera: 23975,
  andes: 23975,
  provincia: 9858,
  provincias: 9858,
  bolivia: 29594,
  paraguay: 8181,
  brasil: 8044,
  uruguay: 8244,
  chile: 8071,
  verdadero: 8715,
  falso: null,
  si: 5584,
  no: 5526,
  nieve: 7172,
  sol: 7252,
  lluvia: 7148,
  nube: 2883,
  arbol: 3057,
  bosque: 2666,
  calor: 35561,
  frio: 4652,
  mojarse: 32464,
  paraguas: 2500,
  esquiar: 16701,
  gente: 7117,
  poblacion: 2823,
  gobierno: 21906,
  territorio: null,
  presidente: 15326,
  hola: 6522,
  hoy: 7131,
  listo: 17004,
  continuar: 24998,
  cambiar: 37360,
  marcar: 30510,
  marca: 30510,
  selecciona: 30510,
  elegir: 30510,
  escoger: 30510,
  todos: 5596,
  todas: 5596,
  preguntar: 9847,
  respuesta: 39692,
  repasar: 15475,
  repasemos: 15475,
  ejercicio: 11263,
  clase: 9815,
  grande: 4658,
  arriba: 5388,
  abajo: 5355,
};

export function normalize(word: string): string {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.,;:!?¡¿"']/g, "");
}

/** Single word with optional explicit pic; falls back to ARASAAC lookup. */
export const W = (word: string, pic?: number): PhraseUnit => {
  if (pic !== undefined) return { word, pic };
  const found = ARASAAC[normalize(word)];
  return found ? { word, pic: found } : { word };
};

export const BR: PhraseUnit = { break: true };

/**
 * Plain-text → PhraseUnit[]. Splits on whitespace (each word = one cell),
 * newlines become explicit BR markers (line break in the SAAC grid).
 */
export function tokenizePhrase(text: string): PhraseUnit[] {
  const units: PhraseUnit[] = [];
  text.split("\n").forEach((line, idx) => {
    if (idx > 0) units.push(BR);
    line.trim().split(/\s+/).forEach((token) => {
      if (token) units.push(W(token));
    });
  });
  return units;
}

/** Tagged template literal variant — `tw\`Argentina está en América.\`` */
export const tw = (strings: TemplateStringsArray): PhraseUnit[] => {
  return tokenizePhrase(strings.join(""));
};
