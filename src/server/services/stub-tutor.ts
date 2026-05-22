export type QuestionContent =
  | { kind: "multiple_choice"; text: string; options: string[]; correct_index: number }
  | { kind: "multi_select"; text: string; options: string[]; correct_indices: number[] }
  | { kind: "true_false"; text: string; correct: boolean };

export type StubBlock =
  | { block_kind: "explanation"; content: { text: string } }
  | { block_kind: "visual"; content: { visual_kind: string; caption: string } }
  | { block_kind: "question"; content: QuestionContent }
  | { block_kind: "feedback"; content: { text: string; tone: "positive" | "redirect" } };

const e = (text: string): StubBlock => ({ block_kind: "explanation", content: { text } });
const v = (visual_kind: string, caption: string): StubBlock => ({
  block_kind: "visual",
  content: { visual_kind, caption },
});
const fb = (text: string, tone: "positive" | "redirect" = "positive"): StubBlock => ({
  block_kind: "feedback",
  content: { text, tone },
});

// =============================================================================
// Topic content
// =============================================================================

// ----- Topic 1: Países limítrofes con Argentina -----
const PAISES_LIMITROFES: StubBlock[] = [
  e("Hola, Sofi. Hoy vamos a ver los países limítrofes con Argentina."),
  e("Un país limítrofe es un país que está al lado del nuestro."),
  e("También se le dice país vecino."),
  e("Argentina está al sur de América del Sur."),
  e("Está rodeada por otros países y por el océano Atlántico."),
  v("map_argentina", "Mirá Argentina en el mapa de tu cuaderno."),
  e("Argentina tiene 5 países limítrofes. Los vamos a ver uno por uno."),
  e("Al norte, Argentina toca con Bolivia. Bolivia queda arriba."),
  e("Al noreste, Argentina toca con Paraguay y con Brasil."),
  e("Brasil es el país más grande de Sudamérica."),
  e("Al este, separados por un río, está Uruguay."),
  e("El río que separa Argentina de Uruguay se llama Río de la Plata."),
  e("Al oeste, a lo largo de toda la Cordillera de los Andes, está Chile."),
  e("Repasemos los 5: Bolivia, Paraguay, Brasil, Uruguay y Chile."),
  {
    block_kind: "question",
    content: {
      kind: "multi_select",
      text: "Marcá todos los países que son limítrofes con Argentina.",
      options: [
        "Ecuador",
        "Perú",
        "Colombia",
        "Bolivia",
        "Paraguay",
        "Brasil",
        "Venezuela",
        "Uruguay",
        "Chile",
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
  e("Ahora vamos a hablar de la Cordillera de los Andes."),
  e("Una cordillera es una cadena de montañas, una al lado de la otra."),
  e("Como una pared larga hecha de muchas montañas."),
  e("La Cordillera de los Andes es muy larga."),
  e("Recorre casi toda América del Sur, de norte a sur."),
  e("En Argentina, los Andes están en el oeste del país."),
  e("El oeste es el lado izquierdo cuando mirás el mapa."),
  e("Los Andes separan a Argentina de Chile."),
  e("Funcionan como una pared natural muy alta entre los dos países."),
  v("map_argentina", "Mirá el mapa: la Cordillera está pegada al borde izquierdo de Argentina."),
  e("Hay varias provincias argentinas que tocan con los Andes."),
  e("Las del norte: Jujuy, Salta, Tucumán, Catamarca y La Rioja."),
  e("Las del centro: San Juan y Mendoza."),
  e("Las del sur: Neuquén, Río Negro, Chubut y Santa Cruz."),
  e("Ahora vamos a ver la lista de tu cuaderno."),
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
  e("Vamos a pensar dos frases. En cada una decís si es verdadera o falsa."),
  e("Tomate tu tiempo. No hay apuro."),
  e("Primera frase. Pensemos en los mares y océanos."),
  e("Argentina tiene mucha costa al este, al lado del océano Atlántico."),
  e("La parte del Atlántico que toca con Argentina se llama Mar Argentino."),
  e("Las provincias que tienen costa al Mar Argentino son cinco."),
  e("Son: Buenos Aires, Río Negro, Chubut, Santa Cruz y Tierra del Fuego."),
  e("Las nombramos otra vez: Buenos Aires, Río Negro, Chubut, Santa Cruz, Tierra del Fuego. Cinco."),
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
  e("Segunda frase. Ahora vamos al otro océano."),
  e("El océano Pacífico está del otro lado de Sudamérica, al oeste."),
  e("Pero entre Argentina y el Pacífico hay otro país: Chile."),
  e("Chile bloquea el paso al Pacífico para Argentina."),
  e("Por eso, ninguna provincia argentina llega al océano Pacífico."),
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
  e("Hoy vamos a aprender tres palabras importantes sobre un país."),
  e("Esas palabras son: territorio, población y autoridades de gobierno."),
  e("Cada una nos dice algo distinto del país."),
  e("Vamos a verlas una por una."),

  e("Primera palabra: TERRITORIO."),
  e("El territorio es el espacio donde está el país."),
  e("Es el suelo, los ríos, los lagos, las montañas, las costas."),
  e("También es el cielo que está arriba del país."),
  e("Argentina tiene un territorio grande, con montañas, pampa, ríos y costa."),
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

  e("Segunda palabra: POBLACIÓN."),
  e("La población son las personas que viven en un lugar."),
  e("La población de Argentina son todos los que viven en Argentina."),
  e("Hombres, mujeres, niños y niñas, abuelos y abuelas. Todos."),
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

  e("Tercera palabra: AUTORIDADES DE GOBIERNO."),
  e("Las autoridades son las personas que dirigen y deciden cosas para el país."),
  e("En Argentina, la persona principal del gobierno se llama Presidente."),
  e("También hay gobernadores, que dirigen cada provincia."),
  e("Y hay intendentes, que dirigen cada ciudad."),
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
  e("Hoy vamos a aprender a leer mapas con símbolos."),
  e("Los mapas usan dibujos chiquitos llamados símbolos o referencias."),
  e("Cada símbolo nos cuenta algo de ese lugar."),
  e("Mirá los símbolos que usamos hoy:"),
  e("🏔️ una montañita significa que hay montañas."),
  e("❄️ un copito de nieve significa que ahí hay nieve."),
  e("☀️ un sol significa que ahí hace calor."),
  e("🌧️ una nube con lluvia significa que llueve mucho."),
  e("🌲 un árbol significa que hay bosque."),
  e("Ahora vamos a usar estos símbolos para responder algunas preguntas."),

  e("Primera pregunta."),
  e("Quiero estrenar mis esquíes nuevos."),
  e("Para esquiar, necesito nieve."),
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

  e("Segunda pregunta."),
  e("Quiero estrenar mi paraguas nuevo."),
  e("Pero hoy no quiero mojarme."),
  e("Si NO quiero mojarme, ¿adónde NO voy?"),
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

  e("Tercera pregunta."),
  e("Tengo mucho calor y quiero sacarme el pulóver."),
  e("Necesito un lugar donde haga calor."),
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
  e("Las provincias se agrupan en regiones. Hoy vamos a ver el Noroeste argentino, el NOA."),
  v("map_argentina", "El NOA es esta zona del país, arriba a la izquierda."),
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
