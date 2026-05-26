// Cache persistente para lookups dinámicos a la API de ARASAAC.
// Una vez que una palabra fue resuelta (o marcada como "sin pictograma"),
// no se vuelve a consultar.
exports.up = (pgm) => {
  pgm.createTable("arasaac_cache", {
    word_normalized: { type: "text", primaryKey: true },
    picto_id: { type: "integer" }, // nullable: null = "ARASAAC no tiene match decente"
    source: {
      type: "text",
      notNull: true,
      check: "source IN ('api', 'manual_override', 'manual_null')",
      default: "api",
    },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
};

exports.down = (pgm) => {
  pgm.dropTable("arasaac_cache");
};
