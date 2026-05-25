import { query } from "../db.js";
import { chatJson } from "../llm/groq.js";
import { config } from "../config.js";
import { tokenizePhrase } from "./phrase-tokenizer.js";
import type { StubBlock, QuestionContent, PhraseUnit } from "./stub-tutor.js";

// --- Raw shape we ask the LLM to produce (intentionally minimal) ---

interface RawExplanation {
  kind: "explanation";
  text: string;
}
interface RawFeedback {
  kind: "feedback";
  text: string;
}
interface RawMultipleChoice {
  kind: "question";
  question: "multiple_choice";
  text: string;
  options: string[];
  correct_index: number;
}
interface RawMultiSelect {
  kind: "question";
  question: "multi_select";
  text: string;
  options: string[];
  correct_indices: number[];
}
interface RawTrueFalse {
  kind: "question";
  question: "true_false";
  text: string;
  correct: boolean;
}
type RawBlock = RawExplanation | RawFeedback | RawMultipleChoice | RawMultiSelect | RawTrueFalse;
interface RawResponse {
  blocks: RawBlock[];
}

// --- Prompt builder (capas como dice el spec) ---

function buildSystemPrompt(): string {
  return `Sos el tutor escolar de Sofi. Estás preparando una microclase de un tema.

PERFIL DE SOFI:
Sofi tiene 10-12 años. Es autista, con afectación leve del cuerpo calloso
posterior y disminución cortical frontal/parietal. Lee bien. Prefiere
lenguaje literal, oraciones cortas, una idea a la vez. Se cansa con
subordinadas y con metáforas no explicadas. Aprende mejor cuando el
contenido se introduce paso a paso antes de cualquier pregunta, y cuando
el feedback explica POR QUÉ — no solo si está bien o mal. Necesita
estructura predecible: anticipación del tema, preguntas con feedback
inmediato, y cierre claro que consolide lo aprendido.

REGLAS NO NEGOCIABLES (no las cambies por ningún motivo):
1. Lenguaje SIEMPRE literal. Sin metáforas no explicadas, sin sarcasmo, sin ironía.
2. Cada oración: MÁXIMO 12 palabras. Una sola idea por oración.
3. Castellano RIOPLATENSE: voseo siempre. "Te muestro", "conocé", "practicá",
   "mirá", "elegí". NUNCA "tú", "conoce", "practica", "mira", "elige".
4. SIN diminutivos por defecto. NO usar "casita", "cosita", "pequeñita", etc.,
   salvo que el referente sea inherentemente diminuto (un pollito sí, una
   provincia no).
5. Sin presión temporal. NO digas "rápido", "vamos ya", "apurate".
6. Validación específica ("acertaste 4 de 5", "marcaste las dos correctas").
   NUNCA genérica ("muy bien", "excelente", "lo lograste").
7. Feedback de error sin "rojo agresivo". Decir lo correcto sin descalificar.
   "La respuesta era X" en vez de "¡Mal!".
8. Sofi tiene 10-12 años. Ya sabe leer. NO infantilices, NO la trates de "nena".
9. Predictibilidad: saludos y cierres breves y constantes.
10. NO sugieras visuales, imágenes ni mapas — eso lo manejamos por separado.

CONTRATO DE SALIDA:
Devolvé EXCLUSIVAMENTE un objeto JSON con clave "blocks" que es un array de bloques. Cada bloque es una de estas formas:

{"kind":"explanation","text":"<una oración corta y concreta>"}

{"kind":"question","question":"multiple_choice","text":"<pregunta>","options":["a","b","c"],"correct_index":0}

{"kind":"question","question":"multi_select","text":"<pregunta>","options":["a","b","c","d","e"],"correct_indices":[0,2]}

{"kind":"question","question":"true_false","text":"<afirmación>","correct":true}

{"kind":"feedback","text":"<refuerzo o corrección amable>"}

ESTRUCTURA REQUERIDA:
- Entre 10 y 16 bloques en total.
- APERTURA: empezá con 4-6 explanations introduciendo el tema paso a paso,
  una idea por bloque. NUNCA arranques con una question.
- ORDEN PREGUNTA→FEEDBACK: toda question DEBE ser seguida en el bloque
  INMEDIATO siguiente por un feedback que responda específicamente a esa
  question. Nada de feedbacks que vienen 2 bloques después o questions
  encadenadas sin feedback entre medio.
- CIERRE: el ÚLTIMO bloque DEBE ser una explanation que consolide en 1-2
  oraciones lo más importante del topic. Frase tipo "Ya sabés que [hecho
  concreto]" o "Hoy aprendiste que [hecho concreto]". NUNCA terminar con
  imperativo vacío ("practicá para recordar mejor") ni con question abierta.
- FEEDBACK ENSEÑA: el feedback no debe ser tautológico (NO "Córdoba es la
  capital de Córdoba"). Debe explicar POR QUÉ esa era la respuesta, o
  agregar contexto que consolide. Por ej.: "La capital de Buenos Aires es
  La Plata. Buenos Aires es el nombre de la provincia y de la ciudad
  capital del país, pero la capital de la provincia se llama distinto."
- CARGA COGNITIVA: para multi_select, máximo 6 opciones en total. Más de eso
  satura la memoria de trabajo de Sofi.
- Para multi_select, las correctas deben ser entre 2 y 5 (no todas, no ninguna).
- Para multiple_choice, exactamente 3 opciones, distractores plausibles
  (mismo rango semántico que la correcta, no ruido obvio).

NO incluyas texto fuera del JSON. NO uses markdown. NO uses backticks.`;
}

