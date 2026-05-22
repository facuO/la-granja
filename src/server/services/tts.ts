import { createHash } from "crypto";
import { PollyClient, SynthesizeSpeechCommand, type Engine, type VoiceId } from "@aws-sdk/client-polly";
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
  cached: boolean;
}

// --- Provider abstraction ---

type Provider = "polly" | "elevenlabs" | null;

function activeProvider(): Provider {
  if (config.awsAccessKeyId && config.awsSecretAccessKey) return "polly";
  if (config.elevenLabsApiKey) return "elevenlabs";
  return null;
}

function providerKey(): string {
  const p = activeProvider();
  if (p === "polly") return `polly:${config.pollyVoiceId}:${config.pollyEngine}`;
  if (p === "elevenlabs") return `el:${config.elevenLabsVoiceId}:${config.elevenLabsModel}`;
  return "none";
}

function textHash(text: string): string {
  // Hash incluye provider + voice + engine: si cambiás cualquiera, cache se invalida
  const key = `${providerKey()}|${text}`;
  return createHash("sha256").update(key).digest("hex");
}

export function ttsConfigured(): boolean {
  return activeProvider() !== null;
}

// --- DB cache ---

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

// --- AWS Polly ---

let _pollyClient: PollyClient | null = null;
function pollyClient(): PollyClient {
  if (!_pollyClient) {
    _pollyClient = new PollyClient({
      region: config.awsRegion,
      credentials: {
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey,
      },
    });
  }
  return _pollyClient;
}

async function streamToBuffer(stream: NodeJS.ReadableStream | Uint8Array | undefined): Promise<Buffer> {
  if (!stream) return Buffer.alloc(0);
  if (stream instanceof Uint8Array) return Buffer.from(stream);
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | Uint8Array>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function streamToString(stream: NodeJS.ReadableStream | Uint8Array | undefined): Promise<string> {
  const buf = await streamToBuffer(stream);
  return buf.toString("utf-8");
}

interface PollySpeechMark {
  time: number;  // ms
  type: string;  // "word"
  start: number; // char start in text
  end: number;   // char end in text
  value: string; // the word
}

function parseSpeechMarks(jsonLines: string): PollySpeechMark[] {
  const marks: PollySpeechMark[] = [];
  for (const line of jsonLines.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const m = JSON.parse(trimmed) as PollySpeechMark;
      if (m && m.type === "word") marks.push(m);
    } catch {
      // ignore malformed lines
    }
  }
  return marks;
}

function marksToWords(marks: PollySpeechMark[], audioDurationSeconds: number): WordTiming[] {
  const words: WordTiming[] = [];
  for (let i = 0; i < marks.length; i++) {
    const m = marks[i];
    const next = marks[i + 1];
    const start = m.time / 1000;
    // End = next word's start, or audio duration for the last word
    const end = next ? next.time / 1000 : Math.max(start + 0.3, audioDurationSeconds);
    words.push({ text: m.value, start, end });
  }
  return words;
}

async function synthWithPolly(text: string): Promise<CacheRow> {
  const client = pollyClient();
  const engine = config.pollyEngine as Engine;
  const voiceId = config.pollyVoiceId as VoiceId;

  // Polly cobra UNA vez por call. Para audio + word timings necesitamos 2 calls.
  // Las hacemos en paralelo para reducir latencia.
  const [audioRes, marksRes] = await Promise.all([
    client.send(new SynthesizeSpeechCommand({
      Text: text,
      TextType: "text",
      OutputFormat: "mp3",
      VoiceId: voiceId,
      Engine: engine,
    })),
    client.send(new SynthesizeSpeechCommand({
      Text: text,
      TextType: "text",
      OutputFormat: "json",
      VoiceId: voiceId,
      Engine: engine,
      SpeechMarkTypes: ["word"],
    })),
  ]);

  const audioBuf = await streamToBuffer(audioRes.AudioStream as any);
  const audio_base64 = audioBuf.toString("base64");

  const marksStr = await streamToString(marksRes.AudioStream as any);
  const marks = parseSpeechMarks(marksStr);

  // Estimación grosera de duración: ~150 caracteres por segundo en español
  // (usado solo para el end del último word)
  const estDuration = text.length / 15;
  const words = marksToWords(marks, estDuration);

  return {
    audio_base64,
    words,
    voice_id: config.pollyVoiceId,
    model: `polly-${engine}`,
  };
}

// --- ElevenLabs (kept as alternative provider) ---

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

function alignmentToWords(alignment: ElevenLabsAlignment): WordTiming[] {
  if (!alignment || !alignment.characters) return [];
  const starts = alignment.character_start_times_seconds;
  const ends = alignment.character_end_times_seconds;
  const words: WordTiming[] = [];
  const isBreak = (c: string) => /[\s.,;:!?¡¿"'\-—()]/.test(c);

  let i = 0;
  while (i < alignment.characters.length) {
    while (i < alignment.characters.length && isBreak(alignment.characters[i])) i++;
    if (i >= alignment.characters.length) break;
    const startIdx = i;
    while (i < alignment.characters.length && !isBreak(alignment.characters[i])) i++;
    const endIdx = i - 1;
    if (endIdx < startIdx) continue;
    const word = alignment.characters.slice(startIdx, endIdx + 1).join("");
    words.push({
      text: word,
      start: starts[startIdx] ?? 0,
      end: ends[endIdx] ?? starts[startIdx] ?? 0,
    });
  }
  return words;
}

async function synthWithElevenLabs(text: string): Promise<CacheRow> {
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
  return {
    audio_base64: data.audio_base64,
    words: alignment ? alignmentToWords(alignment) : [],
    voice_id: config.elevenLabsVoiceId,
    model: config.elevenLabsModel,
  };
}

// --- Public synthesize ---

export async function synthesize(text: string): Promise<TtsResult> {
  const hash = textHash(text);

  // 1. DB cache hit → no API call, no costo
  const cached = await fetchFromCache(hash);
  if (cached) {
    return { ...cached, cached: true };
  }

  // 2. Cache miss → llamar al provider activo
  const provider = activeProvider();
  if (!provider) {
    throw new Error("Ningún proveedor TTS configurado");
  }

  const result = provider === "polly"
    ? await synthWithPolly(text)
    : await synthWithElevenLabs(text);

  // 3. Guardar en DB
  await storeInCache(hash, text, result).catch((err) => {
    console.error("tts cache insert failed", err);
  });

  return { ...result, cached: false };
}
