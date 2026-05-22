exports.up = (pgm) => {
  pgm.addColumn("topics", {
    generated_blocks: { type: "jsonb" },
    generated_at: { type: "timestamptz" },
    generated_by_model: { type: "text" },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("topics", ["generated_blocks", "generated_at", "generated_by_model"]);
};
