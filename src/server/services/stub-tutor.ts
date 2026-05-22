export type QuestionContent =
  | { kind: "multiple_choice"; text: string; options: string[]; correct_index: number }
  | { kind: "multi_select"; text: string; options: string[]; correct_indices: number[] }
  | { kind: "true_false"; text: string; correct: boolean };

export type StubBlock =
  | { block_kind: "explanation"; content: { text: string } }
  | { block_kind: "visual"; content: { visual_kind: string; caption: string } }
  | { block_kind: "question"; content: QuestionContent }
  | { block_kind: "feedback"; content: { text: string; tone: "positive" | "redirect" } };

// Topic-specific block sequences. Each list is a complete session for that topic.
const TOPIC_BLOCKS: Record<string, StubBlock[]> = {
  // Países limítrofes con Argentina
  "44444444-4444-4444-4444-444444444401": [
    {
      block_kind: "explanation",
      content: {
        text: "Argentina está en América del Sur. Tiene países al lado. Esos países son sus vecinos. Se llaman países limítrofes.",
      },
    },
    {
      block_kind: "visual",
      content: {
        visual_kind: "map_argentina",
        caption: "Argentina y sus vecinos en el mapa.",
      },
    },
    {
      block_kind: "question",
      content: {
        kind: "multi_select",
        text: "Marcá todos los países que tocan con Argentina.",
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
    {
      block_kind: "feedback",
      content: {
        text: "Argentina tiene 5 países limítrofes: Bolivia, Paraguay, Brasil, Uruguay y Chile.",
        tone: "positive",
      },
    },
  ],

  // Provincias con la Cordillera de los Andes
  "44444444-4444-4444-4444-444444444402": [
    {
      block_kind: "explanation",
      content: {
        text: "La Cordillera de los Andes es una cadena de montañas larga. Pasa por el oeste de Argentina.",
      },
    },
    {
      block_kind: "visual",
      content: {
        visual_kind: "map_argentina",
        caption: "La Cordillera está al oeste, del lado del Pacífico.",
      },
    },
    {
      block_kind: "question",
      content: {
        kind: "multi_select",
        text: "Marcá las provincias por donde pasa la Cordillera de los Andes.",
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
    {
      block_kind: "feedback",
      content: {
        text: "La Cordillera pasa por Mendoza, Salta, Catamarca y Santa Cruz. Todas están al oeste.",
        tone: "positive",
      },
    },
  ],

  // Verdadero o falso geográfico
  "44444444-4444-4444-4444-444444444403": [
    {
      block_kind: "explanation",
      content: {
        text: "Vamos a pensar si cada frase es verdadera o falsa. Tomá tu tiempo.",
      },
    },
    {
      block_kind: "question",
      content: {
        kind: "true_false",
        text: "Ninguna provincia argentina tiene costas sobre el Océano Pacífico.",
        correct: true,
      },
    },
    {
      block_kind: "feedback",
      content: {
        text: "Es verdad. Chile está entre Argentina y el Océano Pacífico, así que ninguna provincia argentina llega al Pacífico.",
        tone: "positive",
      },
    },
    {
      block_kind: "question",
      content: {
        kind: "true_false",
        text: "Argentina tiene solo tres provincias con costa al Mar Argentino.",
        correct: false,
      },
    },
    {
      block_kind: "feedback",
      content: {
        text: "Es falso. Son cinco: Buenos Aires, Río Negro, Chubut, Santa Cruz y Tierra del Fuego.",
        tone: "positive",
      },
    },
  ],
};

// Default sequence used when the topic is not in the registry (e.g. legacy seed).
const DEFAULT_BLOCKS: StubBlock[] = [
  {
    block_kind: "explanation",
    content: { text: "Las provincias se agrupan en regiones. Hoy vamos a ver el Noroeste argentino, el NOA." },
  },
  {
    block_kind: "visual",
    content: { visual_kind: "map_argentina", caption: "El NOA es esta zona del país, arriba a la izquierda." },
  },
  {
    block_kind: "question",
    content: {
      kind: "multiple_choice",
      text: "¿Cuál de estas provincias es del NOA?",
      options: ["Jujuy", "Río Negro", "Mendoza"],
      correct_index: 0,
    },
  },
  {
    block_kind: "feedback",
    content: { text: "Bien. Jujuy queda al norte, dentro del NOA.", tone: "positive" },
  },
];

const TOPIC_SUMMARIES: Record<string, string> = {
  "44444444-4444-4444-4444-444444444401":
    "Hoy aprendiste que Argentina tiene 5 países limítrofes: Bolivia, Paraguay, Brasil, Uruguay y Chile.",
  "44444444-4444-4444-4444-444444444402":
    "Hoy aprendiste que la Cordillera de los Andes pasa por Mendoza, Salta, Catamarca y Santa Cruz.",
  "44444444-4444-4444-4444-444444444403":
    "Hoy repasaste que Argentina no toca el Pacífico y que tiene 5 provincias con costa al Mar Argentino.",
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
