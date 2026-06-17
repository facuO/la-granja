exports.up = (pgm) => {
  // Clear the featured slot in "Geografía argentina" so the new featured fits the
  // unique partial index (only one featured per block).
  pgm.sql(`
    UPDATE topics
       SET status = 'done'
     WHERE block_id = '22222222-2222-2222-2222-222222222221'
       AND status = 'featured'
       AND id != '44444444-4444-4444-4444-444444444401';
  `);

  // Insert three new topics for Clase 4 / repaso de geografía.
  pgm.sql(`
    INSERT INTO topics (id, block_id, title, description, key_concepts, status, order_index)
    VALUES
      ('44444444-4444-4444-4444-444444444401',
       '22222222-2222-2222-2222-222222222221',
       'Países limítrofes con Argentina',
       'Identificar los países que comparten frontera con Argentina.',
       '["países limítrofes", "Bolivia", "Brasil", "Chile", "Paraguay", "Uruguay"]'::jsonb,
       'featured',
       10),
      ('44444444-4444-4444-4444-444444444402',
       '22222222-2222-2222-2222-222222222221',
       'Provincias con la Cordillera de los Andes',
       'Identificar las provincias por donde pasa la cordillera.',
       '["Cordillera", "Andes", "Mendoza", "Salta", "Catamarca", "Santa Cruz"]'::jsonb,
       'available',
       11),
      ('44444444-4444-4444-4444-444444444403',
       '22222222-2222-2222-2222-222222222221',
       'Verdadero o falso geográfico',
       'Repaso de conceptos básicos con preguntas V o F.',
       '["Océano Pacífico", "Mar Argentino", "provincias costeras"]'::jsonb,
       'available',
       12)
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
       '44444444-4444-4444-4444-444444444401',
       '44444444-4444-4444-4444-444444444402',
       '44444444-4444-4444-4444-444444444403'
     );
  `);
  // Re-promote "Provincias y regiones" to featured.
  pgm.sql(`
    UPDATE topics SET status = 'featured'
     WHERE id = '33333333-3333-3333-3333-333333333332';
  `);
};
