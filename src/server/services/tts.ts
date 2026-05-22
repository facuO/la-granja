import { createHash } from "crypto";
import { config } from "../config.js";
import { query } from "../db.js";

export interface WordTiming {
  text: string;
  start: number; // seconds
  end: number;   // seconds
}

export interface TtsResult {
  audio_base64: string;
  words: WordTiming[];
  voice_id: string;
  model: string;
  cached: boolean; // true si vino del DB cache, false si recién consumió API
}

interface ElevenLabsAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

interface ElevenLabsResponse {
  audio_base64: string;
  alignment?: ElevenLabsAlignment;
  normalized_alignment?: ElevenLabsAlignment;
}

function textHash(text: string): string {
  // Hash incluye voice_id + model: si cambiás voz, el cache se invalida natural
  const key = `${config.elevenLabsVoiceId}|${config.elevenLabsModel}|${text}`;
  return createHash("sha256").update(key).digest("hex");
}

function alignmentToWords(text: string, alignment: ElevenLabsAlignment): WordTiming[] {
  if (!alignment || !alignment.characters) return [];
  const starts = alignment.character_start_times_seconds;
  const ends = alignment.character_end_times_seconds;
  const words: WordTiming[] = [];

  const isWordBreak = (c: string) => /[\s.,;:!?¡¿"'\-—()]/.test(c);

  let i = 0;
  while (i < alignment.characters.length) {
    while (i < alignment.characters.length && isWordBreak(alignment.characters[i])) i++;
    if (i >= alignment.characters.length) break;
    const startIdx = i;
    while (i < alignment.characters.length && !isWordBreak(alignment.characters[i])) i++;
    const endIdx = i - 1;
    if (endIdx < startIdx) continue;
    const word = alignment.characters.slice(startIdx, endIdx + 1).join("");
    const start = starts[startIdx] ?? 0;
    const end = ends[endIdx] ?? start;
    words.push({ text: word, start, end });
  }
  return words;
}

export function ttsConfigured(): boolean {
  return Boolean(config.elevenLabsApiKey);
}

interface CacheRow {
  audio_base64: string;
  words: WordTiming[];
  voice_id: string;
  model: string;
}

async function fetchFromCache(hash: string): Promise<CacheRow | null> {
  const { rows } = await query<CacheRow>(
    `SELECT audio_base64, words, voice_id, model FROM tts_cache WHERE text_hash = $1`,
    [hash],
  );
  return rows[0] ?? null;
}

async function storeInCache(hash: string, text: string, result: CacheRow): Promise<void> {
  await query(
    `INSERT INTO tts_cache (text_hash, audio_base64, words, voice_id, model, text_preview)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (text_hash) DO NOTHING`,
    [
      hash,
      result.audio_base64,
      JSON.stringify(result.words),
      result.voice_id,
      result.model,
      text.slice(0, 120),
    ],
  );
}

export async function synthesize(text: string): Promise<TtsResult> {
  const hash = textHash(text);

  // 1. DB cache hit → no API call, no costo
  const cached = await fetchFromCache(hash);
  if (cached) {
    return { ...cached, cached: true };
  }

  // 2. Cache miss → necesitamos llamar a ElevenLabs (consume chars del free tier)
  if (!ttsConfigured()) {
    throw new Error("ELEVENLABS_API_KEY no está configurada");
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${config.elevenLabsVoiceId}/with-timestamps`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": config.elevenLabsApiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: config.elevenLabsModel,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as ElevenLabsResponse;
  const alignment = data.normalized_alignment || data.alignment;
  const words = alignment ? alignmentToWords(text, alignment) : [];

  const result: CacheRow = {
    audio_base64: data.audio_base64,
    words,
    voice_id: config.elevenLabsVoiceId,
    model: config.elevenLabsModel,
  };

  // 3. Guardar en DB para no volver a pagar por este texto
  await storeInCache(hash, text, result).catch((err) => {
    // No bloquear la respuesta si el insert falla; el cache se intentará la próxima
    console.error("tts cache insert failed", err);
  });

  return { ...result, cached: false };
}
