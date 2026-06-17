exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO subjects (id, name, active)
    VALUES
      ('11111111-1111-1111-1111-111111111112', 'Lengua', true),
      ('11111111-1111-1111-1111-111111111113', 'Matemática', true),
      ('11111111-1111-1111-1111-111111111114', 'Ciencias Naturales', true)
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, active = EXCLUDED.active;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM subjects WHERE id IN (
      '11111111-1111-1111-1111-111111111112',
      '11111111-1111-1111-1111-111111111113',
      '11111111-1111-1111-1111-111111111114'
    );
  `);
};
