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
  // Ampliación tras audit de issue #15 + regeneración de Capitales
  capital: null, // ARASAAC no tiene pictograma claro para "capital"
  capitales: null,
  importante: 11470,
  importantes: 11470,
  mejor: 11470,
  igual: 4667,
  iguales: 4667,
  mismo: 4667,
  misma: 4667,
  conocer: 6993,
  conoce: 6993,
  aprender: 37810,
  aprende: 37810,
  aprendes: 37810,
  aprendiste: 37810,
  recordar: 37369,
  recuerda: 37369,
  practicar: null, // sin pictograma decente en ARASAAC
  practica: null,
  ya: 25736,
  sabes: null, // pictograma matchea "yuca", no útil
  // Topónimos: la palabra en mayúsculas alcanza, sin pictograma genérico
  buenos: null,
  aires: null,
  mendoza: null,
  cordoba: null,
  plata: null,
  turistica: null,

  // ===========================================================================
  // Expansión grande (mayo 2026) — IDs validados via API de ARASAAC.
  // Cuando una palabra matchea un pictograma con sentido distinto al deseado
  // (ej. "oracion" matchea "rezar"), marcamos `null` para no usar pictograma
  // incorrecto y dejar la palabra sola.
  // ===========================================================================

  // --- Verbos comunes ---
  hablar: 6517, habla: 6517, hablas: 6517, hablamos: 6517,
  escuchar: 6572, escucha: 6572, escuchas: 6572,
  saber: 16885, sabe: 16885,
  tener: 32761, tiene: 32761, tienen: 32761, tienes: 32761, tenemos: 32761, tengo: 32761,
  decir: 9693, dice: 9693, dicen: 9693, decimos: 9693,
  hacer: 32751, hace: 32751, hacen: 32751, hacemos: 32751,
  ir: 8142, va: 8142, vamos: 8142, voy: 8142, van: 8142, vas: 8142,
  venir: 32669, viene: 32669, vienen: 32669,
  comer: 6456, come: 6456, comen: 6456, comemos: 6456,
  beber: 6061, bebe: 6061,
  dormir: 6479, duerme: 6479,
  jugar: 23392, juega: 23392,
  trabajar: 6624, trabaja: 6624,
  estudiar: 6495, estudia: 6495,
  abrir: 24825, abre: 24825,
  cerrar: 24976, cierra: 24976,
  empezar: 5431, empieza: 5431, empezamos: 5431,
  terminar: 28429, termina: 28429, terminamos: 28429,
  ayudar: 32648, ayuda: 32648, ayudame: 32648,
  esperar: 36914, espera: 36914,
  buscar: 6947, busca: 6947,
  encontrar: 24773, encuentra: 24773,
  querer: 11538, quiero: 11538, queres: 11538, queremos: 11538,
  poder: 35949, puede: 35949, pueden: 35949, podemos: 35949,
  dar: 28431, damos: 28431,
  tomar: 10148, toma: 10148,
  mostrar: 16823, muestra: 16823, mostramos: 16823,
  observar: 6564, observa: 6564, observamos: 6564,
  explicar: 8579, explica: 8579, explico: 8579,
  sumar: 5868, suma: 5868, sumamos: 5868, sumas: 5868,
  restar: 5841, resta: 5841,
  multiplicar: 5798,
  dividir: 27069, divide: 27069,
  calcular: 8518, calcula: 8518,
  medir: 5510, mide: 5510,
  dibujar: 8088, dibuja: 8088,
  pintar: 2348, pinta: 2348,
  completar: 13078, completa: 13078, completamos: 13078,
  comprar: 8986, compra: 8986,
  vender: 6652, vende: 6652,
  vivir: 11605, vive: 11605, viven: 11605, vivimos: 11605, vivo: 11605, viva: 11605,
  nacer: 8176, nace: 8176,
  crecer: 7002, crece: 7002, crecemos: 7002,
  alimentar: 11176, alimenta: 11176, alimentan: 11176,
  respirar: 34377, respira: 34377, respiramos: 34377,

  // --- Sustantivos comunes ---
  casa: 6964, casas: 6964,
  escuela: 32446, escuelas: 32446, colegio: 32446,
  libro: 25191, libros: 25191,
  lapiz: 2440, lapices: 2440,
  silla: 3155, sillas: 3155,
  puerta: 3244, puertas: 3244,
  ventana: 2611, ventanas: 2611,
  dia: 37731, dias: 37731,
  noche: 26997, noches: 26997,
  ano: 6903, anos: 6903, año: 6903, // por si la normalización deja la ñ
  semana: 37732, semanas: 37732,
  hora: 7129, horas: 7129,
  comida: 4610, comidas: 4610,
  leche: 2445,
  pan: 2494,
  fruta: 28339, frutas: 28339,
  ropa: 7233, ropas: 7233,
  zapato: 32923, zapatos: 32923,
  calle: 2299, calles: 2299,
  plaza: 6184, plazas: 6184,
  parque: 2859, parques: 2859,
  jardin: 2434, jardines: 2434,
  animal: 8025, animales: 8025,
  perro: 7202, perros: 7202, perra: 7202,
  gato: 7114, gatos: 7114, gata: 7114,
  vaca: 2609, vacas: 2609,
  oveja: 2489, ovejas: 2489, cordero: 2489,
  gallina: 2403, gallinas: 2403,
  cerdo: 24972, cerdos: 24972, chancho: 24972,
  caballo: 2294, caballos: 2294, yegua: 2294,
  pollo: 2533, pollos: 2533, pollito: 2533, pollitos: 2533,
  planta: 3143, plantas: 3143,
  flor: 7104, flores: 7104,
  lago: 6022, lagos: 6022,
  luna: 2933,
  estrella: 2752, estrellas: 2752,
  viento: 7259,
  tierra: 3160,
  aire: 23731,
  fuego: 4654,
  agua: 32464, aguas: 32464,
  ciudad: 2704, ciudades: 2704,

  // --- Familia ---
  papi: 31146,
  mama: 2458, mami: 2458,
  hijo: 9887, hija: 9887, hijos: 9887, hijas: 9887,
  hermano: 2423, hermana: 2423, hermanos: 2423, hermanas: 2423,
  amigo: 25790, amiga: 25790, amigos: 25790, amigas: 25790,
  familia: 38351, familias: 38351,
  abuelo: 25790, abuela: 25790, abuelos: 25790, abuelas: 25790,
  persona: 7117, personas: 7117,

  // --- Números ---
  uno: 2627,
  dos: 2628,
  tres: 2629,
  cuatro: 2630,
  cinco: 2631,
  seis: 2632,
  siete: 2633,
  ocho: 2634,
  nueve: 2635,
  diez: 7025,
  numero: 2879, numeros: 2879,

  // --- Cuerpo humano ---
  cuerpo: 6473,
  cabeza: 2673,
  mano: 2928, manos: 2928,
  pie: 25327, pies: 25327,
  ojo: 6573, ojos: 6573,
  boca: 2663,
  corazon: 4613, corazones: 4613,
  estomago: 3309,
  intestino: 2967, intestinos: 2967,
  higado: 2980,
  pulmon: 8365, pulmones: 8365,
  sangre: 2803,
  musculo: 2891, musculos: 2891,
  hueso: 2972, huesos: 2972,
  piel: 2840,

  // --- Matemática ---
  // (sumar/suma/restar/resta ya definidos en verbos arriba)
  verbo: 7297, verbos: 7297,
  fraccion: 5739, fracciones: 5739,
  medida: 9834, medidas: 9834,
  longitud: 9834,
  metro: 26925, metros: 26925,
  litro: 7145, litros: 7145,
  kilo: 7138, kilos: 7138,
  gramo: 7138, gramos: 7138,
  kilogramo: 7138, kilogramos: 7138,
  kilometro: 29076, kilometros: 29076,
  cuadrado: 4616, cuadrados: 4616,
  circulo: 4603, circulos: 4603,
  rectangulo: 4731, rectangulos: 4731,
  triangulo: 2604, triangulos: 2604,

  // --- Adjetivos comunes ---
  nuevo: 11316, nueva: 11316, nuevos: 11316, nuevas: 11316,
  viejo: 11394, vieja: 11394, viejos: 11394, viejas: 11394,
  alto: 25782, alta: 25782, altos: 25782, altas: 25782,
  bajo: 25839, baja: 25839, bajos: 25839, bajas: 25839,
  facil: 4645, faciles: 4645, sencillo: 4645,
  dificil: 4629, dificiles: 4629,
  rapido: 5306, rapida: 5306, rapidamente: 5306,
  lento: 4676, lenta: 4676,
  caliente: 4583,
  feliz: 9907, contento: 35547, contenta: 35547,
  triste: 35545,
  bonito: 11194, bonita: 11194, lindo: 11194, linda: 11194,
  diferente: 4628, diferentes: 4628,
  mucho: 7168, mucha: 7168,
  poco: 7209, poca: 7209, pocas: 7209,
  mayor: 25796, mayores: 25796,
  menor: 4716, menores: 4716,
  siempre: 17322,
  nunca: 5527,
  algunos: 5374, algunas: 5374, alguno: 5374, alguna: 5374,
  ninguno: 11314, ninguna: 11314, nadie: 11314,
  otro: 17054, otra: 17054, otros: 17054, otras: 17054,

  // --- Lengua / palabras ---
  palabra: 9837, palabras: 9837,
  frase: 27768, frases: 27768,
  letra: 39235, letras: 39235,
  pagina: 20115, paginas: 20115,
  problema: 5556, problemas: 5556,
  nombre: 27357, nombres: 27357,
  grupo: 38444, grupos: 38444,
  centro: 5424,

  // --- Transporte ---
  carro: 2339, coche: 2339, auto: 2339, autos: 2339,
  tren: 21399, trenes: 21399,
  avion: 2264, aviones: 2264,

  // --- Ciencia ---
  clima: 24721,
  evaporacion: 36157,
  condensacion: 36059,
  vapor: 31478,
  liquido: 36325, liquidos: 36325,
  solido: 36323, solidos: 36323,
  herbivoro: 8133, herbivora: 8133, herbivoros: 8133,
  omnivoro: 8180, omnivora: 8180, omnivoros: 8180,
  carnivoro: 8062, carnivora: 8062, carnivoros: 8062,
  carne: 2316, carnes: 2316,
  verdura: 29131, verduras: 29131,
  cereal: 34749, cereales: 34749,
  seres: 10250,

  // --- Geografía / política ---
  ciclo: 24984, ciclos: 24984,
  suelo: 2575, suelos: 2575,
  limite: 32765, limites: 32765,
  frontera: 8483, fronteras: 8483,
  intendente: 3170, intendentes: 3170,
  policia: 37367, policias: 37367,
  soldado: 2797, soldados: 2797,
  ley: 11473, leyes: 11473,

  // --- Palabras que matchean MAL en ARASAAC → null explícito ---
  // (Cualquier pictograma sería peor que nada)
  oracion: null, oraciones: null,    // matchea con "rezar"
  adjetivo: null, adjetivos: null,    // matchea con "arreglado"
  operacion: null, operaciones: null, // matchea con "cirugía"
  decimal: null, decimales: null,     // matchea con "Clasificación Decimal Universal"
  peso: null,                          // matchea con "lanzamiento"
  volumen: null,                       // matchea con "subir el volumen"
  figura: null, figuras: null,         // 404 en API
  sustantivo: null, sustantivos: null, // 404 en API
  sinonimo: null, sinonimos: null,     // 404
  antonimo: null, antonimos: null,     // 404
  significado: null, significados: null, // 404
  zona: null, zonas: null,             // matchea "zona de picnic"
  parte: null, partes: null,           // matchea "estados parte"
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
