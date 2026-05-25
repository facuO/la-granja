---
name: topic-block-flow
description: Valida la estructura pedagógica de una secuencia de bloques (`StubBlock[]`) de un topic. Asegura que haya introducción, preguntas distribuidas, feedbacks que enseñan, cierre, sin secuencias largas de explanations sin interacción, sin questions huérfanas, sin feedbacks sueltos.
---

# Validación de flujo de bloques de un topic

Cada topic se entrega a Sofi como una secuencia de bloques (`StubBlock[]`). El **orden** y la **proporción** de tipos de bloque importan tanto como el contenido individual.

Tipos de bloques (ver `src/server/services/stub-tutor.ts`):

- `explanation`: una oración corta explicando algo
- `visual`: mapa, imagen, soporte visual
- `question`: multiple_choice / multi_select / true_false
- `feedback`: respuesta a una question previa, debe explicar por qué

## Reglas de flujo

### 1. Apertura del topic
- **Primer bloque debe ser `explanation`** que anuncie el tema. No empezar directo con una question.
- **Al menos 2 explanations antes de la primera question.** Sofi necesita contexto antes de evaluar.

### 2. Acompañamiento de questions
- **Toda `question` DEBE ir seguida por un `feedback`** en el bloque inmediato siguiente. Sin excepciones.
- **El `feedback` debe responder específicamente a esa question** — no genérico.
- **Si la question tiene un visual de apoyo, el visual va ANTES de la question**, no después.

### 3. Balance del topic
Para un topic de N bloques (típico 8-16):

- Mínimo **1 question cada 5-6 bloques**. Si hay más explanations seguidas, Sofi se aburre / pierde atención.
- Mínimo **1 visual** en topics geográficos / espaciales / con entidades concretas.
- Máximo **3 explanations seguidas sin question o visual** intermedio.

### 4. Cierre
- **Último o anteúltimo bloque debería ser `feedback` o `explanation` de cierre** ("ahora ya sabés que..."). Un topic que termina en una question abierta deja a Sofi con incertidumbre.

### 5. No huérfanos
- **`feedback` sin `question` previa = huérfano**, error.
- **`question` sin `feedback` posterior = huérfana**, error.
- Esto puede pasar fácilmente cuando el LLM genera y se corta.

## Validación programática

Dado `blocks: StubBlock[]`, chequear:

```typescript
function validateFlow(blocks) {
  const errors = [];
  const warnings = [];

  // Apertura
  if (blocks[0]?.block_kind !== "explanation") {
    errors.push("Topic no empieza con explanation");
  }
  let firstQuestionAt = blocks.findIndex(b => b.block_kind === "question");
  if (firstQuestionAt >= 0 && firstQuestionAt < 2) {
    warnings.push(`Question aparece muy temprano (bloque ${firstQuestionAt + 1}); mínimo después del 3°`);
  }

  // Question → Feedback
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].block_kind === "question") {
      if (blocks[i + 1]?.block_kind !== "feedback") {
        errors.push(`Question en bloque ${i + 1} no tiene feedback en el siguiente bloque`);
      }
    }
    if (blocks[i].block_kind === "feedback") {
      if (blocks[i - 1]?.block_kind !== "question") {
        errors.push(`Feedback en bloque ${i + 1} no tiene question previa (huérfano)`);
      }
    }
  }

  // Secuencias de explanations sin break
  let consecutiveExp = 0;
  for (const b of blocks) {
    if (b.block_kind === "explanation") {
      consecutiveExp++;
      if (consecutiveExp > 3) {
        warnings.push("Más de 3 explanations seguidas — Sofi pierde atención");
      }
    } else {
      consecutiveExp = 0;
    }
  }

  // Cobertura mínima
  const totalQuestions = blocks.filter(b => b.block_kind === "question").length;
  if (totalQuestions === 0) {
    errors.push("Topic sin ninguna question");
  } else if (totalQuestions / blocks.length < 0.15) {
    warnings.push(`Solo ${totalQuestions} questions en ${blocks.length} bloques (poca interacción)`);
  }

  // Largo total
  if (blocks.length < 6) warnings.push("Topic muy corto (<6 bloques)");
  if (blocks.length > 20) warnings.push("Topic muy largo (>20 bloques) — riesgo de fatiga");

  return { errors, warnings, valid: errors.length === 0 };
}
```

## Cómo entregás validación

Reporte estructurado:

- **Mapa lineal del topic** (1 línea por bloque):
  ```
  1. explanation   — "Argentina tiene provincias"
  2. explanation   — "Cada provincia tiene capital"
  3. visual        — mapa político Argentina
  4. question (MC) — "Capital de Buenos Aires"
  5. feedback      — "La Plata es la capital..."
  ...
  ```
- **Errors** (cosas rotas que requieren fix obligatorio).
- **Warnings** (cosas mejorables pero no bloqueantes).
- **Sugerencia de reordenamiento o de bloques a insertar/eliminar** si aplica.

## Cuándo invocar este skill

- En el agente que valida `topics.generated_blocks` después de cada generación LLM.
- Antes de mergear PRs que agreguen topics hand-crafted nuevos a `stub-tutor.ts`.
- Periódicamente sobre topics existentes (audit pass).

## Lo que NO hacés

- No validás el **contenido textual** de cada bloque (eso es de `sofi-content-rules`).
- No validás la **cobertura de pictogramas** (eso es de `arasaac-coverage`).
- No editás los bloques — solo reportás el diagnóstico.
