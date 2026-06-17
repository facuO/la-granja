import Groq from "groq-sdk";
import { config } from "../config.js";

let _client: Groq | null = null;

function client(): Groq {
  if (!config.groqApiKey) {
    throw new Error("GROQ_API_KEY no está configurada");
  }
  if (!_client) _client = new Groq({ apiKey: config.groqApiKey });
  return _client;
}

export interface ChatJsonOptions {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
}

/** Sends a chat completion request and parses the response as JSON. */
export async function chatJson<T>(opts: ChatJsonOptions): Promise<T> {
  const res = await client().chat.completions.create({
    model: opts.model ?? config.groqModel,
    temperature: opts.temperature ?? 0.7,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    response_format: { type: "json_object" },
  });

  const text = res.choices[0]?.message?.content ?? "";
  if (!text) throw new Error("Groq devolvió respuesta vacía");

  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new Error(`Respuesta del LLM no es JSON válido: ${(err as Error).message}\n---\n${text.slice(0, 500)}`);
  }
}
