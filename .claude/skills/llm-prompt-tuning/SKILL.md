---
name: llm-prompt-tuning
description: Metodología para iterar el system prompt del LLM (real-tutor.ts para generación de topics, real-chat.ts para chat conversacional). A/B sistemático con el mismo input, comparación lado a lado, validación contra reglas, propuestas de cambio fundamentadas. Evita modificaciones "a ojo" del prompt.
---

# Iteración del system prompt

Los system prompts en `src/server/services/real-tutor.ts` (generación de topics) y `src/server/services/real-chat.ts` (chat) son el contrato que define qué tipo de contenido produce el LLM. Cambiarlos a ojo es tentador pero peligroso: una mejora aparente en un caso puede romper otro.

Este skill define cómo iterar metódicamente.

## Cuándo invocar

- Cuando se detecte un patrón problemático recurrente en outputs del LLM (varios topics con el mismo defecto).
- Cuando los therapists devuelven veredictos similares en múltiples revisiones.
- Antes de mergear un cambio al system prompt.
- Cuando se incorpora una nueva regla a `sofi-content-rules` y hay que reflejarla en el prompt.

## Procedimiento

### 1. Definir el problema concretamente

NO: "el LLM genera contenido poco natural".
SÍ: "en 5 de 5 topics generados, el LLM cierra con la frase 'Aprender X es útil' que es vacía pedagógicamente. Quiero que cierre con un resumen específico del topic."

Sin un problema concreto y un criterio de éxito, no se puede A/B.

### 2. Elegir el corpus de prueba

Mínimo **3 inputs distintos** (3 topics con title + description diferentes). Idealmente 5. Tomarlos del DB real (`SELECT title, description, key_concepts FROM topics`).

### 3. Generar el baseline (prompt actual)

Llamar al endpoint de generación con cada input usando el system prompt actual. Guardar outputs como archivos `baseline_<topic_id>.json`.

```bash
# Asumiendo que ya estás autenticado como parent:
for topic_id in <ids>; do
  curl -s -X POST "https://<host>/api/admin/topics/$topic_id/generate" \
    -H 'content-type: application/json' \
    -H "Cookie: $COOKIE" > "baseline_$topic_id.json"
done
```

(O si querés evitar consumir API/cache: extraer el system prompt actual, llamar a Groq fuera de la app con ese system + el user prompt y guardar el output.)

### 4. Redactar el cambio propuesto

Editar el system prompt como diff explícito. NO reescribir todo de cero. NO hacer múltiples cambios independientes a la vez — uno por iteración para poder atribuir el efecto.

Comentar el diff con la regla que viene a satisfacer ("agrega instrucción de cierre específico").

### 5. Generar el variant (prompt nuevo)

Mismo corpus, mismo modelo, mismo `temperature` (default 0.7). Guardar como `variant_<topic_id>.json`.

### 6. Comparación lado a lado

Para cada topic, comparar baseline vs variant en estas dimensiones:

| Dimensión | Baseline | Variant |
|---|---|---|
| ¿Cumple `sofi-content-rules`? | check / lista de violaciones | check / lista |
| ¿Pasa `topic-block-flow`? | check / errors | check / errors |
| ¿Cobertura ARASAAC? | % de palabras content con pic | % |
| Problema específico que el cambio quiere arreglar | violado / OK | violado / OK |
| Defectos nuevos introducidos (regresiones) | — | lista |

### 7. Validar con therapists si el cambio tiene impacto pedagógico

Si el cambio toca cómo se estructura el contenido (no solo redacción), pasar los outputs por:
- `fono-therapist` (lenguaje)
- `psicoped-therapist` (estructura cognitiva)

### 8. Decidir

- **Variant mejor en todas las dimensiones**: aceptar cambio, mergear.
- **Variant mejor en algunas, peor en otras**: NO mergear sin discutir. Refinar el cambio o aceptar el tradeoff explícitamente.
- **Variant igual o peor**: descartar. Documentar el experimento (para no repetirlo) en `docs/prompt-experiments/`.

## Convenciones para el system prompt mismo

Cuando edites el prompt, mantener la estructura en capas que ya existe:

1. **Identidad**: quién es el tutor.
2. **Reglas no negociables**: lista numerada, imperativa, corta. Sin justificación verbosa.
3. **Estructura requerida**: cuántos bloques, qué tipos, qué orden.
4. **Contrato de salida**: shape exacto del JSON.
5. **Ejemplos**: opcional, máximo 1-2, solo si el shape es ambiguo.

NO agregar:
- Personalidad ("sos un tutor cálido y simpático") — afecta poco y consume tokens.
- Justificaciones largas de por qué las reglas existen — el LLM ya las cumple si están explícitas.
- Instrucciones contradictorias entre capas.

## Documentación de experimentos

Cada iteración produce un markdown en `docs/prompt-experiments/<fecha>-<descripcion>.md`:

```markdown
# 2026-05-25 — Cierre específico vs genérico

**Problema**: LLM cierra topics con frases genéricas vacías ("Aprender X es útil").
**Hipótesis**: Agregar regla "El último bloque debe ser una explanation que resuma 1 hecho concreto del topic" lo arregla.

## Corpus
- Capitales (33333333-...)
- Países limítrofes
- Provincias Andes

## Diff aplicado al prompt
[snippet]

## Resultados
| Topic | Baseline cierre | Variant cierre | Mejor |
|---|---|---|---|
| ... | ... | ... | ... |

## Decisión
Mergear / Descartar / Refinar
```

## Lo que NO hacés

- No editar el prompt directamente sin pasar por las pasos 3-6.
- No mergear cambios "porque parecen buenos" sin corpus de prueba.
- No optimizar contra UN solo input — siempre 3+ para evitar overfitting.
