// An option can be a bare label, or an object with a visual (image url + alt).
export type QuestionOption = string | { label: string; image?: { src: string; alt: string } };

export type QuestionContent =
  | { kind: "multiple_choice"; text: string; options: QuestionOption[]; correct_index: number }
  | { kind: "multi_select"; text: string; options: QuestionOption[]; correct_indices: number[] }
  | { kind: "true_false"; text: string; correct: boolean };

// Wikimedia flag URL helper. Country names in English (Wikimedia convention).
export const flag = (country: string): { src: string; alt: string } => ({
  src: `https://commons.wikimedia.org/wiki/Special:FilePath/Flag_of_${country}.svg`,
  alt: `Bandera de ${country}`,
});

// Pictogram-supported phrase: a sequence of words, each optionally backed by
// an ARASAAC pictogram id. {break:true} forces a line break in the grid.
export type PhraseUnit =
  | { word: string; pic?: number }
  | { break: true };

export interface VisualContent {
  visual_kind: string;
  caption: string;
  show?: string[];
  image_src?: string;
  image_alt?: string;
}

export type StubBlock =
  | { block_kind: "explanation"; content: { text: string; phrase?: PhraseUnit[] } }
  | { block_kind: "visual"; content: VisualContent }
  | { block_kind: "question"; content: QuestionContent }
  | { block_kind: "feedback"; content: { text: string; tone: "positive" | "redirect"; phrase?: PhraseUnit[] } };

