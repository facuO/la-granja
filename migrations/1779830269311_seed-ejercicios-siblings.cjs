// Para cada topic existente (54 en total), creamos un sibling "Ejercicios: X"
// con description que le indica al LLM generar contenido tipo PRÁCTICA (no
// teoría: problemas concretos a resolver, no definiciones a recordar).
//
// Order_index = theory.order_index + 1000 → exercises caen DESPUÉS de toda
// la teoría en la lista de la materia, formando un bloque "ejercicios"
// pedagógico al final.
//
// UUIDs: 66666666-6666-6666-6666-666666666001 a ..054 (secuencial).
// Sin generated_blocks. Se generan en batches desde admin.

const THEORY_TOPICS = [
  // [theory_id, block_id, theory_title, theory_order, theory_description, key_concepts_json]
  ["55555555-5555-5555-5555-555555555507","22222222-2222-2222-2222-222222222204","Animales de granja y su alimentación",1,"Conocer los animales típicos de una granja (vaca, oveja, cerdo, gallina, caballo) y qué come cada uno. Diferenciar herbívoros de omnívoros.",["animales","granja","herbívoro","omnívoro","vaca","oveja","cerdo","gallina"]],
  ["55555555-5555-5555-5555-555555555508","22222222-2222-2222-2222-222222222204","Ciclo del agua",2,"Las tres etapas del ciclo del agua: evaporación, condensación y precipitación.",["evaporación","condensación","precipitación","ciclo del agua","vapor","nube"]],
  ["55555555-5555-5555-5555-555555555509","22222222-2222-2222-2222-222222222204","El sistema digestivo",3,"El camino de la comida: boca, esófago, estómago, intestino delgado, intestino grueso.",["sistema digestivo","boca","esófago","estómago","intestino delgado","intestino grueso"]],
  ["55555555-5555-5555-5555-555555555530","22222222-2222-2222-2222-222222222204","Sistema respiratorio",10,"Las partes del sistema respiratorio: nariz, tráquea, pulmones. Inhalar y exhalar.",["sistema respiratorio","nariz","tráquea","pulmones","oxígeno","inhalar","exhalar"]],
  ["55555555-5555-5555-5555-555555555531","22222222-2222-2222-2222-222222222204","Sistema circulatorio",11,"Corazón, arterias, venas y sangre. El corazón bombea la sangre.",["sistema circulatorio","corazón","arteria","vena","sangre"]],
  ["55555555-5555-5555-5555-555555555532","22222222-2222-2222-2222-222222222204","Huesos y músculos",12,"Huesos y músculos forman el sistema locomotor.",["huesos","músculos","articulación","esqueleto","movimiento"]],
  ["55555555-5555-5555-5555-555555555533","22222222-2222-2222-2222-222222222204","Los cinco sentidos",13,"Vista, oído, tacto, gusto y olfato.",["sentidos","vista","oído","tacto","gusto","olfato"]],
  ["55555555-5555-5555-5555-555555555534","22222222-2222-2222-2222-222222222204","Alimentación saludable",14,"Grupos de alimentos. Variar comida y tomar agua.",["alimentación","frutas","verduras","cereales","lácteos","saludable"]],
  ["55555555-5555-5555-5555-555555555535","22222222-2222-2222-2222-222222222204","Vertebrados e invertebrados",15,"Clasificar animales: vertebrados (columna) vs invertebrados.",["vertebrados","invertebrados","columna vertebral","mamíferos","insectos"]],
  ["55555555-5555-5555-5555-555555555536","22222222-2222-2222-2222-222222222204","Ecosistemas argentinos",16,"Selva, monte, pampa, patagonia. Animales típicos de cada uno.",["ecosistema","selva","monte","pampa","patagonia","yaguareté","guanaco"]],
  ["55555555-5555-5555-5555-555555555537","22222222-2222-2222-2222-222222222204","Estados de la materia",17,"Sólido, líquido, gaseoso. El agua puede estar en los tres estados.",["materia","sólido","líquido","gaseoso","hielo","vapor"]],
  ["55555555-5555-5555-5555-555555555538","22222222-2222-2222-2222-222222222204","El sistema solar",18,"El Sol y los 8 planetas. La Tierra tiene la Luna.",["sistema solar","sol","planeta","tierra","luna","órbita"]],
  ["33333333-3333-3333-3333-333333333331","22222222-2222-2222-2222-222222222221","Puntos cardinales y mapas",0,"Norte, sur, este, oeste. Cómo leer un mapa básico.",["norte","sur","este","oeste","mapa"]],
  ["33333333-3333-3333-3333-333333333332","22222222-2222-2222-2222-222222222221","Provincias y regiones",1,"Las 23 provincias y CABA, agrupadas por región (NOA, NEA, Cuyo, Centro, Patagonia).",["provincia","CABA","región","NOA","NEA","Cuyo","Patagonia"]],
  ["33333333-3333-3333-3333-333333333333","22222222-2222-2222-2222-222222222221","Capitales",2,"Capital de cada provincia.",["capital","provincia","ciudad"]],
  ["33333333-3333-3333-3333-333333333334","22222222-2222-2222-2222-222222222221","Relieves y climas",3,"Llanura, montaña, meseta. Climas dominantes por región.",["llanura","montaña","meseta","clima"]],
  ["44444444-4444-4444-4444-444444444401","22222222-2222-2222-2222-222222222221","Países limítrofes con Argentina",10,"Bolivia, Brasil, Chile, Paraguay, Uruguay.",["países limítrofes","Bolivia","Brasil","Chile","Paraguay","Uruguay"]],
  ["44444444-4444-4444-4444-444444444402","22222222-2222-2222-2222-222222222221","Provincias con la Cordillera de los Andes",11,"Mendoza, Salta, Catamarca, Santa Cruz limitan con la Cordillera.",["Cordillera","Andes","Mendoza","Salta","Catamarca","Santa Cruz"]],
  ["44444444-4444-4444-4444-444444444403","22222222-2222-2222-2222-222222222221","Verdadero o falso geográfico",12,"Repaso de conceptos básicos con preguntas V o F.",["Atlántico","Pacífico","Mar Argentino","costas"]],
  ["44444444-4444-4444-4444-444444444404","22222222-2222-2222-2222-222222222221","Territorio, población y autoridades",13,"Territorio (espacio físico), población (personas), autoridades (gobierno).",["territorio","población","autoridades","gobierno","presidente"]],
  ["44444444-4444-4444-4444-444444444405","22222222-2222-2222-2222-222222222221","Leer mapas con símbolos",14,"Símbolos de mapas: montaña, nieve, lluvia, sol, bosque.",["símbolos","mapa","montaña","nieve","lluvia","sol","bosque"]],
  ["55555555-5555-5555-5555-555555555540","22222222-2222-2222-2222-222222222221","Geografía de Córdoba",20,"Sierras de Córdoba, llanura pampeana, ríos (Suquía, Xanaes, Ctalamochita).",["Córdoba","sierras","Suquía","río","embalse"]],
  ["55555555-5555-5555-5555-555555555541","22222222-2222-2222-2222-222222222221","Departamentos de Córdoba",21,"Capital, Punilla, Calamuchita, Colón, Río Cuarto, San Justo.",["departamento","Capital","Punilla","Calamuchita","Río Cuarto"]],
  ["55555555-5555-5555-5555-555555555542","22222222-2222-2222-2222-222222222221","Regiones de Argentina",22,"NOA, NEA, Cuyo, Pampeana, Patagonia y sus provincias.",["región","NOA","NEA","Cuyo","Pampeana","Patagonia"]],
  ["55555555-5555-5555-5555-555555555543","22222222-2222-2222-2222-222222222221","Producción regional argentina",23,"Qué se produce en cada región del país.",["producción","trigo","soja","vid","yerba mate","petróleo","cítricos"]],
  ["55555555-5555-5555-5555-555555555544","22222222-2222-2222-2222-222222222222","Pueblos originarios argentinos",10,"Diaguitas, guaraníes, comechingones, mapuches, querandíes y a qué se dedicaban.",["pueblos originarios","diaguitas","guaraníes","comechingones","mapuches","querandíes"]],
  ["55555555-5555-5555-5555-555555555545","22222222-2222-2222-2222-222222222222","La sociedad colonial",11,"Sociedad del Virreinato del Río de la Plata antes de 1810.",["Virreinato","colonia","españoles","criollos","indígenas","oficios"]],
  ["55555555-5555-5555-5555-555555555546","22222222-2222-2222-2222-222222222222","Revolución de Mayo 1810",12,"25 de mayo de 1810. Cabildo, Primera Junta, Saavedra, Belgrano, Moreno.",["Revolución de Mayo","25 de mayo","Cabildo","Primera Junta","Saavedra","Belgrano"]],
  ["55555555-5555-5555-5555-555555555547","22222222-2222-2222-2222-222222222222","Independencia 1816",13,"9 de julio de 1816 en Tucumán. San Martín, Belgrano, Pueyrredón.",["Independencia","9 de julio","1816","Tucumán","San Martín"]],
  ["55555555-5555-5555-5555-555555555548","22222222-2222-2222-2222-222222222222","Inmigración (1880-1930)",14,"Italianos, españoles, alemanes, polacos. Puerto de Buenos Aires, Hotel de Inmigrantes.",["inmigración","italianos","españoles","puerto","Hotel de Inmigrantes"]],
  ["55555555-5555-5555-5555-555555555501","22222222-2222-2222-2222-222222222202","Sustantivos comunes y propios",1,"Sustantivos comunes (perro, casa) vs propios (Sofi, Córdoba). Mayúscula inicial en propios.",["sustantivo","común","propio","mayúscula"]],
  ["55555555-5555-5555-5555-555555555502","22222222-2222-2222-2222-222222222202","Verbos: acciones que hacemos",2,"Verbo: palabra que indica acción. Identificar verbos en oraciones.",["verbo","acción","oración"]],
  ["55555555-5555-5555-5555-555555555503","22222222-2222-2222-2222-222222222202","Sinónimos y antónimos",3,"Sinónimos (significado parecido) y antónimos (significado opuesto).",["sinónimo","antónimo","significado"]],
  ["55555555-5555-5555-5555-555555555515","22222222-2222-2222-2222-222222222202","Tipos de texto",15,"Narrativo (cuento), descriptivo (cómo es algo), instructivo (paso a paso).",["narrativo","descriptivo","instructivo","cuento","receta"]],
  ["55555555-5555-5555-5555-555555555516","22222222-2222-2222-2222-222222222202","Comprensión lectora",16,"Estrategias para entender un texto: título, idea principal, personajes.",["comprensión","idea principal","personajes","título"]],
  ["55555555-5555-5555-5555-555555555517","22222222-2222-2222-2222-222222222202","Producción escrita",17,"Planificar, escribir, revisar un texto corto.",["planificar","escribir","revisar","texto corto"]],
  ["55555555-5555-5555-5555-555555555518","22222222-2222-2222-2222-222222222202","Pronombres personales",18,"Yo, vos, él, ella, nosotros, ustedes, ellos. Reemplazan al sustantivo.",["pronombre","yo","vos","él","ella","ustedes","ellos"]],
  ["55555555-5555-5555-5555-555555555510","22222222-2222-2222-2222-222222222203","Comparar números: mayor y menor",-5,"Comparar dos números con > y <. Hasta 100.",["mayor","menor","comparar","mayor que","menor que"]],
  ["55555555-5555-5555-5555-555555555511","22222222-2222-2222-2222-222222222203","Pares e impares",-4,"Pares terminan en 0,2,4,6,8. Impares en 1,3,5,7,9.",["par","impar","termina en","agrupar"]],
  ["55555555-5555-5555-5555-555555555512","22222222-2222-2222-2222-222222222203","Sumas hasta 100",-3,"Sumar dos números cuando el resultado no pasa de 100. Sin llevar.",["suma","resultado","decenas","unidades"]],
  ["55555555-5555-5555-5555-555555555513","22222222-2222-2222-2222-222222222203","Mitad y doble",-2,"La mitad de X es partir en 2; el doble es X + X.",["mitad","doble","partes iguales"]],
  ["55555555-5555-5555-5555-555555555514","22222222-2222-2222-2222-222222222203","Reconocer figuras geométricas",-1,"Cuadrado, rectángulo, triángulo: lados y vértices.",["cuadrado","rectángulo","triángulo","lados","vértices"]],
  ["55555555-5555-5555-5555-555555555504","22222222-2222-2222-2222-222222222203","Multiplicación por 2 cifras",1,"Algoritmo: por las unidades, después por las decenas, sumar los resultados.",["multiplicación","unidades","decenas","algoritmo"]],
  ["55555555-5555-5555-5555-555555555505","22222222-2222-2222-2222-222222222203","Fracciones: qué son",2,"Fracción: parte de un entero. Numerador y denominador. Medio, tercio, cuarto.",["fracción","numerador","denominador","medio","tercio","cuarto"]],
  ["55555555-5555-5555-5555-555555555506","22222222-2222-2222-2222-222222222203","Perímetro de figuras",3,"Perímetro = suma de los lados. Cuadrado, rectángulo, triángulo.",["perímetro","lados","suma","cuadrado","rectángulo"]],
  ["55555555-5555-5555-5555-555555555520","22222222-2222-2222-2222-222222222203","Números hasta el millón",10,"Valor posicional: unidades, decenas, centenas, miles, millón.",["valor posicional","millón","unidad de mil","comparar"]],
  ["55555555-5555-5555-5555-555555555521","22222222-2222-2222-2222-222222222203","División por una cifra",11,"Dividendo, divisor, cociente, resto.",["división","dividendo","divisor","cociente","resto"]],
  ["55555555-5555-5555-5555-555555555522","22222222-2222-2222-2222-222222222203","Múltiplos y divisores",12,"Múltiplos de 2, 5 y 10. Divisores de números chicos.",["múltiplo","divisor","tabla del 2","tabla del 5","tabla del 10"]],
  ["55555555-5555-5555-5555-555555555523","22222222-2222-2222-2222-222222222203","Números decimales",13,"Décimos (0,1), centésimos (0,01). Leer y escribir decimales.",["decimal","coma","décimo","centésimo"]],
  ["55555555-5555-5555-5555-555555555524","22222222-2222-2222-2222-222222222203","Suma y resta con decimales",14,"Acomodar las comas en columna. Problemas con dinero.",["suma de decimales","resta de decimales","coma","dinero"]],
  ["55555555-5555-5555-5555-555555555525","22222222-2222-2222-2222-222222222203","Unidades de longitud",15,"Metro, centímetro, kilómetro. 1m=100cm, 1km=1000m.",["metro","centímetro","kilómetro","equivalencia"]],
  ["55555555-5555-5555-5555-555555555526","22222222-2222-2222-2222-222222222203","Unidades de peso",16,"Gramo y kilogramo. 1kg=1000g.",["gramo","kilogramo","equivalencia"]],
  ["55555555-5555-5555-5555-555555555527","22222222-2222-2222-2222-222222222203","Unidades de capacidad",17,"Litro y mililitro. 1l=1000ml.",["litro","mililitro","equivalencia"]],
  ["55555555-5555-5555-5555-555555555528","22222222-2222-2222-2222-222222222203","Área de figuras simples",18,"Área de cuadrado (lado x lado) y rectángulo (base x altura).",["área","superficie","cuadrado","rectángulo","base","altura"]],
];

