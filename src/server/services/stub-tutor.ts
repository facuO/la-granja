export type StubBlock =
  | { block_kind: "explanation"; content: { text: string } }
  | { block_kind: "visual"; content: { visual_kind: string; caption: string } }
  | { block_kind: "question"; content: { kind: "multiple_choice"; text: string; options: string[]; correct_index: number } }
  | { block_kind: "feedback"; content: { text: string; tone: "positive" | "redirect" } };

const PROVINCES_STUB: StubBlock[] = [
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

export function nextStubBlock(stepIndex: number): StubBlock | null {
  if (stepIndex < 0 || stepIndex >= PROVINCES_STUB.length) return null;
  return PROVINCES_STUB[stepIndex];
}

export function totalStubBlocks(): number {
  return PROVINCES_STUB.length;
}

export function stubSessionSummary(): string {
  return "Hoy aprendiste que Jujuy es una provincia del NOA y dónde queda en el mapa.";
}
