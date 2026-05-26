// 5 topics fundamentales de Matemática para Sofi (10-12, autista, leve
// disminución cortical parietal). El currículo de 5° grado tiene matemática
// densa para su perfil — estos topics sirven como ESCALONES PREVIOS antes
// de los topics del DCJ Córdoba.
//
// Order_index negativo para que aparezcan PRIMERO en la lista de Matemática
// (antes de Multiplicación, Fracciones, etc.). Progresión natural:
//   -5 Comparar números (relación entre números, sin operar)
//   -4 Pares e impares (categorizar)
//   -3 Suma con números hasta 100 (operación básica)
//   -2 Mitad y doble (multiplicación/división informal)
//   -1 Reconocer figuras (geometría introductoria, sin perímetro/área)
//
// UUIDs disponibles: 510-514 (entre 506 y 520 quedó hueco).
//
// Sin contenido (generated_blocks NULL). Papá los genera desde admin.

exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO topics (id, block_id, title, description, key_concepts, status, order_index)
    VALUES
      ('55555555-5555-5555-5555-555555555510',
       '22222222-2222-2222-2222-222222222203',
       'Comparar números: mayor y menor',
       'Comparar dos números y decir cuál es mayor (más grande) o menor (más chico). Empezar con cantidades concretas: si Sofi tiene 5 lápices y su amiga 8, su amiga tiene más. Después usar los signos > (mayor que) y < (menor que). Ejemplos: 7 > 3, 4 < 9. Usar números hasta 100.',
       '["mayor", "menor", "más grande", "más chico", "mayor que", "menor que", "comparar"]'::jsonb,
       'available',
       -5),

      ('55555555-5555-5555-5555-555555555511',
       '22222222-2222-2222-2222-222222222203',
       'Pares e impares',
       'Aprender a distinguir números pares de impares. Los pares terminan en 0, 2, 4, 6 u 8. Los impares terminan en 1, 3, 5, 7 o 9. Mostrar que los pares se pueden agrupar de a dos sin que sobre ninguno; los impares siempre dejan uno solo. Ejemplos: 6 es par (3 grupos de 2), 7 es impar (3 grupos de 2 más 1 solo). Usar números hasta 20.',
       '["par", "impar", "termina en", "agrupar de a dos", "cero", "dos", "cuatro", "seis", "ocho"]'::jsonb,
       'available',
       -4),

      ('55555555-5555-5555-5555-555555555512',
       '22222222-2222-2222-2222-222222222203',
       'Sumas hasta 100',
       'Sumar dos números cuando el resultado no pasa de 100. Empezar con sumas sencillas de una cifra como 5 + 3 = 8. Pasar a sumas de dos cifras sin llevar: 23 + 14 = 37 (3+4=7 unidades, 2+1=3 decenas). Mostrar la suma con caramelos, dedos o monedas para anclar lo abstracto.',
       '["suma", "más", "resultado", "decenas", "unidades", "sumando", "total"]'::jsonb,
       'available',
       -3),

      ('55555555-5555-5555-5555-555555555513',
       '22222222-2222-2222-2222-222222222203',
       'Mitad y doble',
       'Aprender qué es la mitad (partir en 2 iguales) y el doble (juntar 2 iguales). Trabajar con números chicos: la mitad de 10 es 5; el doble de 4 es 8. Conectar con vida cotidiana: la mitad de una pizza son dos porciones de 4; el doble de mi edad. Mostrar que el doble de X es X + X.',
       '["mitad", "doble", "dividir en dos", "multiplicar por dos", "partes iguales"]'::jsonb,
       'available',
       -2),

      ('55555555-5555-5555-5555-555555555514',
       '22222222-2222-2222-2222-222222222203',
       'Reconocer figuras geométricas',
       'Identificar tres figuras planas básicas. Cuadrado: 4 lados iguales, 4 vértices. Rectángulo: 4 lados (los de enfrente son iguales), 4 vértices. Triángulo: 3 lados, 3 vértices. SIN calcular perímetro ni área, solo reconocer la forma. Dar ejemplos del entorno: una ventana es un rectángulo, un cartel de pare es un octógono, un techo dos aguas es un triángulo.',
       '["figura plana", "cuadrado", "rectángulo", "triángulo", "lados", "vértices", "forma"]'::jsonb,
       'available',
       -1)
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
      '55555555-5555-5555-5555-555555555510',
      '55555555-5555-5555-5555-555555555511',
      '55555555-5555-5555-5555-555555555512',
      '55555555-5555-5555-5555-555555555513',
      '55555555-5555-5555-5555-555555555514'
    );
  `);
};
