// Seeds an initial set of topics for Lengua, Matemática and Ciencias Naturales.
//
// The 3 subjects already exist (see `_more-materias` migration) but have no
// blocks and no topics, so Sofi finds them empty when she enters the app.
// This migration creates one "Unidad 1" block per subject and inserts 3 topics
// per subject (1 featured + 2 available) with hand-written `description` and
// `key_concepts`. The topics are NOT pre-generated: Papá runs the LLM step
// manually from `/admin.html` to control cost.
//
// IDs are deterministic so the topics can be referenced from admin/MCP scripts:
//   blocks:  22222222-2222-2222-2222-2222222222{02,03,04}
//   topics:  55555555-5555-5555-5555-5555555555{01..09}

exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO blocks (id, subject_id, title, order_index) VALUES
      ('22222222-2222-2222-2222-222222222202',
       '11111111-1111-1111-1111-111111111112',
       'Lengua - Unidad 1', 0),
      ('22222222-2222-2222-2222-222222222203',
       '11111111-1111-1111-1111-111111111113',
       'Matemática - Unidad 1', 0),
      ('22222222-2222-2222-2222-222222222204',
       '11111111-1111-1111-1111-111111111114',
       'Naturales - Unidad 1', 0)
    ON CONFLICT (id) DO UPDATE
      SET subject_id = EXCLUDED.subject_id,
          title = EXCLUDED.title,
          order_index = EXCLUDED.order_index;
  `);

  pgm.sql(`
    INSERT INTO topics (id, block_id, title, description, key_concepts, status, order_index)
    VALUES
      -- ===== Lengua =====
      ('55555555-5555-5555-5555-555555555501',
       '22222222-2222-2222-2222-222222222202',
       'Sustantivos comunes y propios',
       'Explicar qué es un sustantivo. Diferenciar sustantivos comunes (nombran cosas en general: perro, casa, ciudad) de sustantivos propios (nombran a alguien o algo en particular: Sofi, Córdoba, Tromen) y la regla de mayúscula inicial en los propios.',
       '["sustantivo", "sustantivo común", "sustantivo propio", "mayúscula inicial", "nombre"]'::jsonb,
       'featured',
       1),
      ('55555555-5555-5555-5555-555555555502',
       '22222222-2222-2222-2222-222222222202',
       'Verbos: acciones que hacemos',
       'Explicar qué es un verbo (palabra que indica una acción o un estado). Aprender a identificar verbos en oraciones simples y a distinguirlos de los sustantivos. Usar ejemplos cotidianos como correr, comer, leer, dormir.',
       '["verbo", "acción", "oración", "sujeto", "identificar verbos"]'::jsonb,
       'available',
       2),
      ('55555555-5555-5555-5555-555555555503',
       '22222222-2222-2222-2222-222222222202',
       'Sinónimos y antónimos',
       'Definir sinónimos como palabras de significado parecido (lindo / bonito) y antónimos como palabras de significado opuesto (alto / bajo). Practicar con pares de palabras frecuentes para una chica de 10-12 años.',
       '["sinónimo", "antónimo", "significado", "palabra opuesta", "palabra parecida"]'::jsonb,
       'available',
       3),

      -- ===== Matemática =====
      ('55555555-5555-5555-5555-555555555504',
       '22222222-2222-2222-2222-222222222203',
       'Multiplicación por 2 cifras',
       'Enseñar el algoritmo de la multiplicación por un número de 2 cifras paso a paso: multiplicar primero por las unidades, después por las decenas corriendo un lugar a la izquierda, y sumar los dos resultados. Usar ejemplos con números chicos primero.',
       '["multiplicación", "2 cifras", "unidades", "decenas", "algoritmo", "suma final"]'::jsonb,
       'featured',
       1),
      ('55555555-5555-5555-5555-555555555505',
       '22222222-2222-2222-2222-222222222203',
       'Fracciones: qué son',
       'Introducir el concepto de fracción como una parte de un entero dividido en partes iguales. Explicar numerador y denominador con ejemplos concretos (medio, un tercio, un cuarto de pizza o de chocolate). No incluir operaciones todavía.',
       '["fracción", "entero", "numerador", "denominador", "mitad", "tercio", "cuarto"]'::jsonb,
       'available',
       2),
      ('55555555-5555-5555-5555-555555555506',
       '22222222-2222-2222-2222-222222222203',
       'Perímetro de figuras',
       'Definir el perímetro como la suma de los lados de una figura. Calcular el perímetro de cuadrados, rectángulos y triángulos con medidas enteras. Diferenciar perímetro de área (sin entrar en cálculo de área).',
       '["perímetro", "lados", "suma", "cuadrado", "rectángulo", "triángulo"]'::jsonb,
       'available',
       3),

      -- ===== Ciencias Naturales =====
      ('55555555-5555-5555-5555-555555555507',
       '22222222-2222-2222-2222-222222222204',
       'Animales de granja y su alimentación',
       'Conocer los animales típicos de una granja (vaca, oveja, cerdo, gallina, caballo) y qué come cada uno. Diferenciar herbívoros (comen pasto y plantas) de omnívoros (comen de todo, como el cerdo y la gallina). Usar ejemplos concretos de una granja.',
       '["animales de granja", "vaca", "oveja", "cerdo", "gallina", "herbívoro", "omnívoro", "alimentación"]'::jsonb,
       'featured',
       1),
      ('55555555-5555-5555-5555-555555555508',
       '22222222-2222-2222-2222-222222222204',
       'Ciclo del agua',
       'Explicar las tres etapas del ciclo del agua: evaporación (el sol calienta el agua y sube como vapor), condensación (el vapor se junta y forma nubes) y precipitación (cae como lluvia o nieve). Mostrar que el agua se mueve en un ciclo continuo entre la tierra y el cielo.',
       '["ciclo del agua", "evaporación", "condensación", "precipitación", "lluvia", "nube", "vapor"]'::jsonb,
       'available',
       2),
      ('55555555-5555-5555-5555-555555555509',
       '22222222-2222-2222-2222-222222222204',
       'El sistema digestivo',
       'Recorrer el camino de la comida en el cuerpo paso a paso: boca (masticar, saliva), esófago (tubo que baja), estómago (jugos que rompen la comida), intestino delgado (absorbe nutrientes) e intestino grueso (forma los desechos). Una etapa por bloque para no saturar.',
       '["sistema digestivo", "boca", "esófago", "estómago", "intestino delgado", "intestino grueso", "nutrientes"]'::jsonb,
       'available',
       3)
    ON CONFLICT (id) DO UPDATE
      SET block_id = EXCLUDED.block_id,
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          key_concepts = EXCLUDED.key_concepts,
          status = EXCLUDED.status,
          order_index = EXCLUDED.order_index;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM topics WHERE id IN (
      '55555555-5555-5555-5555-555555555501',
      '55555555-5555-5555-5555-555555555502',
      '55555555-5555-5555-5555-555555555503',
      '55555555-5555-5555-5555-555555555504',
      '55555555-5555-5555-5555-555555555505',
      '55555555-5555-5555-5555-555555555506',
      '55555555-5555-5555-5555-555555555507',
      '55555555-5555-5555-5555-555555555508',
      '55555555-5555-5555-5555-555555555509'
    );
    DELETE FROM blocks WHERE id IN (
      '22222222-2222-2222-2222-222222222202',
      '22222222-2222-2222-2222-222222222203',
      '22222222-2222-2222-2222-222222222204'
    );
  `);
};
