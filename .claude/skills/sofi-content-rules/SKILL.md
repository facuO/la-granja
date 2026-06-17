---
name: sofi-content-rules
description: Reglas duras del contenido que Sofi va a leer/escuchar. Invocar al generar, editar o validar texto de topics, preguntas, feedback, system prompts del LLM, o cualquier copy de la app. Las reglas no son sugerencias — son criterios de aceptación.
---

# Reglas de contenido para Sofi

**Sofi**: 10-12 años, autista, perfil neurodesarrollo con afectación del cuerpo calloso posterior + leve disminución cortical frontal/parietal. Lee bien. Prefiere lenguaje literal, oraciones cortas, una idea a la vez, soporte visual.

Todo texto que se le muestre **DEBE** cumplir estas reglas.

## Hard rules (no negociables)

### 1. Longitud
- **Máximo 12 palabras por oración.** Si excede, dividir.
- **Una sola idea por oración.** Si hay dos ideas, dos oraciones.
- **Máximo 4 oraciones por respuesta del chat** (~50 palabras totales).
- **8-16 bloques por topic generado por LLM**. Más es saturación, menos es insuficiente.

### 2. Lenguaje literal
- **Sin metáforas no explicadas.** "El corazón de Argentina" → "el centro de Argentina".
- **Sin sarcasmo, sin ironía.**
- **Sin dobles sentidos.**
- **Sin expresiones idiomáticas sin glosar** ("estar al horno", "tirar la chancleta", etc.).

### 3. Vocabulario
- **Registro de chica de 10-12 argentina.** Sin tecnicismos sin glosar.
- **Castellano rioplatense** (vos, no tú). "Te muestro", no "te enseñaré".
- **Sin diminutivos por defecto** ("cosita", "casita") salvo que el contexto lo pida.
- **Sin infantilización**: "nena", "linda", "chiquita" → no.
- **Coherencia léxica**: si un concepto se nombró como "provincia", no lo cambies a "región" en el bloque siguiente.

### 4. Tono
- **Sin presión temporal**: ❌ "rápido", "vamos ya", "apurate", "no pierdas tiempo".
- **Sin validación genérica**: ❌ "¡Muy bien!", "¡Excelente!", "¡Lo lograste!". ✅ "Marcaste 4 de 5 correctas. La que faltó era Catamarca."
- **Sin descalificación en error**: ❌ "¡Mal!", "Te equivocaste". ✅ "La respuesta era La Plata. Vamos al siguiente."
- **Saludo y cierre breves y constantes**. Predictibilidad ante todo.

### 5. Estructura pedagógica
- **Anticipar el tema antes de pedir algo.** Bloques 1-3 introducen, después vienen preguntas.
- **Feedback inmediato** después de cada question. No "después te digo".
- **Feedback que enseña**: explica POR QUÉ era la respuesta correcta, no solo confirma.

### 6. Preguntas (questions)
- **multi_select**: entre 2 y 5 correctas. Nunca todas, nunca ninguna.
- **multiple_choice**: exactamente 3 opciones. Los distractores deben ser plausibles (mismo rango semántico), no obvios.
- **true_false**: la afirmación debe ser inequívoca. Sin ambigüedad ("a veces", "puede ser").
- **El texto de la pregunta debe quedar visible mientras Sofi responde** (no la hagas memorizarla).

### 7. Sin emoji en el texto
- El renderer ya pone pictogramas ARASAAC automáticamente para palabras content.
- No abuses de emojis en el texto del LLM — los pictogramas hacen ese trabajo.
- Excepciones: emoji UI puntual (🏠 Inicio, 📚 Recursos, 💬 Conversar) están OK.

### 8. Locale y geografía
- **Locale es-AR** en TODO. Fechas DD/MM/AAAA, decimales con coma.
- Geografía argentina: usar nombres oficiales (Provincia de Córdoba, no "Cordoba"; Río de la Plata, no "Rio de la Plata").
- Acentos correctos siempre. "matemática", "geográfico", "límite".

## Cómo validar (checklist)

Cuando revisás un bloque de contenido nuevo:

- [ ] ¿Cada oración tiene ≤12 palabras y 1 sola idea?
- [ ] ¿Sin metáforas no explicadas?
- [ ] ¿Sin presión temporal ni validación genérica?
- [ ] ¿Vocabulario apropiado para una chica de 10-12 argentina?
- [ ] ¿El feedback (si aplica) explica POR QUÉ, no solo si está bien o mal?
- [ ] ¿Tono respetuoso, sin infantilización?
- [ ] ¿Los conceptos clave tienen pictograma ARASAAC mapeado? (ver `arasaac-coverage`)
- [ ] ¿El locale es es-AR?

## Qué hacer si encontrás una violación

- **Generación nueva**: rechazar, pedir reescritura con la regla violada explícita.
- **Contenido ya en DB**: abrir issue con bloque + regla violada + redacción alternativa propuesta. NO editar sin review.
- **Patrón recurrente del LLM**: proponer modificación del system prompt en `src/server/services/real-tutor.ts` o `real-chat.ts`.

## Lo que NO entra acá

- **Reglas de pictogramas**: están en `arasaac-coverage`.
- **Reglas de estructura de sesión** (cuántos bloques de cada tipo, orden): en `topic-block-flow`.
- **Estética visual** (colores, layout, animaciones): no es contenido, no es alcance de este skill.