function buildUserPrompt(title: string, description: string, keyConcepts: string[]): string {
  const concepts = keyConcepts.length ? `\nConceptos clave: ${keyConcepts.join(", ")}` : "";
  return `TEMA: ${title}
DESCRIPCIÓN: ${description}${concepts}

Generá los bloques.`;
}

// --- Validation ---

function isValidRawBlock(b: unknown): b is RawBlock {
  if (!b || typeof b !== "object") return false;
  const x = b as Record<string, unknown>;
  if (x.kind === "explanation" || x.kind === "feedback") {
    return typeof x.text === "string" && x.text.length > 0;
  }
  if (x.kind === "question") {
    if (typeof x.text !== "string" || !x.text.length) return false;
    if (x.question === "multiple_choice") {
      return Array.isArray(x.options) && x.options.length === 3
        && x.options.every((o) => typeof o === "string")
        && typeof x.correct_index === "number"
        && x.correct_index >= 0 && x.correct_index < 3;
    }
    if (x.question === "multi_select") {
      if (!Array.isArray(x.options) || x.options.length < 3) return false;
      // Cap superior: ≤6 opciones para no saturar la MT de Sofi
      if (x.options.length > 6) return false;
      if (!x.options.every((o) => typeof o === "string")) return false;
      if (!Array.isArray(x.correct_indices)) return false;
      if (x.correct_indices.length < 2 || x.correct_indices.length > 5) return false;
      const maxIdx = (x.options as string[]).length - 1;
      return (x.correct_indices as number[]).every(
        (i) => typeof i === "number" && i >= 0 && i <= maxIdx,
      );
    }
    if (x.question === "true_false") {
      return typeof x.correct === "boolean";
    }
  }
  return false;
}

function validateResponse(r: unknown): RawBlock[] {
  if (!r || typeof r !== "object" || !Array.isArray((r as { blocks?: unknown }).blocks)) {
    throw new Error("Respuesta sin 'blocks' array");
  }
  const blocks = (r as { blocks: unknown[] }).blocks;
  if (blocks.length < 5 || blocks.length > 30) {
    throw new Error(`Respuesta con ${blocks.length} bloques (esperaba entre 5 y 30)`);
  }
  const valid: RawBlock[] = [];
  for (const b of blocks) {
    if (!isValidRawBlock(b)) throw new Error(`Bloque inválido: ${JSON.stringify(b).slice(0, 200)}`);
    valid.push(b);
  }

  // Estructura: apertura, question→feedback adyacente, cierre.
  // Estas reglas vienen de .claude/skills/topic-block-flow y .claude/skills/sofi-content-rules.
  if (valid[0].kind !== "explanation") {
    throw new Error("Primer bloque debe ser explanation (apertura)");
  }
  if (valid[valid.length - 1].kind !== "explanation") {
    throw new Error("Último bloque debe ser explanation (cierre consolidante)");
  }
  for (let i = 0; i < valid.length; i++) {
    if (valid[i].kind === "question") {
      if (i + 1 >= valid.length || valid[i + 1].kind !== "feedback") {
        throw new Error(`Question en posición ${i} sin feedback inmediato siguiente`);
      }
    }
    if (valid[i].kind === "feedback") {
      if (i === 0 || valid[i - 1].kind !== "question") {
        throw new Error(`Feedback en posición ${i} sin question previa (huérfano)`);
      }
    }
  }
  // Mínimo 1 question, y proporción razonable
  const questionCount = valid.filter((b) => b.kind === "question").length;
  if (questionCount === 0) throw new Error("Topic sin questions");

  return valid;
}

// --- Mapping raw → StubBlock (with pictogram phrase) ---

function rawToBlock(raw: RawBlock): StubBlock {
  if (raw.kind === "explanation") {
    const phrase: PhraseUnit[] = tokenizePhrase(raw.text);
    return { block_kind: "explanation", content: { text: raw.text, phrase } };
  }
  if (raw.kind === "feedback") {
    const phrase: PhraseUnit[] = tokenizePhrase(raw.text);
    return { block_kind: "feedback", content: { text: raw.text, tone: "positive", phrase } };
  }
  // question
  let q: QuestionContent;
  if (raw.question === "multiple_choice") {
    q = {
      kind: "multiple_choice",
      text: raw.text,
      options: raw.options,
      correct_index: raw.correct_index,
    };
  } else if (raw.question === "multi_select") {
    q = {
      kind: "multi_select",
      text: raw.text,
      options: raw.options,
      correct_indices: raw.correct_indices,
    };
  } else {
    q = {
      kind: "true_false",
      text: raw.text,
      correct: raw.correct,
    };
  }
  return { block_kind: "question", content: q };
}

// --- Public API: generate and persist blocks for a topic ---

export interface GenerateResult {
  blocks: StubBlock[];
  model: string;
}

export async function generateTopicBlocks(topicId: string): Promise<GenerateResult> {
  const { rows } = await query<{
    title: string;
    description: string;
    key_concepts: string[];
  }>(
    `SELECT title, description, key_concepts FROM topics WHERE id = $1`,
    [topicId],
  );
  if (rows.length === 0) throw new Error("topic_not_found");
  const topic = rows[0];

  const response = await chatJson<RawResponse>({
    system: buildSystemPrompt(),
    user: buildUserPrompt(topic.title, topic.description, topic.key_concepts ?? []),
  });

  const validBlocks = validateResponse(response);
  const stubBlocks = validBlocks.map(rawToBlock);

  await query(
    `UPDATE topics
        SET generated_blocks = $2,
            generated_at = now(),
            generated_by_model = $3
      WHERE id = $1`,
    [topicId, JSON.stringify(stubBlocks), config.groqModel],
  );

  return { blocks: stubBlocks, model: config.groqModel };
}
