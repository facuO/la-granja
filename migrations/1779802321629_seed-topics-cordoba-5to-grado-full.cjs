// Seeds the full set of topics for 5° grado (primaria, Córdoba) across the
// 4 subjects: Lengua, Matemática, Ciencias Naturales y Ciencias Sociales.
//
// Subjects and blocks already exist (see previous migrations). This migration
// only INSERTS new topics. The 9 new topics per subject expand the catalogue
// from the initial seed (3 topics per subject for Lengua/Mate/Naturales,
// 9 topics for Sociales) so the curriculum covers the year.
//
// Content rules (`sofi-content-rules`) apply: titles ≤7 palabras, sin
// metáforas, locale es-AR. Topics quedan vacíos (sin generated_blocks):
// Papá los genera desde /admin.html cuando los necesita.
//
// IDs determinísticos:
//   Lengua nuevos:    55555555-5555-5555-5555-5555555555{10..18}
//   Mate nuevos:      55555555-5555-5555-5555-5555555555{20..28}
//   Naturales nuevos: 55555555-5555-5555-5555-5555555555{30..38}
//   Sociales nuevos:  55555555-5555-5555-5555-5555555555{40..48}
//
// Sociales se reparte entre los dos blocks existentes:
//   Geografía argentina (22222222-...-221) → topics geo (40..43)
//   Historia argentina  (22222222-...-222) → topics historia (44..48)
//
// Featured: el block "Historia argentina" estaba vacío, así que marco un
// topic featured ahí (Revolución de Mayo). Los demás nuevos topics quedan
// 'available' porque sus blocks ya tienen un featured (constraint único).

exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO topics (id, block_id, title, description, key_concepts, status, order_index)
    VALUES
      -- ===== LENGUA (block Lengua - Unidad 1) =====
      ('55555555-5555-5555-5555-555555555510',
       '22222222-2222-2222-2222-222222222202',
       'Adjetivos',
       'Definir adjetivo como palabra que describe al sustantivo. Trabajar adjetivos de calidad (lindo, grande, suave) y de cantidad (mucho, poco, varios). Mostrar concordancia en género y número con el sustantivo. Usar ejemplos cortos: la casa blanca, los perros chicos.',
       '["adjetivo", "calificativo", "concordancia", "género", "número", "sustantivo"]'::jsonb,
       'available',
       10),

      ('55555555-5555-5555-5555-555555555511',
       '22222222-2222-2222-2222-222222222202',
       'Adverbios',
       'Definir adverbio como palabra que modifica al verbo, al adjetivo o a otro adverbio. Trabajar adverbios de modo (rápido, despacio), de tiempo (hoy, ayer, siempre), de lugar (acá, allá, lejos) y de cantidad (mucho, poco). Dar ejemplos en oraciones simples.',
       '["adverbio", "modo", "tiempo", "lugar", "cantidad", "modificador del verbo"]'::jsonb,
       'available',
       11),

      ('55555555-5555-5555-5555-555555555512',
       '22222222-2222-2222-2222-222222222202',
       'Sujeto y predicado',
       'Explicar que una oración tiene dos partes: sujeto (de quién o de qué se habla) y predicado (lo que se dice del sujeto). Mostrar cómo identificar el sujeto preguntando quién. Usar oraciones simples como: Sofi camina. El perro come.',
       '["oración", "sujeto", "predicado", "verbo principal", "núcleo del sujeto"]'::jsonb,
       'available',
       12),

      ('55555555-5555-5555-5555-555555555513',
       '22222222-2222-2222-2222-222222222202',
       'Tildación: agudas, graves, esdrújulas',
       'Clasificar palabras según la sílaba tónica. Agudas: acento en la última sílaba (canción, café). Graves: en la anteúltima (árbol, lápiz). Esdrújulas: en la antepenúltima (pájaro, música). Repasar reglas básicas de tildación.',
       '["sílaba tónica", "aguda", "grave", "esdrújula", "tilde", "acento ortográfico"]'::jsonb,
       'available',
       13),

      ('55555555-5555-5555-5555-555555555514',
       '22222222-2222-2222-2222-222222222202',
       'Signos de puntuación',
       'Aprender el uso básico del punto (cierra una idea), la coma (separa elementos o pausa breve) y los dos puntos (anuncian una enumeración o explicación). Mostrar el cambio de sentido cuando se cambia la puntuación. Usar ejemplos en oraciones cortas.',
       '["punto", "coma", "dos puntos", "puntuación", "pausa", "enumeración"]'::jsonb,
       'available',
       14),

      ('55555555-5555-5555-5555-555555555515',
       '22222222-2222-2222-2222-222222222202',
       'Tipos de texto',
       'Diferenciar tres tipos de texto. Narrativo: cuenta una historia con personajes y acciones (cuento, fábula). Descriptivo: dice cómo es algo o alguien. Instructivo: explica cómo hacer algo paso a paso (receta, instructivo de juego).',
       '["texto narrativo", "texto descriptivo", "texto instructivo", "cuento", "receta", "personajes"]'::jsonb,
       'available',
       15),

      ('55555555-5555-5555-5555-555555555516',
       '22222222-2222-2222-2222-222222222202',
       'Comprensión lectora',
       'Practicar estrategias para entender un texto: leer el título primero, identificar de qué se habla, reconocer personajes y acciones principales, responder preguntas literales (qué, quién, dónde, cuándo). Usar textos cortos de 4 a 6 oraciones.',
       '["comprensión lectora", "idea principal", "personajes", "preguntas literales", "título", "texto"]'::jsonb,
       'available',
       16),

      ('55555555-5555-5555-5555-555555555517',
       '22222222-2222-2222-2222-222222222202',
       'Producción escrita',
       'Aprender a planificar un texto corto antes de escribirlo. Pensar qué se quiere contar, ordenar las ideas, escribir con oraciones simples, releer para corregir. Trabajar la escritura de una anécdota o descripción breve.',
       '["producción escrita", "planificar", "borrador", "revisar", "oración simple", "texto corto"]'::jsonb,
       'available',
       17),

      ('55555555-5555-5555-5555-555555555518',
       '22222222-2222-2222-2222-222222222202',
       'Pronombres personales',
       'Definir pronombres personales como palabras que reemplazan al sustantivo. Trabajar los pronombres en singular (yo, vos, él, ella) y en plural (nosotros, ustedes, ellos, ellas). Usar el voseo rioplatense. Mostrar cómo evitan repetir el nombre.',
       '["pronombre personal", "yo", "vos", "él", "ella", "nosotros", "ustedes", "ellos"]'::jsonb,
       'available',
       18),

      -- ===== MATEMÁTICA (block Matemática - Unidad 1) =====
      ('55555555-5555-5555-5555-555555555520',
       '22222222-2222-2222-2222-222222222203',
       'Números hasta el millón',
       'Leer, escribir y descomponer números grandes hasta 1.000.000. Trabajar valor posicional: unidades, decenas, centenas, unidad de mil, decena de mil, centena de mil, unidad de millón. Comparar números con los símbolos mayor que, menor que e igual.',
       '["número natural", "valor posicional", "millón", "unidad de mil", "comparar", "descomponer"]'::jsonb,
       'available',
       10),

      ('55555555-5555-5555-5555-555555555521',
       '22222222-2222-2222-2222-222222222203',
       'División por una cifra',
       'Aprender el algoritmo de la división por un número de una cifra. Identificar dividendo, divisor, cociente y resto. Practicar divisiones exactas (resto cero) y con resto. Usar ejemplos chicos primero, por ejemplo 84 dividido 4.',
       '["división", "dividendo", "divisor", "cociente", "resto", "algoritmo"]'::jsonb,
       'available',
       11),

      ('55555555-5555-5555-5555-555555555522',
       '22222222-2222-2222-2222-222222222203',
       'Múltiplos y divisores',
       'Definir múltiplo como el resultado de multiplicar un número por otro entero. Definir divisor como el número que divide exacto a otro. Trabajar los primeros múltiplos de 2, 5 y 10. Mostrar divisores de números chicos como 12 o 20.',
       '["múltiplo", "divisor", "división exacta", "tabla del 2", "tabla del 5", "tabla del 10"]'::jsonb,
       'available',
       12),

      ('55555555-5555-5555-5555-555555555523',
       '22222222-2222-2222-2222-222222222203',
       'Números decimales',
       'Introducir los números decimales como números con coma. Trabajar décimos (0,1) y centésimos (0,01). Leer y escribir decimales como 1,5 o 2,75. Comparar decimales sencillos. Relacionarlos con dinero (centavos) y medidas.',
       '["número decimal", "coma decimal", "décimo", "centésimo", "comparar", "valor posicional"]'::jsonb,
       'available',
       13),

      ('55555555-5555-5555-5555-555555555524',
       '22222222-2222-2222-2222-222222222203',
       'Suma y resta con decimales',
       'Aprender a sumar y restar números decimales acomodando las comas en columna. Ejemplos: 2,5 más 1,3 igual 3,8. Trabajar problemas simples con dinero, por ejemplo gastar $12,50 de $20. Verificar que las comas queden alineadas.',
       '["suma de decimales", "resta de decimales", "coma alineada", "dinero", "problemas con decimales"]'::jsonb,
       'available',
       14),

      ('55555555-5555-5555-5555-555555555525',
       '22222222-2222-2222-2222-222222222203',
       'Unidades de longitud',
       'Conocer las unidades de longitud del Sistema Métrico: metro (m), centímetro (cm) y kilómetro (km). Saber que 1 m son 100 cm y 1 km son 1000 m. Estimar longitudes cotidianas: una mesa en metros, un lápiz en cm, una ruta en km.',
       '["longitud", "metro", "centímetro", "kilómetro", "equivalencia", "medición"]'::jsonb,
       'available',
       15),

      ('55555555-5555-5555-5555-555555555526',
       '22222222-2222-2222-2222-222222222203',
       'Unidades de peso',
       'Conocer las unidades de peso: gramo (g) y kilogramo (kg). Saber que 1 kg son 1000 g. Estimar pesos cotidianos: una manzana en gramos, una bolsa de harina en kg. Resolver problemas simples convirtiendo entre g y kg.',
       '["peso", "gramo", "kilogramo", "equivalencia", "balanza", "medición"]'::jsonb,
       'available',
       16),

      ('55555555-5555-5555-5555-555555555527',
       '22222222-2222-2222-2222-222222222203',
       'Unidades de capacidad',
       'Conocer las unidades de capacidad: litro (l) y mililitro (ml). Saber que 1 l son 1000 ml. Estimar capacidades: un vaso en ml, una botella de gaseosa en litros. Resolver problemas simples convirtiendo entre l y ml.',
       '["capacidad", "litro", "mililitro", "equivalencia", "líquido", "medición"]'::jsonb,
       'available',
       17),

      ('55555555-5555-5555-5555-555555555528',
       '22222222-2222-2222-2222-222222222203',
       'Área de figuras simples',
       'Definir el área como la superficie que ocupa una figura plana. Calcular el área del cuadrado (lado por lado) y del rectángulo (base por altura). Trabajar con medidas enteras y unidades simples como centímetros cuadrados. Diferenciar área de perímetro.',
       '["área", "superficie", "cuadrado", "rectángulo", "base", "altura", "centímetros cuadrados"]'::jsonb,
       'available',
       18),

      -- ===== CIENCIAS NATURALES (block Naturales - Unidad 1) =====
      ('55555555-5555-5555-5555-555555555530',
       '22222222-2222-2222-2222-222222222204',
       'Sistema respiratorio',
       'Recorrer las partes del sistema respiratorio: nariz, faringe, laringe, tráquea, bronquios y pulmones. Explicar que respirar es tomar oxígeno del aire y soltar dióxido de carbono. Diferenciar inhalación de exhalación. Una etapa por bloque para no saturar.',
       '["sistema respiratorio", "nariz", "tráquea", "pulmones", "oxígeno", "dióxido de carbono", "inhalar", "exhalar"]'::jsonb,
       'available',
       10),

      ('55555555-5555-5555-5555-555555555531',
       '22222222-2222-2222-2222-222222222204',
       'Sistema circulatorio',
       'Conocer las partes principales del sistema circulatorio: corazón, arterias, venas y sangre. Explicar que el corazón bombea la sangre y que la sangre lleva oxígeno y nutrientes a todo el cuerpo. Usar un dibujo simple como anclaje visual.',
       '["sistema circulatorio", "corazón", "arteria", "vena", "sangre", "oxígeno", "nutrientes"]'::jsonb,
       'available',
       11),

      ('55555555-5555-5555-5555-555555555532',
       '22222222-2222-2222-2222-222222222204',
       'Huesos y músculos',
       'Conocer el sistema locomotor: huesos y músculos trabajan juntos para que el cuerpo se mueva. Nombrar huesos conocidos (cráneo, columna, fémur, costillas) y la función de los músculos. Explicar que las articulaciones son los puntos donde se unen los huesos.',
       '["sistema locomotor", "hueso", "músculo", "articulación", "esqueleto", "movimiento"]'::jsonb,
       'available',
       12),

      ('55555555-5555-5555-5555-555555555533',
       '22222222-2222-2222-2222-222222222204',
       'Los cinco sentidos',
       'Conocer los cinco sentidos del cuerpo humano: vista (ojos), oído (oídos), tacto (piel), gusto (lengua) y olfato (nariz). Explicar para qué sirve cada uno y un ejemplo cotidiano: ver un mapa, oír música, tocar tela suave, probar comida, oler una flor.',
       '["sentidos", "vista", "oído", "tacto", "gusto", "olfato", "ojos", "piel", "lengua"]'::jsonb,
       'available',
       13),

      ('55555555-5555-5555-5555-555555555534',
       '22222222-2222-2222-2222-222222222204',
       'Alimentación saludable',
       'Conocer los grupos de alimentos: frutas y verduras, cereales, lácteos, carnes y huevos, agua. Explicar que comer variado y tomar agua ayuda al cuerpo a crecer y tener energía. Diferenciar alimentos diarios de los ocasionales (golosinas, gaseosas).',
       '["alimentación", "frutas", "verduras", "lácteos", "cereales", "agua", "energía", "saludable"]'::jsonb,
       'available',
       14),

      ('55555555-5555-5555-5555-555555555535',
       '22222222-2222-2222-2222-222222222204',
       'Vertebrados e invertebrados',
       'Clasificar a los animales en dos grandes grupos: vertebrados (tienen columna vertebral, como perros, pájaros, peces) e invertebrados (no tienen columna, como insectos, arañas, caracoles). Dar varios ejemplos de cada grupo.',
       '["vertebrados", "invertebrados", "columna vertebral", "mamíferos", "aves", "peces", "insectos"]'::jsonb,
       'available',
       15),

      ('55555555-5555-5555-5555-555555555536',
       '22222222-2222-2222-2222-222222222204',
       'Ecosistemas argentinos',
       'Conocer cuatro grandes ecosistemas de Argentina: selva (Misiones), monte (Cuyo), pampa (centro) y patagonia (sur). Mostrar el clima de cada uno y algunos animales típicos: yaguareté en la selva, ñandú en la pampa, guanaco en la patagonia.',
       '["ecosistema", "selva", "monte", "pampa", "patagonia", "clima", "fauna", "flora"]'::jsonb,
       'available',
       16),

      ('55555555-5555-5555-5555-555555555537',
       '22222222-2222-2222-2222-222222222204',
       'Estados de la materia',
       'Conocer los tres estados de la materia: sólido (forma fija, como una piedra), líquido (toma la forma del recipiente, como el agua) y gaseoso (se expande, como el vapor). Mostrar cómo el agua puede estar en los tres estados: hielo, agua, vapor.',
       '["materia", "sólido", "líquido", "gaseoso", "agua", "hielo", "vapor", "cambio de estado"]'::jsonb,
       'available',
       17),

      ('55555555-5555-5555-5555-555555555538',
       '22222222-2222-2222-2222-222222222204',
       'El sistema solar',
       'Conocer el Sol y los ocho planetas que giran a su alrededor: Mercurio, Venus, Tierra, Marte, Júpiter, Saturno, Urano y Neptuno. Mostrar el orden desde el Sol. Mencionar que la Tierra tiene un satélite, la Luna.',
       '["sistema solar", "Sol", "planeta", "Tierra", "Luna", "Mercurio", "Venus", "Marte", "Júpiter", "órbita"]'::jsonb,
       'available',
       18),

      -- ===== CIENCIAS SOCIALES (geo en block Geografía argentina) =====
      ('55555555-5555-5555-5555-555555555540',
       '22222222-2222-2222-2222-222222222221',
       'Geografía de Córdoba',
       'Conocer el relieve y los ríos de la provincia de Córdoba. Las Sierras de Córdoba: Sierras Chicas, Sierras Grandes y Sierras del Norte. La llanura pampeana al este. Ríos principales: Suquía, Xanaes y Ctalamochita. Embalses como San Roque y Los Molinos.',
       '["provincia de Córdoba", "sierras", "Sierras Chicas", "Sierras Grandes", "llanura pampeana", "río Suquía", "embalse San Roque"]'::jsonb,
       'available',
       20),

      ('55555555-5555-5555-5555-555555555541',
       '22222222-2222-2222-2222-222222222221',
       'Departamentos de Córdoba',
       'Conocer la división política de la provincia de Córdoba en 26 departamentos. Mencionar los más conocidos: Capital, Punilla, Calamuchita, Colón, Río Cuarto, San Justo. Ubicarlos en un mapa simple de la provincia.',
       '["departamento", "Córdoba Capital", "Punilla", "Calamuchita", "Colón", "Río Cuarto", "San Justo"]'::jsonb,
       'available',
       21),

      ('55555555-5555-5555-5555-555555555542',
       '22222222-2222-2222-2222-222222222221',
       'Regiones de Argentina',
       'Conocer las cinco regiones geográficas argentinas: NOA (Salta, Jujuy, Tucumán, Catamarca, Santiago, La Rioja), NEA (Misiones, Corrientes, Chaco, Formosa), Cuyo (Mendoza, San Juan, San Luis), Pampeana (Buenos Aires, Córdoba, Santa Fe, Entre Ríos, La Pampa) y Patagonia (Neuquén, Río Negro, Chubut, Santa Cruz, Tierra del Fuego).',
       '["región", "NOA", "NEA", "Cuyo", "Pampeana", "Patagonia", "provincia"]'::jsonb,
       'available',
       22),

      ('55555555-5555-5555-5555-555555555543',
       '22222222-2222-2222-2222-222222222221',
       'Producción regional argentina',
       'Conocer qué se produce en cada región del país. Pampeana: trigo, maíz, soja, ganado vacuno. NOA: caña de azúcar, tabaco, citrus. NEA: yerba mate, té, algodón. Cuyo: vid (vino), olivos. Patagonia: petróleo, lana, frutas finas como manzana y pera.',
       '["producción", "agricultura", "ganadería", "trigo", "soja", "vid", "yerba mate", "petróleo", "región"]'::jsonb,
       'available',
       23),

      -- ===== CIENCIAS SOCIALES (historia en block Historia argentina) =====
      ('55555555-5555-5555-5555-555555555544',
       '22222222-2222-2222-2222-222222222222',
       'Pueblos originarios argentinos',
       'Conocer los pueblos originarios que vivían en el actual territorio argentino antes de la llegada de los españoles. Diaguitas en el NOA, guaraníes en el NEA, comechingones en Córdoba, mapuches en la patagonia, querandíes en la llanura. Mencionar a qué se dedicaba cada uno.',
       '["pueblos originarios", "diaguitas", "guaraníes", "comechingones", "mapuches", "querandíes", "agricultura", "caza"]'::jsonb,
       'available',
       10),

      ('55555555-5555-5555-5555-555555555545',
       '22222222-2222-2222-2222-222222222222',
       'La sociedad colonial',
       'Conocer cómo se organizó la sociedad en el Virreinato del Río de la Plata, antes de 1810. La capital era Buenos Aires. Había españoles, criollos, indígenas, africanos esclavizados y mestizos. Los oficios de la época: vendedores ambulantes, lavanderas, aguateros, peones.',
       '["Virreinato del Río de la Plata", "colonia", "españoles", "criollos", "indígenas", "africanos", "oficios coloniales"]'::jsonb,
       'available',
       11),

      ('55555555-5555-5555-5555-555555555546',
       '22222222-2222-2222-2222-222222222222',
       'Revolución de Mayo 1810',
       'Conocer los hechos del 25 de mayo de 1810 en Buenos Aires. La gente se reunió en el Cabildo. Se formó la Primera Junta de gobierno, dirigida por Cornelio Saavedra. Fue el primer paso hacia la independencia de España. Personajes clave: Belgrano, Moreno, Castelli.',
       '["Revolución de Mayo", "25 de mayo", "Cabildo", "Primera Junta", "Cornelio Saavedra", "Manuel Belgrano", "Mariano Moreno"]'::jsonb,
       'featured',
       12),

      ('55555555-5555-5555-5555-555555555547',
       '22222222-2222-2222-2222-222222222222',
       'Independencia 1816',
       'Conocer la declaración de la Independencia el 9 de julio de 1816 en San Miguel de Tucumán. Se firmó el Acta de Independencia. Las Provincias Unidas del Río de la Plata se separaron del rey de España. Personajes clave: José de San Martín, Manuel Belgrano, Juan Martín de Pueyrredón.',
       '["Independencia", "9 de julio", "1816", "Tucumán", "Acta de Independencia", "Provincias Unidas", "San Martín"]'::jsonb,
       'available',
       13),

      ('55555555-5555-5555-5555-555555555548',
       '22222222-2222-2222-2222-222222222222',
       'Inmigración (1880-1930)',
       'Conocer la gran inmigración europea a Argentina entre 1880 y 1930. Llegaron principalmente italianos, españoles, alemanes, polacos, judíos y sirio-libaneses. Llegaban en barco al puerto de Buenos Aires. Trabajaban en el campo, en las fábricas y en los oficios. Cambiaron la sociedad argentina.',
       '["inmigración", "italianos", "españoles", "puerto de Buenos Aires", "Hotel de Inmigrantes", "barco", "trabajo"]'::jsonb,
       'available',
       14)
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
      -- Lengua
      '55555555-5555-5555-5555-555555555510',
      '55555555-5555-5555-5555-555555555511',
      '55555555-5555-5555-5555-555555555512',
      '55555555-5555-5555-5555-555555555513',
      '55555555-5555-5555-5555-555555555514',
      '55555555-5555-5555-5555-555555555515',
      '55555555-5555-5555-5555-555555555516',
      '55555555-5555-5555-5555-555555555517',
      '55555555-5555-5555-5555-555555555518',
      -- Matemática
      '55555555-5555-5555-5555-555555555520',
      '55555555-5555-5555-5555-555555555521',
      '55555555-5555-5555-5555-555555555522',
      '55555555-5555-5555-5555-555555555523',
      '55555555-5555-5555-5555-555555555524',
      '55555555-5555-5555-5555-555555555525',
      '55555555-5555-5555-5555-555555555526',
      '55555555-5555-5555-5555-555555555527',
      '55555555-5555-5555-5555-555555555528',
      -- Naturales
      '55555555-5555-5555-5555-555555555530',
      '55555555-5555-5555-5555-555555555531',
      '55555555-5555-5555-5555-555555555532',
      '55555555-5555-5555-5555-555555555533',
      '55555555-5555-5555-5555-555555555534',
      '55555555-5555-5555-5555-555555555535',
      '55555555-5555-5555-5555-555555555536',
      '55555555-5555-5555-5555-555555555537',
      '55555555-5555-5555-5555-555555555538',
      -- Sociales
      '55555555-5555-5555-5555-555555555540',
      '55555555-5555-5555-5555-555555555541',
      '55555555-5555-5555-5555-555555555542',
      '55555555-5555-5555-5555-555555555543',
      '55555555-5555-5555-5555-555555555544',
      '55555555-5555-5555-5555-555555555545',
      '55555555-5555-5555-5555-555555555546',
      '55555555-5555-5555-5555-555555555547',
      '55555555-5555-5555-5555-555555555548'
    );
  `);
};
