import { W, BR, tw, type PhraseUnit } from "./phrase-tokenizer.js";

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

export type { PhraseUnit };

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
  ep(tw`Al norte, Argentina limita con Bolivia.
Bolivia queda arriba.`),
  ep(tw`Al noreste, Argentina limita
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
      text: "Marcá los países limítrofes con Argentina.",
      options: [
        { label: "Bolivia", image: flag("Bolivia") },
        { label: "Brasil", image: flag("Brazil") },
        { label: "Uruguay", image: flag("Uruguay") },
        { label: "Chile", image: flag("Chile") },
        { label: "Perú", image: flag("Peru") },
        { label: "Ecuador", image: flag("Ecuador") },
      ],
      correct_indices: [0, 1, 2, 3],
    },
  },
  fb(
    "Bolivia, Brasil, Uruguay y Chile limitan con Argentina. El quinto, Paraguay, también es limítrofe (lo nombramos antes). Perú y Ecuador están más al norte de Sudamérica, no limitan con Argentina.",
  ),
  ep(tw`Ya sabés cuáles son los 5 países limítrofes de Argentina.`),
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
  ep(tw`Argentina tiene varias provincias que limitan con la Cordillera.`),
  vimg(
    wm("Argentina politico.svg", 720),
    "Mapa político de Argentina con todas las provincias",
    "Mapa político de Argentina. Cada provincia tiene su nombre. Las que están al oeste limitan con la Cordillera."
  ),
  ep(tw`Hoy vamos a aprender cuatro de ellas, una por cada zona del país.`),
  ep(tw`Del norte: Salta y Catamarca.`),
  ep(tw`Del centro: Mendoza.`),
  ep(tw`Del sur: Santa Cruz.`),
  vimg(
    wm("Mapas escolares del Instituto Geográfico Nacional (Argentina) - Provincia de Córdoba - Político (2016).jpg", 720),
    "Mapa político escolar de la provincia de Córdoba",
    "Esta es Córdoba, tu provincia. Está en el centro de Argentina. Córdoba no limita con los Andes."
  ),
  ep(tw`Ahora la pregunta de tu cuaderno.`),
  {
    block_kind: "question",
    content: {
      kind: "multi_select",
      text: "Marcá las provincias que limitan con la Cordillera de los Andes.",
      options: [
        "Mendoza",
        "Misiones",
        "Salta",
        "Buenos Aires",
        "Catamarca",
        "Santa Cruz",
      ],
      correct_indices: [0, 2, 4, 5],
    },
  },
  fb(
    "Mendoza, Salta, Catamarca y Santa Cruz limitan con los Andes. Misiones está al noreste y Buenos Aires al centro-este, lejos de la Cordillera.",
  ),
  ep(tw`Ya sabés que estas cuatro provincias tienen los Andes en su límite oeste.`),
];

// ----- Topic 3: Verdadero o falso geográfico -----
const VF_GEOGRAFICO: StubBlock[] = [
  ep(tw`Vamos a pensar dos frases. En cada una decís si es verdadera o falsa.`),
  ep(tw`Tomate tu tiempo. No hay apuro.`),
  ep(tw`Primera frase. Pensemos en los mares y océanos.`),
  ep(tw`Argentina tiene mucha costa al este, al lado del océano Atlántico.`),
  ep(tw`La parte del Atlántico que limita con Argentina se llama Mar Argentino.`),
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
  ep(tw`Ya sabés dos cosas del territorio: Argentina tiene costa al Atlántico pero no al Pacífico.`),
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
  fb("El territorio es el espacio físico donde está el país: suelo, agua y cielo."),

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
  fb("La población son todas las personas que viven en el país: chicos, grandes, abuelos."),

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
        "Los policías y soldados del país.",
        "Las personas que dirigen y deciden por el país.",
      ],
      correct_index: 2,
    },
  },
  fb(
    "Las autoridades son las personas que dirigen el país: el Presidente, los gobernadores y los intendentes. Los policías y soldados protegen, pero no son los que deciden.",
  ),
  ep(tw`Ya sabés tres palabras importantes: territorio, población y autoridades.`),
];

// ----- Topic 5: Leer mapas con símbolos -----
const MAPAS_SIMBOLOS: StubBlock[] = [
  ep(tw`Hoy vamos a aprender a leer mapas con símbolos.`),
  ep(tw`Los mapas usan dibujos llamados símbolos.`),
  ep(tw`Cada símbolo nos cuenta algo del lugar en el mapa.`),
  v("cuaderno_mapa", "Abrí tu cuaderno en la página del mapa con símbolos. Vas a ver dibujos de nieve, sol, lluvia, montañas y bosques."),
  ep(tw`Vamos a ver los cinco símbolos uno por uno.`),
  ep(tw`Nieve. El símbolo de nieve significa que ahí hay nieve.`),
  ep(tw`Sol. El símbolo de sol significa que ahí hace calor.`),
  ep(tw`Lluvia. El símbolo de lluvia significa que ahí llueve mucho.`),
  ep(tw`Montaña. El símbolo de montaña significa que hay montañas.`),
  ep(tw`Bosque. El símbolo de bosque significa que hay árboles.`),
  ep(tw`Ahora vamos a usar estos símbolos en preguntas.`),

  ep(tw`Primera pregunta.`),
  ep(tw`Quiero estrenar mis esquíes nuevos. Para esquiar necesito nieve.`),
  {
    block_kind: "question",
    content: {
      kind: "multiple_choice",
      text: "Para usar esquíes, voy a un lugar con...",
      options: ["sol", "nieve", "lluvia"],
      correct_index: 1,
    },
  },
  fb("Para esquiar necesitás nieve. Vas al lugar marcado con nieve en el mapa."),

  ep(tw`Segunda pregunta.`),
  ep(tw`Quiero estrenar mi paraguas nuevo. Pero hoy no quiero mojarme.`),
  {
    block_kind: "question",
    content: {
      kind: "multiple_choice",
      text: "Si no quiero mojarme, evito el lugar con...",
      options: ["sol", "nieve", "lluvia"],
      correct_index: 2,
    },
  },
  fb("La lluvia te moja, así que evitás el lugar marcado con lluvia."),

  ep(tw`Tercera pregunta.`),
  ep(tw`Tengo mucho calor y quiero sacarme el pulóver. Necesito un lugar donde haga calor.`),
  {
    block_kind: "question",
    content: {
      kind: "multiple_choice",
      text: "Para sacarme el pulóver, voy al lugar con...",
      options: ["nieve", "montaña", "sol"],
      correct_index: 2,
    },
  },
  fb("El sol significa que hace calor. Ahí te podés sacar el pulóver."),
  ep(tw`Ya sabés leer cinco símbolos del mapa: nieve, sol, lluvia, montaña y bosque.`),
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

/** Full block sequence for a topic (hand-crafted registry, or default fallback). */
export function getAllStubBlocks(topicId: string): StubBlock[] {
  return TOPIC_BLOCKS[topicId] ?? DEFAULT_BLOCKS;
}

export function stubSessionSummary(topicId: string): string {
  return TOPIC_SUMMARIES[topicId] ?? DEFAULT_SUMMARY;
}
