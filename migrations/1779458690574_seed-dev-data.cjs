exports.up = (pgm) => {
  if (process.env.SKIP_SEED === "1") return;

  pgm.sql(`
    INSERT INTO subjects (id, name, active)
    VALUES ('11111111-1111-1111-1111-111111111111', 'Ciencias Sociales', true)
    ON CONFLICT DO NOTHING;

    INSERT INTO blocks (id, subject_id, title, order_index) VALUES
      ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'Geografía argentina', 0),
      ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Historia argentina', 1)
    ON CONFLICT DO NOTHING;

    INSERT INTO topics (id, block_id, title, description, status, order_index) VALUES
      ('33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222221',
       'Puntos cardinales y mapas', 'Norte, sur, este, oeste. Cómo leer un mapa básico.', 'done', 0),
      ('33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222221',
       'Provincias y regiones', 'Las 23 provincias y CABA, agrupadas por región (NOA, NEA, Cuyo, Centro, Patagonia).', 'featured', 1),
      ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222221',
       'Capitales', 'Capital de cada provincia.', 'available', 2),
      ('33333333-3333-3333-3333-333333333334', '22222222-2222-2222-2222-222222222221',
       'Relieves y climas', 'Llanura, montaña, meseta. Climas dominantes por región.', 'upcoming', 3)
    ON CONFLICT DO NOTHING;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM topics WHERE id IN (
      '33333333-3333-3333-3333-333333333331',
      '33333333-3333-3333-3333-333333333332',
      '33333333-3333-3333-3333-333333333333',
      '33333333-3333-3333-3333-333333333334'
    );
    DELETE FROM blocks WHERE id IN (
      '22222222-2222-2222-2222-222222222221',
      '22222222-2222-2222-2222-222222222222'
    );
    DELETE FROM subjects WHERE id = '11111111-1111-1111-1111-111111111111';
  `);
};
