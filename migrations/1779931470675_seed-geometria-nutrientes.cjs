// Topics nuevos alineados a las secuencias que mandó la seño Marisa:
//   - Geometría (Matemática): adaptados a RECONOCER (no construir/medir),
//     al nivel de Sofi. La clase ve compás/transportador/ángulos; Sofi
//     reconoce formas, lados, vértices y para qué sirve cada instrumento.
//   - Nutrientes (Ciencias Naturales): versión simple del experimento de
//     la Feria de Ciencias (grasas dejan mancha, agua se seca).
//
// NO se incluye la secuencia "el cuerpo / pubertad / ESI" — es contenido
// sensible que define el equipo terapéutico, no el LLM.
//
// UUIDs: teoría 555...570-573, ejercicios 666...060-063.

const TOPICS = [
  // [id, block_id, title, order, description, key_concepts, ejercicios_id, ejercicios_order]
  ["55555555-5555-5555-5555-555555555570", "22222222-2222-2222-2222-222222222203",
   "Círculo y circunferencia", 19,
   "Reconocer el círculo y sus partes. La circunferencia es la línea curva del borde. El centro es el punto del medio. El radio va del centro al borde. Reconocer objetos redondos: una tapa, un plato, una rueda. SIN medir ni usar compás, solo reconocer las partes.",
   ["círculo","circunferencia","centro","radio","borde","redondo"],
   "66666666-6666-6666-6666-666666666060", 1019],

  ["55555555-5555-5555-5555-555555555571", "22222222-2222-2222-2222-222222222203",
   "Triángulos", 20,
   "Reconocer triángulos por sus 3 lados y 3 vértices. Un triángulo es una figura de 3 lados rectos. Contar lados y vértices. Reconocer triángulos en objetos: un techo a dos aguas, una porción de pizza, una escuadra. SIN medir ángulos, solo reconocer la forma.",
   ["triángulo","lados","vértices","tres lados","figura"],
   "66666666-6666-6666-6666-666666666061", 1020],

  ["55555555-5555-5555-5555-555555555572", "22222222-2222-2222-2222-222222222203",
   "Instrumentos de geometría", 21,
   "Conocer para qué sirve cada instrumento de geometría. La regla mide y traza líneas rectas. El compás dibuja circunferencias. La escuadra ayuda a hacer ángulos rectos. El transportador mide ángulos. Reconocer cada uno por su forma y su uso.",
   ["regla","compás","escuadra","transportador","instrumentos","geometría"],
   "66666666-6666-6666-6666-666666666062", 1021],

  ["55555555-5555-5555-5555-555555555573", "22222222-2222-2222-2222-222222222204",
   "Nutrientes en los alimentos", 19,
   "Conocer que los alimentos tienen nutrientes. Las grasas dejan una mancha aceitosa que no se seca. El agua deja una mancha que se seca y desaparece. Ejemplos: la manteca tiene grasa, la manzana tiene agua. Conecta con el experimento de la Feria de Ciencias.",
   ["nutrientes","grasas","agua","alimentos","mancha","experimento"],
   "66666666-6666-6666-6666-666666666063", 1019],
];

function shortTitle(t) {
  const map = { "Instrumentos de geometría": "Instrumentos", "Nutrientes en los alimentos": "Nutrientes" };
  return map[t] || t;
}

function ejerciciosDescription(theoryTitle, theoryDescription, keyConcepts) {
  const concepts = keyConcepts.slice(0, 6).join(", ");
  return `SESIÓN DE EJERCICIOS PRÁCTICOS sobre "${theoryTitle}". Sofi ya vio la teoría. ` +
    `Acá tiene que APLICAR lo aprendido con problemas concretos a resolver, no preguntas de recordar definiciones. ` +
    `Estructura: 1-2 explanations cortas que recuerden el concepto al empezar, después 8-10 questions consecutivas ` +
    `(cada una con su feedback que explica el procedimiento paso a paso) y un cierre que mencione qué tipo de ` +
    `ejercicios resolvió. Conceptos a ejercitar: ${concepts}. Recordatorio del contenido: ${theoryDescription}`;
}

exports.up = (pgm) => {
  const rows = [];
  for (const [id, blockId, title, order, desc, keys] of TOPICS) {
    rows.push(`('${id}', '${blockId}', '${title.replace(/'/g, "''")}', '${desc.replace(/'/g, "''")}', '${JSON.stringify(keys)}'::jsonb, 'available', ${order})`);
  }
  for (const [, blockId, title, , desc, keys, exId, exOrder] of TOPICS) {
    const exTitle = `Ejercicios: ${shortTitle(title)}`.replace(/'/g, "''");
    const exDesc = ejerciciosDescription(title, desc, keys).replace(/'/g, "''");
    rows.push(`('${exId}', '${blockId}', '${exTitle}', '${exDesc}', '${JSON.stringify(keys)}'::jsonb, 'available', ${exOrder})`);
  }

  pgm.sql(`
    INSERT INTO topics (id, block_id, title, description, key_concepts, status, order_index)
    VALUES
      ${rows.join(",\n      ")}
    ON CONFLICT (id) DO UPDATE
      SET block_id = EXCLUDED.block_id, title = EXCLUDED.title,
          description = EXCLUDED.description, key_concepts = EXCLUDED.key_concepts,
          status = EXCLUDED.status, order_index = EXCLUDED.order_index;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM topics WHERE id::text IN (
      '55555555-5555-5555-5555-555555555570','55555555-5555-5555-5555-555555555571',
      '55555555-5555-5555-5555-555555555572','55555555-5555-5555-5555-555555555573',
      '66666666-6666-6666-6666-666666666060','66666666-6666-6666-6666-666666666061',
      '66666666-6666-6666-6666-666666666062','66666666-6666-6666-6666-666666666063'
    );
  `);
};
