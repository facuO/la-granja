// FIX de colisión de UUIDs.
//
// La migración seed-mate-fundamentos (1779823671278) usó IDs 510-514, que
// la migración seed-topics-cordoba (PR #20) YA había asignado a 5 topics
// de Lengua (Adjetivos, Adverbios, Sujeto y predicado, Tildación, Signos
// de puntuación). El ON CONFLICT DO UPDATE de fundamentos pisó esos topics:
// cambió title/block_id/description a Matemática, pero NO generated_blocks.
//
// Resultado:
//   - 510/511/514 (Mate) quedaron con generated_blocks viejos de Lengua
//     (adjetivos/adverbios/puntuación). 512/513 se salvaron porque Opus
//     los regeneró después.
//   - Los 5 topics de Lengua desaparecieron del catálogo.
//
// Este fix:
//   1. Recrea los 5 topics de Lengua con UUIDs NUEVOS (560-564).
//   2. Crea sus 5 ejercicios siblings (66...055-059).
//   3. Limpia generated_blocks de 510/511/514 para que se regeneren como Mate.

const LENGUA_TOPICS = [
  ["55555555-5555-5555-5555-555555555560","Adjetivos",4,
    "Definir adjetivo como palabra que describe al sustantivo. Trabajar adjetivos de calidad (lindo, grande, suave) y de cantidad (mucho, poco, varios). Mostrar concordancia en género y número con el sustantivo. Usar ejemplos cortos: la casa blanca, los perros chicos.",
    ["adjetivo","calificativo","concordancia","género","número","sustantivo"]],
  ["55555555-5555-5555-5555-555555555561","Adverbios",5,
    "Definir adverbio como palabra que modifica al verbo. Trabajar adverbios de modo (despacio), de tiempo (hoy, ayer, siempre), de lugar (acá, allá, lejos) y de cantidad (mucho, poco). Dar ejemplos en oraciones simples.",
    ["adverbio","modo","tiempo","lugar","cantidad","verbo"]],
  ["55555555-5555-5555-5555-555555555562","Sujeto y predicado",6,
    "Explicar que una oración tiene dos partes: sujeto (de quién o de qué se habla) y predicado (lo que se dice del sujeto). Mostrar cómo identificar el sujeto preguntando quién. Usar oraciones simples como: Sofi camina. El perro come.",
    ["oración","sujeto","predicado","verbo principal","núcleo"]],
  ["55555555-5555-5555-5555-555555555563","Tildación: agudas, graves, esdrújulas",7,
    "Clasificar palabras según la sílaba tónica. Agudas: la fuerza de voz en la última sílaba (canción, café). Graves: en la anteúltima (árbol, lápiz). Esdrújulas: en la antepenúltima (pájaro, música). Repasar reglas básicas de tilde.",
    ["sílaba tónica","aguda","grave","esdrújula","tilde","acento"]],
  ["55555555-5555-5555-5555-555555555564","Signos de puntuación",8,
    "Aprender el uso básico del punto (cierra una idea), la coma (separa elementos o pausa breve) y los dos puntos (anuncian una enumeración). Mostrar cómo cambia el sentido al cambiar la puntuación. Usar ejemplos en oraciones cortas.",
    ["punto","coma","dos puntos","puntuación","pausa","enumeración"]],
];

const LENGUA_BLOCK = "22222222-2222-2222-2222-222222222202";

function shortTitle(t) {
  const map = {
    "Tildación: agudas, graves, esdrújulas": "Tildación",
    "Sujeto y predicado": "Sujeto y predicado",
  };
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
  // 1. Recrear los 5 topics de Lengua (teoría)
  const theoryValues = LENGUA_TOPICS.map((row) => {
    const [id, title, order, desc, keys] = row;
    const safeDesc = desc.replace(/'/g, "''");
    const safeTitle = title.replace(/'/g, "''");
    return `('${id}', '${LENGUA_BLOCK}', '${safeTitle}', '${safeDesc}', '${JSON.stringify(keys)}'::jsonb, 'available', ${order})`;
  }).join(",\n      ");

  // 2. Crear los 5 ejercicios siblings (66...055-059)
  const exerciseValues = LENGUA_TOPICS.map((row, i) => {
    const [, title, order, desc, keys] = row;
    const seq = String(55 + i).padStart(3, "0");
    const exId = `66666666-6666-6666-6666-666666666${seq}`;
    const exTitle = `Ejercicios: ${shortTitle(title)}`.replace(/'/g, "''");
    const exDesc = ejerciciosDescription(title, desc, keys).replace(/'/g, "''");
    return `('${exId}', '${LENGUA_BLOCK}', '${exTitle}', '${exDesc}', '${JSON.stringify(keys)}'::jsonb, 'available', ${order + 1000})`;
  }).join(",\n      ");

  pgm.sql(`
    INSERT INTO topics (id, block_id, title, description, key_concepts, status, order_index)
    VALUES
      ${theoryValues},
      ${exerciseValues}
    ON CONFLICT (id) DO UPDATE
      SET block_id = EXCLUDED.block_id, title = EXCLUDED.title,
          description = EXCLUDED.description, key_concepts = EXCLUDED.key_concepts,
          status = EXCLUDED.status, order_index = EXCLUDED.order_index;
  `);

  // 3. Limpiar contenido viejo de Lengua en los 3 topics de Mate afectados
  pgm.sql(`
    UPDATE topics
       SET generated_blocks = NULL, generated_at = NULL, generated_by_model = NULL
     WHERE id IN (
       '55555555-5555-5555-5555-555555555510',
       '55555555-5555-5555-5555-555555555511',
       '55555555-5555-5555-5555-555555555514'
     );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM topics WHERE id::text IN (
      '55555555-5555-5555-5555-555555555560',
      '55555555-5555-5555-5555-555555555561',
      '55555555-5555-5555-5555-555555555562',
      '55555555-5555-5555-5555-555555555563',
      '55555555-5555-5555-5555-555555555564',
      '66666666-6666-6666-6666-666666666055',
      '66666666-6666-6666-6666-666666666056',
      '66666666-6666-6666-6666-666666666057',
      '66666666-6666-6666-6666-666666666058',
      '66666666-6666-6666-6666-666666666059'
    );
  `);
};
