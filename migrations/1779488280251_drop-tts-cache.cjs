// Backend TTS removed; using browser Web Speech only.
exports.up = (pgm) => {
  pgm.dropTable("tts_cache", { ifExists: true });
};

exports.down = (pgm) => {
  pgm.createTable("tts_cache", {
    text_hash: { type: "text", primaryKey: true },
    audio_base64: { type: "text", notNull: true },
    words: { type: "jsonb", notNull: true, default: pgm.func("'[]'::jsonb") },
    voice_id: { type: "text", notNull: true },
    model: { type: "text", notNull: true },
    text_preview: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
};
