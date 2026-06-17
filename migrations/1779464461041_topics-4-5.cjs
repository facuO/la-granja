exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO topics (id, block_id, title, description, key_concepts, status, order_index)
    VALUES
      ('44444444-4444-4444-4444-444444444404',
       '22222222-2222-2222-2222-222222222221',
       'Territorio, población y autoridades',
       'Definir tres conceptos básicos sobre un país: territorio (espacio físico), población (las personas) y autoridades (quienes dirigen).',
       '["territorio", "población", "autoridades", "gobierno", "Presidente", "gobernadores", "intendentes"]'::jsonb,
       'available',
       13),
      ('44444444-4444-4444-4444-444444444405',
       '22222222-2222-2222-2222-222222222221',
       'Leer mapas con símbolos',
       'Aprender a leer la información codificada de un mapa: montaña, nieve, lluvia, sol, bosque.',
       '["símbolos del mapa", "referencias", "clima", "relieve"]'::jsonb,
       'available',
       14)
    ON CONFLICT (id) DO UPDATE
      SET title = EXCLUDED.title,
          description = EXCLUDED.description,
          key_concepts = EXCLUDED.key_concepts,
          status = EXCLUDED.status,
          order_index = EXCLUDED.order_index;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM topics
     WHERE id IN (
       '44444444-4444-4444-4444-444444444404',
       '44444444-4444-4444-4444-444444444405'
     );
  `);
};
