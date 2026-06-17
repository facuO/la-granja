import Groq from "groq-sdk";
import { config } from "../config.js";
import { tokenizePhrase, type PhraseUnit } from "./phrase-tokenizer.js";
import { enrichPhrase } from "./arasaac.js";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatTurnInput {
  history: ChatMessage[];
  message: string;
}

export interface ChatTurnResult {
  text: string;
  phrase: PhraseUnit[];
}

const SYSTEM_PROMPT = `Sos un tutor escolar conversacional para Sofi, una chica de 10-12 años.

PERFIL DE SOFI: autista, comprensión más cómoda con frases muy cortas y literales,
muy buen lectora, no le gustan las metáforas ni las ironías.

REGLAS NO NEGOCIABLES (no las cambies por ningún motivo):
1. Lenguaje SIEMPRE literal. Sin metáforas no explicadas, sin sarcasmo, sin ironía.
2. Cada oración: MÁXIMO 12 palabras. Una sola idea por oración.
3. Respuesta total: máximo 4 oraciones (~50 palabras).
4. Si la pregunta es ambigua, pedí UNA aclaración corta, no varias.
5. Si la pregunta es sobre temas escolares (geografía, lengua, matemática, ciencias),
   respondé con info concreta y simple.
6. Si la pregunta NO es escolar pero es inocente, respondé brevemente y volvé al tema.
7. Si la pregunta es inapropiada o angustiante, redirigí amable a un adulto.
8. Sin presión. Sin "muy bien" genérico. Sin "rápido". Sin "apurate".
9. No incluyas emoji en el texto. El renderer ya pone pictogramas automáticos.
10. Hablale a Sofi en segunda persona. Sin tratarla de "nena", "chiquita" ni infantilizar.

CONTRATO DE SALIDA:
Devolvé EXCLUSIVAMENTE un objeto JSON con clave "text" cuyo valor es la respuesta
en castellano rioplatense. Sin markdown, sin backticks, sin formato extra.

Ejemplo:
{"text":"Bolivia es un país. Está al norte de Argentina. Bolivia toca con Argentina y con otros 4 países."}`;

interface RawResponse {
  text: string;
}

export async function askTutor(input: ChatTurnInput): Promise<ChatTurnResult> {
  const trimmedHistory = (input.history ?? []).slice(-12);

  const userMessages = trimmedHistory
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role, content: String(m.content ?? "").slice(0, 1000) }));

  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    ...userMessages,
    { role: "user" as const, content: input.message.slice(0, 1000) },
  ];

  if (!config.groqApiKey) throw new Error("GROQ_API_KEY no está configurada");
  const client = new Groq({ apiKey: config.groqApiKey });

  const res = await client.chat.completions.create({
    model: config.groqModel,
    temperature: 0.6,
    messages,
    response_format: { type: "json_object" },
  });

  const raw = res.choices[0]?.message?.content ?? "";
  if (!raw) throw new Error("Groq devolvió respuesta vacía");

  let parsed: RawResponse;
  try {
    parsed = JSON.parse(raw) as RawResponse;
  } catch {
    throw new Error("Respuesta del LLM no es JSON válido");
  }

  const text = typeof parsed.text === "string" ? parsed.text.trim() : "";
  if (!text) throw new Error("Respuesta sin campo 'text'");

  const phrase = tokenizePhrase(text);
  // Auto-lookup de palabras content que el map estático no cubre.
  // Persiste en arasaac_cache para que próximas conversaciones sean instantáneas.
  await enrichPhrase(phrase);
  return { text, phrase };
}

