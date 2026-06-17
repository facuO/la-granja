// Fix anglicismo: "citrus" → "cítricos" en la description del topic
// "Producción regional argentina". Detectado por Opus review en PR #20.
//
// El LLM lee la description para generar contenido, así que si dice "citrus"
// puede arrastrar el anglicismo al output que va a Sofi.

exports.up = (pgm) => {
  pgm.sql(`
    UPDATE topics
       SET description = replace(description, 'citrus', 'cítricos')
     WHERE description LIKE '%citrus%';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    UPDATE topics
       SET description = replace(description, 'cítricos', 'citrus')
     WHERE description LIKE '%cítricos%';
  `);
};
