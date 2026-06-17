---
name: arasaac-coverage
description: Dado texto nuevo (de un topic, una respuesta del LLM, o cualquier copy), encuentra las palabras content que no tienen pictograma ARASAAC asignado en el tokenizer, y propone IDs candidatos consultando la API de ARASAAC. Mantiene el tokenizer sincronizado con el contenido real.
---

# Cobertura de pictogramas ARASAAC

El tutor renderiza cada palabra content (sustantivo, verbo, lugar, adjetivo) acompañada de un pictograma ARASAAC. Cuando aparece texto nuevo, las palabras que no están mapeadas en `src/server/services/phrase-tokenizer.ts` quedan **sin pictograma** — la columna queda vacía. Esto rompe la consistencia SAAC y le quita a Sofi una de las pistas que la ayudan a leer.

Este skill mantiene la cobertura del mapping al día.

## Archivo a editar

`src/server/services/phrase-tokenizer.ts` — exporta un objeto `ARASAAC: Record<string, number | null>` donde la clave es la palabra normalizada (lowercase, sin acentos, sin puntuación) y el valor es el ID del pictograma. `null` significa "explícitamente sin pictograma" (porque ARASAAC no tiene uno bueno para esa palabra; mejor que dejar la palabra sin atender).

## Cuándo invocar este skill

- Al validar contenido generado por el LLM (Plan 2)
- Al sumar topics hand-crafted nuevos a `stub-tutor.ts`
- Al cambiar las sugerencias del chat (`real-chat.ts` system prompt o respuestas reales)
- Periódicamente (audit pass): listar todas las palabras content de la DB y reportar las no cubiertas

## Procedimiento

### 1. Tokenizar el texto nuevo

Aplicar `normalize()` del propio `phrase-tokenizer.ts`:

```typescript
function normalize(word) {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.,;:!?¡¿"']/g, "");
}
```

Esto da las claves a buscar.

### 2. Filtrar palabras content

Conectores y palabras funcionales NO necesitan pictograma. Excluir:
- Artículos: el, la, los, las, un, una, unos, unas
- Preposiciones: de, en, a, por, para, con, sin, sobre, entre, hasta, desde, hacia
- Conjunciones: y, e, o, u, pero, si, que, porque, cuando, mientras
- Pronombres átonos: me, te, se, le, nos, lo, la, los, las, les
- Auxiliares: ser, estar, haber (sus formas comunes)
- Cuantificadores cortos: muy, mas, menos, también, tampoco

Lo que SÍ necesita pictograma:
- Sustantivos (provincia, río, montaña, capital, ...)
- Verbos de contenido (aprender, mirar, escribir, contar, ...)
- Lugares y entidades (Argentina, Mendoza, Andes, Chile, ...)
- Adjetivos relevantes (grande, frío, importante, ...)
- Números cuando son cantidad concreta (5, dos, ...)

### 3. Detectar gaps

Para cada palabra content normalizada, chequear si está en el `ARASAAC` map de `phrase-tokenizer.ts`. Listar las que faltan.

### 4. Proponer IDs candidatos consultando la API

ARASAAC tiene API pública sin auth:

```bash
curl "https://api.arasaac.org/api/pictograms/es/search/<termino>"
```

Devuelve un array con los mejores matches, cada uno con `_id` (el número que va al map) y `keywords` (lista de variantes). El primer resultado suele ser el correcto si la palabra es común.

Para cada palabra faltante, traer top 3 candidatos. Si el top match tiene la palabra exacta como primer keyword, proponerlo directo. Si es ambiguo, listar los 3 para review humano.

**Trampas conocidas** (de iteraciones pasadas):
- `montaña` matcheaba con ID 34155 que era "camilla plegable". Cuidado con homógrafos.
- `marcar` matcheaba con ID 4691 que era "telefonear". Ojo con verbos polisémicos.
- `pacífico` y `territorio` no tienen pictograma decente — mapear a `null`.
- `país`: en lugar del genérico, mapear a 8030 (Argentina con bandera), porque para Sofi "país" implica Argentina y el visual es más concreto.

### 5. Validar y proponer cambio

Reportar como diff propuesto:

```typescript
// Agregar en ARASAAC de phrase-tokenizer.ts:
ríos: 2811,           // ARASAAC top match "rio", keyword exacto
clima: 7106,          // top match
inundación: null,     // no hay pictograma decente, dejar sin
patagonia: null,      // término geográfico específico, no hay
```

NO editar el archivo directo en un loop autónomo. Devolver el diff propuesto al humano que lo invocó.

### 6. Si la palabra repite mucho pero no tiene pictograma decente

Considerar:
- Reescribir el contenido para usar un sinónimo que SÍ tenga pictograma (con cuidado de no romper precisión semántica).
- Aceptar `null` y vivir con la palabra sin pictograma (mejor que un pictograma incorrecto que la confunda).

## Cómo entregás la auditoría

Reporte estructurado:

- **Texto evaluado**: bloque/topic/respuesta concreta
- **Palabras content totales**: N
- **Cobertura actual**: M/N (X%)
- **Faltantes**: lista con candidatos sugeridos (ID + keyword + nota si es ambiguo)
- **Cambios sugeridos en `phrase-tokenizer.ts`**: snippet listo para review

## Lo que NO hacés

- No editás `phrase-tokenizer.ts` por tu cuenta sin que un humano apruebe los IDs.
- No bajás imágenes (los pictogramas son hotlinked vía `static.arasaac.org`).
- No proponés cambios al contenido del topic — solo a la cobertura. (Para cambios de contenido, ver `sofi-content-rules`).
