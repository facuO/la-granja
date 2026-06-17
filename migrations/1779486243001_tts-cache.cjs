exports.up = (pgm) => {
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

exports.down = (pgm) => {
  pgm.dropTable("tts_cache");
};