function shortTitle(theoryTitle) {
  // Devuelve un title de ejercicios cortito (≤6 palabras incluyendo "Ejercicios:")
  const map = {
    "Animales de granja y su alimentación": "Animales de granja",
    "El sistema digestivo": "Sistema digestivo",
    "Provincias con la Cordillera de los Andes": "Provincias y Cordillera",
    "Países limítrofes con Argentina": "Países limítrofes",
    "Pueblos originarios argentinos": "Pueblos originarios",
    "Territorio, población y autoridades": "Territorio y gobierno",
    "Verdadero o falso geográfico": "V o F geográfico",
    "Leer mapas con símbolos": "Mapas con símbolos",
    "Sustantivos comunes y propios": "Sustantivos",
    "Verbos: acciones que hacemos": "Verbos",
    "Comparar números: mayor y menor": "Comparar números",
    "Multiplicación por 2 cifras": "Multiplicación 2 cifras",
    "Fracciones: qué son": "Fracciones",
    "Tildación: agudas, graves, esdrújulas": "Tildación",
    "Reconocer figuras geométricas": "Figuras geométricas",
    "Inmigración (1880-1930)": "Inmigración 1880-1930",
    "Revolución de Mayo 1810": "Revolución de Mayo",
  };
  return map[theoryTitle] || theoryTitle;
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
  const values = THEORY_TOPICS.map((row, i) => {
    const [theoryId, blockId, theoryTitle, theoryOrder, theoryDescription, keyConcepts] = row;
    const seq = String(i + 1).padStart(3, "0");
    const exerciseId = `66666666-6666-6666-6666-666666666${seq}`;
    const title = `Ejercicios: ${shortTitle(theoryTitle)}`;
    const description = ejerciciosDescription(theoryTitle, theoryDescription, keyConcepts);
    const keyJson = JSON.stringify(keyConcepts);
    const order = theoryOrder + 1000;
    const safeDesc = description.replace(/'/g, "''");
    const safeTitle = title.replace(/'/g, "''");
    return `('${exerciseId}', '${blockId}', '${safeTitle}', '${safeDesc}', '${keyJson}'::jsonb, 'available', ${order})`;
  }).join(",\n      ");

  pgm.sql(`
    INSERT INTO topics (id, block_id, title, description, key_concepts, status, order_index)
    VALUES
      ${values}
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
    DELETE FROM topics WHERE id::text LIKE '66666666-6666-6666-6666-666666666%';
  `);
};