// ARASAAC pictogram IDs by normalized keyword (lowercase, no accents, no punct).
// null = no good pictogram, render word without image.
const ARASAAC: Record<string, number | null> = {
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
  marca_: 30510,
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

function normalize(word: string): string {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.,;:!?¡¿"']/g, "");
}

// W("Argentina") -> auto-lookup pictogram by word. W("foo", 1234) -> explicit pic.
const W = (word: string, pic?: number): PhraseUnit => {
  if (pic !== undefined) return { word, pic };
  const found = ARASAAC[normalize(word)];
  return found ? { word, pic: found } : { word };
};
const BR: PhraseUnit = { break: true };

// Tagged template literal: tw`Argentina está en América.` -> auto-tokenizes and
// looks up pictograms. Newlines become BR (line breaks in the grid).
const tw = (strings: TemplateStringsArray): PhraseUnit[] => {
  const text = strings.join("");
  const units: PhraseUnit[] = [];
  text.split("\n").forEach((line, idx) => {
    if (idx > 0) units.push(BR);
    line.trim().split(/\s+/).forEach((token) => {
      if (token) units.push(W(token));
    });
  });
  return units;
};

// Plain text explanation (no pictograms).
const e = (text: string): StubBlock => ({ block_kind: "explanation", content: { text } });

// Pictogram-supported explanation. Pass tw`...` template result.
const ep = (phrase: PhraseUnit[]): StubBlock => {
  const text = phrase
    .filter((u): u is { word: string; pic?: number } => "word" in u)
    .map((u) => u.word)
    .join(" ");
  return { block_kind: "explanation", content: { text, phrase } };
};

const v = (visual_kind: string, caption: string, show?: string[]): StubBlock => ({
  block_kind: "visual",
  content: show && show.length ? { visual_kind, caption, show } : { visual_kind, caption },
});

// Image-based visual block (e.g. Wikimedia map). The src is fetched
// directly by the browser. width param keeps download size sensible.
const vimg = (src: string, alt: string, caption: string): StubBlock => ({
  block_kind: "visual",
  content: { visual_kind: "image", caption, image_src: src, image_alt: alt },
});

// Wikimedia Commons file URL with a reasonable thumb width.
const wm = (file: string, width = 720): string =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;
const fb = (text: string, tone: "positive" | "redirect" = "positive"): StubBlock => ({
  block_kind: "feedback",
  content: { text, tone },
});

// =============================================================================
// Topic content
// =============================================================================

// ----- Topic 1: Países limítrofes con Argentina -----
const PAISES_LIMITROFES: StubBlock[] = [
  ep(tw`Hola, Sofi.
Hoy vamos a ver los países
limítrofes con Argentina.`),
  ep(tw`Un país limítrofe es un país
que está al lado del nuestro.`),
  ep(tw`También se le dice país vecino.`),
  ep(tw`Argentina está al sur
de América del Sur.`),
  ep(tw`Está rodeada por otros países
y por el océano Atlántico.`),
  v("argentina_map", "Argentina y los países vecinos que la rodean.", ["neighbors"]),
  ep(tw`Argentina tiene 5 países limítrofes.
Los vamos a ver uno por uno.`),
  ep(tw`Al norte, Argentina toca con Bolivia.
Bolivia queda arriba.`),
  ep(tw`Al noreste, Argentina toca
con Paraguay y con Brasil.`),
  ep(tw`Brasil es el país más grande
de Sudamérica.`),
  ep(tw`Al este, separados por un río,
está Uruguay.`),
  ep(tw`El río que separa Argentina
de Uruguay se llama Río de la Plata.`),
  ep(tw`Al oeste, a lo largo de toda la
Cordillera de los Andes, está Chile.`),
  ep(tw`Repasemos los 5: Bolivia, Paraguay,
Brasil, Uruguay y Chile.`),
  {
    block_kind: "question",
    content: {
      kind: "multi_select",
      text: "Marcá todos los países que son limítrofes con Argentina.",
      options: [
        { label: "Ecuador", image: flag("Ecuador") },
        { label: "Perú", image: flag("Peru") },
        { label: "Colombia", image: flag("Colombia") },
        { label: "Bolivia", image: flag("Bolivia") },
        { label: "Paraguay", image: flag("Paraguay") },
        { label: "Brasil", image: flag("Brazil") },
        { label: "Venezuela", image: flag("Venezuela") },
        { label: "Uruguay", image: flag("Uruguay") },
        { label: "Chile", image: flag("Chile") },
      ],
      correct_indices: [3, 4, 5, 7, 8],
    },
  },
  fb(
    "Argentina tiene 5 países limítrofes: Bolivia, Paraguay, Brasil, Uruguay y Chile. Los otros (Ecuador, Perú, Colombia, Venezuela) están en América del Sur, pero más al norte, no tocan con Argentina.",
  ),
];

// ----- Topic 2: Provincias con la Cordillera de los Andes -----
const PROVINCIAS_ANDES: StubBlock[] = [
  ep(tw`Ahora vamos a hablar de la Cordillera de los Andes.`),
  ep(tw`Una cordillera es una cadena de montañas, una al lado de la otra.`),
  ep(tw`Como una pared larga hecha de muchas montañas.`),
  ep(tw`La Cordillera de los Andes es muy larga.`),
  ep(tw`Recorre casi toda América del Sur, de norte a sur.`),
  ep(tw`En Argentina, los Andes están en el oeste del país.`),
  ep(tw`El oeste es el lado izquierdo cuando mirás el mapa.`),
  ep(tw`Los Andes separan a Argentina de Chile.`),
  ep(tw`Funcionan como una pared natural muy alta entre los dos países.`),
  v("argentina_map", "La Cordillera está pegada al borde izquierdo de Argentina, en el oeste.", ["cordillera"]),
  ep(tw`Hay varias provincias argentinas que tocan con los Andes.`),
  vimg(
    wm("Argentina politico.svg", 720),
    "Mapa político de Argentina con todas las provincias",
    "Mapa político de Argentina. Cada provincia tiene su nombre. Las que están al oeste tocan con la Cordillera."
  ),
  ep(tw`Las del norte: Jujuy, Salta, Tucumán, Catamarca y La Rioja.`),
  ep(tw`Las del centro: San Juan y Mendoza.`),
  ep(tw`Las del sur: Neuquén, Río Negro, Chubut y Santa Cruz.`),
  vimg(
    wm("Mapas escolares del Instituto Geográfico Nacional (Argentina) - Provincia de Córdoba - Político (2016).jpg", 720),
    "Mapa político escolar de la provincia de Córdoba",
    "Esta es Córdoba, tu provincia. Está en el centro de Argentina."
  ),
  ep(tw`Ahora vamos a ver la lista de tu cuaderno.`),
  {
    block_kind: "question",
    content: {
      kind: "multi_select",
      text: "De estas provincias, marcá las que tienen una parte de su límite con la Cordillera de los Andes.",
      options: [
        "Formosa",
        "Mendoza",
        "Misiones",
        "Santa Cruz",
        "Buenos Aires",
        "Salta",
        "La Pampa",
        "Entre Ríos",
        "Catamarca",
      ],
      correct_indices: [1, 3, 5, 8],
    },
  },
  fb(
    "Las que tienen los Andes son: Mendoza, Salta, Catamarca y Santa Cruz. Las otras (Formosa, Misiones, Buenos Aires, La Pampa, Entre Ríos) están en otras zonas del país, no en el oeste.",
  ),
];

// ----- Topic 3: Verdadero o falso geográfico -----
const VF_GEOGRAFICO: StubBlock[] = [
  ep(tw`Vamos a pensar dos frases. En cada una decís si es verdadera o falsa.`),
  ep(tw`Tomate tu tiempo. No hay apuro.`),
  ep(tw`Primera frase. Pensemos en los mares y océanos.`),
  ep(tw`Argentina tiene mucha costa al este, al lado del océano Atlántico.`),
  ep(tw`La parte del Atlántico que toca con Argentina se llama Mar Argentino.`),
  ep(tw`Las provincias que tienen costa al Mar Argentino son cinco.`),
  ep(tw`Son: Buenos Aires, Río Negro, Chubut, Santa Cruz y Tierra del Fuego.`),
  ep(tw`Las nombramos otra vez: Buenos Aires, Río Negro, Chubut, Santa Cruz, Tierra del Fuego. Cinco.`),
  {
    block_kind: "question",
    content: {
      kind: "true_false",
      text: "Solo tres provincias argentinas tienen costas sobre el Mar Argentino.",
      correct: false,
    },
  },
  fb(
    "Es falso. Son cinco provincias con costa al Mar Argentino: Buenos Aires, Río Negro, Chubut, Santa Cruz y Tierra del Fuego.",
  ),
  ep(tw`Segunda frase. Ahora vamos al otro océano.`),
  ep(tw`El océano Pacífico está del otro lado de Sudamérica, al oeste.`),
  ep(tw`Pero entre Argentina y el Pacífico hay otro país: Chile.`),
  ep(tw`Chile bloquea el paso al Pacífico para Argentina.`),
  ep(tw`Por eso, ninguna provincia argentina llega al océano Pacífico.`),
  {
    block_kind: "question",
    content: {
      kind: "true_false",
      text: "Ninguna provincia argentina tiene costas sobre el Océano Pacífico.",
      correct: true,
    },
  },
  fb(
    "Es verdad. Chile está entre Argentina y el Pacífico, así que ninguna provincia argentina llega a ese océano.",
  ),
];

// ----- Topic 4: Territorio, población y autoridades -----
const TERRITORIO_POBLACION_GOBIERNO: StubBlock[] = [
  ep(tw`Hoy vamos a aprender tres palabras importantes sobre un país.`),
  ep(tw`Esas palabras son: territorio, población y autoridades de gobierno.`),
  ep(tw`Cada una nos dice algo distinto del país.`),
  ep(tw`Vamos a verlas una por una.`),

  ep(tw`Primera palabra: TERRITORIO.`),
  ep(tw`El territorio es el espacio donde está el país.`),
  ep(tw`Es el suelo, los ríos, los lagos, las montañas, las costas.`),
  ep(tw`También es el cielo que está arriba del país.`),
  ep(tw`Argentina tiene un territorio grande, con montañas, pampa, ríos y costa.`),
  {
    block_kind: "question",
    content: {
      kind: "multiple_choice",
      text: "¿Qué es el territorio de un país?",
      options: [
        "El espacio donde está el país: suelo, agua y cielo.",
        "Las personas que viven en el país.",
        "Las personas que mandan en el país.",
      ],
      correct_index: 0,
    },
  },
  fb("Bien. El territorio es el espacio físico donde está el país."),

  ep(tw`Segunda palabra: POBLACIÓN.`),
  ep(tw`La población son las personas que viven en un lugar.`),
  ep(tw`La población de Argentina son todos los que viven en Argentina.`),
  ep(tw`Hombres, mujeres, niños y niñas, abuelos y abuelas. Todos.`),
  {
    block_kind: "question",
    content: {
      kind: "multiple_choice",
      text: "¿Qué es la población de un país?",
      options: [
        "Las montañas y los ríos del país.",
        "Las personas que viven en el país.",
        "Las leyes del país.",
      ],
      correct_index: 1,
    },
  },
  fb("Bien. La población son las personas que viven en el país."),

  ep(tw`Tercera palabra: AUTORIDADES DE GOBIERNO.`),
  ep(tw`Las autoridades son las personas que dirigen y deciden cosas para el país.`),
  ep(tw`En Argentina, la persona principal del gobierno se llama Presidente.`),
  ep(tw`También hay gobernadores, que dirigen cada provincia.`),
  ep(tw`Y hay intendentes, que dirigen cada ciudad.`),
  {
    block_kind: "question",
    content: {
      kind: "multiple_choice",
      text: "¿Quiénes son las autoridades de gobierno?",
      options: [
        "Las personas que viven en el país.",
        "Los animales del país.",
        "Las personas que dirigen y deciden por el país.",
      ],
      correct_index: 2,
    },
  },
  fb(
    "Bien. Las autoridades son las personas que dirigen el país: el Presidente, los gobernadores y los intendentes.",
  ),
];

// ----- Topic 5: Leer mapas con símbolos -----
const MAPAS_SIMBOLOS: StubBlock[] = [
  ep(tw`Hoy vamos a aprender a leer mapas con símbolos.`),
  ep(tw`Los mapas usan dibujos chiquitos llamados símbolos o referencias.`),
  ep(tw`Cada símbolo nos cuenta algo de ese lugar.`),
  ep(tw`Mirá los símbolos que usamos hoy:`),
  ep(tw`🏔️ una montañita significa que hay montañas.`),
  ep(tw`❄️ un copito de nieve significa que ahí hay nieve.`),
  ep(tw`☀️ un sol significa que ahí hace calor.`),
  ep(tw`🌧️ una nube con lluvia significa que llueve mucho.`),
  ep(tw`🌲 un árbol significa que hay bosque.`),
  ep(tw`Ahora vamos a usar estos símbolos para responder algunas preguntas.`),

  ep(tw`Primera pregunta.`),
  ep(tw`Quiero estrenar mis esquíes nuevos.`),
  ep(tw`Para esquiar, necesito nieve.`),
  {
    block_kind: "question",
    content: {
      kind: "multiple_choice",
      text: "Para usar esquíes, voy a un lugar con...",
      options: ["☀️ sol", "❄️ nieve", "🌧️ lluvia"],
      correct_index: 1,
    },
  },
  fb("Bien. Para esquiar necesitás nieve. Vas al lugar con el símbolo de nieve."),

  ep(tw`Segunda pregunta.`),
  ep(tw`Quiero estrenar mi paraguas nuevo.`),
  ep(tw`Pero hoy no quiero mojarme.`),
  ep(tw`Si NO quiero mojarme, ¿adónde NO voy?`),
  {
    block_kind: "question",
    content: {
      kind: "multiple_choice",
      text: "Si no quiero mojarme, evito el lugar con...",
      options: ["☀️ sol", "❄️ nieve", "🌧️ lluvia"],
      correct_index: 2,
    },
  },
  fb("Bien. La lluvia te moja, así que evitás el lugar con la nube de lluvia."),

  ep(tw`Tercera pregunta.`),
  ep(tw`Tengo mucho calor y quiero sacarme el pulóver.`),
  ep(tw`Necesito un lugar donde haga calor.`),
  {
    block_kind: "question",
    content: {
      kind: "multiple_choice",
      text: "Para sacarme el pulóver, voy al lugar con...",
      options: ["❄️ nieve", "🏔️ montaña", "☀️ sol"],
      correct_index: 2,
    },
  },
  fb("Bien. El sol significa que hace calor, así que ahí te podés sacar el pulóver."),
];

// =============================================================================
// Registry + default fallback
// =============================================================================

const TOPIC_BLOCKS: Record<string, StubBlock[]> = {
  "44444444-4444-4444-4444-444444444401": PAISES_LIMITROFES,
  "44444444-4444-4444-4444-444444444402": PROVINCIAS_ANDES,
  "44444444-4444-4444-4444-444444444403": VF_GEOGRAFICO,
  "44444444-4444-4444-4444-444444444404": TERRITORIO_POBLACION_GOBIERNO,
  "44444444-4444-4444-4444-444444444405": MAPAS_SIMBOLOS,
};

const DEFAULT_BLOCKS: StubBlock[] = [
  ep(tw`Las provincias se agrupan en regiones. Hoy vamos a ver el Noroeste argentino, el NOA.`),
  v("cuaderno_mapa", "Abrí tu cuaderno en la página del mapa de Argentina. El NOA es la zona del norte, arriba a la izquierda."),
  {
    block_kind: "question",
    content: {
      kind: "multiple_choice",
      text: "¿Cuál de estas provincias es del NOA?",
      options: ["Jujuy", "Río Negro", "Mendoza"],
      correct_index: 0,
    },
  },
  fb("Bien. Jujuy queda al norte, dentro del NOA."),
];

const TOPIC_SUMMARIES: Record<string, string> = {
  "44444444-4444-4444-4444-444444444401":
    "Hoy aprendiste que Argentina tiene 5 países limítrofes: Bolivia, Paraguay, Brasil, Uruguay y Chile.",
  "44444444-4444-4444-4444-444444444402":
    "Hoy aprendiste que la Cordillera de los Andes está en el oeste de Argentina, separa a Argentina de Chile, y pasa por Mendoza, Salta, Catamarca y Santa Cruz, entre otras.",
  "44444444-4444-4444-4444-444444444403":
    "Hoy repasaste que Argentina tiene 5 provincias con costa al Mar Argentino y que ninguna llega al océano Pacífico porque Chile está en el medio.",
  "44444444-4444-4444-4444-444444444404":
    "Hoy aprendiste 3 palabras importantes: territorio (el espacio donde está el país), población (las personas que viven ahí) y autoridades de gobierno (las personas que dirigen).",
  "44444444-4444-4444-4444-444444444405":
    "Hoy aprendiste a leer mapas con símbolos: ❄️ nieve, ☀️ sol, 🌧️ lluvia, 🏔️ montaña, 🌲 bosque.",
};

const DEFAULT_SUMMARY =
  "Hoy aprendiste que Jujuy es una provincia del NOA y dónde queda en el mapa.";

export function nextStubBlock(topicId: string, stepIndex: number): StubBlock | null {
  const blocks = TOPIC_BLOCKS[topicId] ?? DEFAULT_BLOCKS;
  if (stepIndex < 0 || stepIndex >= blocks.length) return null;
  return blocks[stepIndex];
}

export function totalStubBlocks(topicId: string): number {
  return (TOPIC_BLOCKS[topicId] ?? DEFAULT_BLOCKS).length;
}

export function stubSessionSummary(topicId: string): string {
  return TOPIC_SUMMARIES[topicId] ?? DEFAULT_SUMMARY;
}
