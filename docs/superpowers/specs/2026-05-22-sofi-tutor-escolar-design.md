# Tutor escolar para Sofi — diseño

**Fecha:** 2026-05-22
**Estado:** diseño aprobado, pendiente de plan de implementación
**Reemplaza:** rumbo anterior del proyecto (juegos de estimulación cognitiva en "La granja de Sofi"). El código previo queda en el repo sin uso activo.

## 1. Contexto y motivación

Sofi (10-12 años) necesita asistencia en sus materias del colegio. No es autónoma en lo escolar. Su contexto clínico — autismo más un perfil de neurodesarrollo descripto por su neurólogo (mayo 2026, RM: adelgazamiento del tercio posterior del cuerpo calloso + leve disminución cortical en frontal posterior y parietal anterior, con correlato clínico al desarrollo) — condiciona cómo debe presentarse el contenido. El neurólogo lo traduce como "faltas de integraciones sensoriomotrices interhemisféricas y dentro del mismo hemisferio".

Esto no es un detalle: significa que apilar canales (texto + imagen + audio + interacción simultánea) sobrecarga el sistema. Que asumir memoria de trabajo y planificación autónomas falla. Que el lenguaje figurado y la ironía no funcionan.

El producto que se diseña abajo asume todo esto como restricción de primer orden, no como nicho.

**Mediador permanente:** Papá (Facundo) carga el plan, edita el perfil de aprendizaje, ve sesiones y patrones. Acompañantes profesionales (AT — acompañante terapéutica, DAI — docente de apoyo a la inclusión) pueden estar presentes durante las sesiones con vista propia en tiempo real. Terapeutas (psicopedagoga, fonoaudióloga, TO) tienen vista read-only asíncrona y pueden sugerir cambios al perfil.

## 2. Decisiones de producto

- **Single-tenant.** App de Sofi. Si se decide soportar otros chicos, es rediseño consciente, no preparación anticipada.
- **Materia inicial del MVP:** Ciencias Sociales.
- **No es la sesión del día auto-armada:** cada sesión se inicia eligiendo materia y tema desde un selector. Eligen Sofi + AT juntas (o Sofi sola si no hay AT) entre los temas marcados como `available` o `featured` por Papá.
- **Tutor por materia** con personalidad y perfil de aprendizaje propios.
- **Mecánica anti-sobrecarga:**
  - Multi-formato alternado, no apilado. Un canal por bloque.
  - **Dial de integración 0-3** por materia y por tema. Nivel 0 = canales totalmente separados; nivel 3 = problemas multi-formato simultáneos (entrenamiento de integración como objetivo secundario).
  - **Modo "día difícil"** como ciudadano de primera clase. Activable manual (Papá, AT, o Sofi misma) o automático (errores repetidos). Baja el dial a 0 y recorta a 1 microtarea de repaso.
- **Avisos para Papá:** solo in-app, sin notificaciones externas (email/WhatsApp/push). Decisión simplificadora del MVP.
- **Web responsive.** Sin instalación. Accesible desde laptop personal de Sofi y desde dispositivos del colegio.
- **Sin pago de inferencia LLM:** Groq free tier (Llama 3.3 70B).
- **Hosting:** Railway. Deploy único.

## 3. Arquitectura técnica

**Stack:**
- Backend: Node + TypeScript + Fastify.
- DB: Postgres en Railway (plugin oficial).
- LLM: Groq SDK (Llama 3.3 70B default; fallback a 8B en rate limit; fallback final a plantillas estáticas).
- Frontend: HTML + JS vanilla con componentes mínimos (web components o JS modular). CSS plano o Tailwind precompilado. Sin framework reactivo.
- Email: Resend (free tier 100/día) para magic links.
- Streaming: SSE (Server-Sent Events) para tokens del LLM hacia Sofi y para co-pilot live hacia AT/DAI.
- Auth: magic link sin password para adultos; token-URL sin login para Sofi.

**Deploy:** un solo proceso Node, sirviendo API JSON + assets estáticos. Postgres como servicio aparte en Railway. Sin frontend separado en Vercel.

**Costo estimado:** Railway ~$5-10/mes (Hobby tier + Postgres). Inferencia $0. Email $0 hasta 100/día.

## 4. Modelo de datos (Postgres)

### Personas

```
users
├─ id (uuid)
├─ email
├─ name
├─ role         ('parent' | 'at' | 'dai' | 'therapist')
├─ created_at
└─ revoked_at   (nullable)
```

- Solo UN usuario con `role='parent'` (Papá).
- Soft-delete con `revoked_at`.

### Acceso de Sofi

```
sofi_tokens
├─ id (uuid)
├─ token         (random, en URL)
├─ device_name   ('Laptop personal', 'Notebook cole')
├─ created_at
└─ revoked_at
```

### Plan y contenido

```
subjects
├─ id
├─ name          ('Ciencias Sociales')
└─ active        (boolean)

blocks
├─ id
├─ subject_id    (fk)
├─ title         ('Geografía argentina')
└─ order_index

topics
├─ id
├─ block_id      (fk)
├─ title         ('Provincias y regiones')
├─ description   (texto largo, cargado por Papá del cuaderno/planificación)
├─ key_concepts  (jsonb: lista corta)
├─ materials     (jsonb: URLs e imágenes pegadas como referencia)
├─ exam_date     (nullable)
├─ status        ('upcoming' | 'available' | 'featured' | 'done' | 'mastered')
├─ integration_level_override  (0-3 o null)
└─ order_index
```

- `status='upcoming'` no aparece en el selector de Sofi/AT.
- `status='available'` aparece como elegible.
- `status='featured'` aparece destacado arriba del selector.
- `status='done'` aparece marcado como "ya visto", repasable.
- `status='mastered'` solo vía repaso explícito.
- Constraint: 0 o 1 topic con `status='featured'` por materia a la vez.

### Perfil de aprendizaje

```
learning_profiles
├─ id
├─ subject_id    (fk — perfil por materia)
├─ works_for     (texto)
├─ avoid         (texto)
├─ notes         (texto)
├─ updated_at
└─ updated_by    (fk users)
```

Sin versionado (decisión deliberada para MVP). El contenido de esta tabla se inyecta en la Capa 3 del system prompt del tutor en cada llamada.

### Sesiones y diálogo

```
sessions
├─ id (uuid)
├─ subject_id
├─ topic_id
├─ started_at
├─ ended_at
├─ status            ('active' | 'finished' | 'abandoned')
├─ difficult_mode    (boolean)
├─ integration_level (snapshot 0-3 al iniciar)
├─ steps_planned     (default 3)
├─ steps_completed
└─ metadata          (jsonb — incluye session_plan generado al inicio)

session_acompanantes
├─ session_id
├─ user_id
└─ joined_at

messages
├─ id
├─ session_id
├─ step_index
├─ block_kind   ('explanation' | 'visual' | 'question' | 'feedback')
├─ role         ('tutor' | 'sofi')
├─ content      (texto o JSON estructurado del visual)
├─ created_at
└─ metadata     (jsonb: latencia LLM, errores, etc.)
```

### Notas, acciones, sugerencias

```
notes
├─ id
├─ session_id        (nullable — notas libres no tienen sesión)
├─ author_user_id
├─ content
├─ created_at
└─ visible_to        ('parent' | 'all')  -- default 'all' incluye terapeutas

session_actions
├─ id
├─ session_id
├─ author_user_id    (null = sistema)
├─ kind              ('toggle_difficult' | 'skip_step' | 'pause' | 'resume')
├─ created_at
└─ payload           (jsonb)

suggestions
├─ id
├─ subject_id        (a qué materia aplica)
├─ source            ('system' | 'therapist')
├─ source_user_id    (null si system)
├─ proposed_text
├─ context           (id de sesión o descripción del patrón)
├─ status            ('pending' | 'accepted' | 'edited' | 'discarded')
├─ resolved_text     (lo que quedó si fue accepted/edited)
├─ created_at
└─ resolved_at
```

### Auth

```
magic_links
├─ id
├─ user_id
├─ token             (uuid random)
├─ expires_at        (default now()+15m)
└─ used_at           (nullable)
```

### Otras decisiones de datos

- UUIDs en lugar de auto-increment.
- `jsonb` para campos flexibles (key_concepts, materials, payload).
- Soft-delete (`revoked_at`) para users y tokens.
- Sesiones tienen retención eterna por defecto.
- Un solo `learning_profile` por materia (no global).

## 5. Sistema del tutor LLM

### System prompt en capas

Cada llamada al LLM compone el system prompt en 5 capas, de general a específico:

1. **Identidad del tutor:** nombre, materia, tono base.
2. **Reglas duras (no negociables):** lenguaje literal, frases máx 15 palabras, sin metáforas no explicadas, sin "muy bien" genérico, validación específica, sin sarcasmo, sin ironía.
3. **Perfil de aprendizaje de Sofi:** contenido literal de `learning_profiles` para esta materia.
4. **Estado actual:** materia, tema actual, descripción del tema, conceptos clave, dial de integración (0-3), modo día difícil (on/off).
5. **Contrato de salida:** JSON estructurado con `block_kind` y schema por tipo.

Las capas 1, 2 y 5 son estáticas y versionadas en el repo. Las 3 y 4 se inyectan por request.

### Loop de sesión (híbrido: plan al inicio + bloque a bloque)

**Paso 0 — al iniciar la sesión** (1 llamada al LLM):

Pide al modelo armar el plan de la sesión. Respuesta:

```json
{
  "session_plan": [
    { "step": 1, "objective": "ubicar la propia provincia en el mapa" },
    { "step": 2, "objective": "diferenciar 3 provincias vecinas" },
    { "step": 3, "objective": "asociar provincias con sus capitales" }
  ]
}
```

Se guarda en `sessions.metadata`. La AT lo ve también desde su co-pilot.

**Paso 1..N — en cada bloque** (1 llamada por bloque):

Backend pide al modelo el siguiente bloque, pasando: step actual, historial de bloques previos, última respuesta de Sofi. Respuesta:

```json
{
  "block_kind": "explanation" | "visual" | "question" | "feedback",
  "content": ...
}
```

Schemas por kind:

- **explanation:** `{ "text": "..." }`
- **visual:** `{ "visual_kind": "map_argentina", "highlight": ["Salta"], "caption": "..." }`
- **question:** `{ "kind": "multiple_choice" | "free_input", "text": "...", "options": [...], "correct_index": 0 }`
- **feedback:** `{ "text": "...", "tone": "positive" | "redirect" }`

### Generación de visuales: SVG templates, no IA generativa

Set inicial de `visual_kind`:
- `map_argentina(highlight: string[])`
- `timeline(events: [{year, label}])`
- `region_grouping(groups: [{name, items: []}])`
- `comparison_table(rows, cols)`
- `arrow_diagram(nodes, edges)`

El LLM elige el `visual_kind` y los parámetros; el frontend renderiza con templates pre-aprobados visualmente.

Post-MVP se puede sumar `visual_kind: "generated"` con difusión sin tocar el resto.

### Streaming

- SSE del backend al frontend de Sofi para tokens del LLM.
- Visuales no se streamean (esperan JSON completo).
- Si tarda más de 3s sin token: se muestra "pensando..." explícito.

### Manejo de errores del LLM

- Rate limit / timeout / modelo caído: el backend devuelve evento especial al frontend.
- Sofi ve: "Esperá un momentito..." + spinner discreto.
- Después de 10s sin recuperarse: fallback a Llama 3.1 8B.
- Si también falla: fallback a plantilla estática pre-cargada.
- Papá recibe el evento en el admin (Capa B/C de avisos).

### Validación de contenido del LLM

Antes de mandar al frontend, el backend valida:
- Longitud máxima por bloque.
- Filtros de lenguaje violento o palabras tabú en español.
- Schema válido por `block_kind`.

Si falla: reintento una vez. Si vuelve a fallar: plantilla estática + evento al admin.

### Post-procesamiento de cierre de sesión

Cuando una sesión cambia a `status='finished'` o `'abandoned'`, una llamada asíncrona al LLM genera:

1. Resumen específico de 2-3 oraciones (para Sofi y para Papá).
2. Análisis de patrones en la sesión.
3. 0-3 sugerencias para el perfil, con justificación.

Las sugerencias se guardan con `status='pending'` esperando OK de Papá.

### Rate limits estimados

Con ~2-3 sesiones diarias × ~15 llamadas por sesión = 30-45 llamadas/día. Holgadamente dentro de Groq free tier.

## 6. Flujos por rol

### 6.1 Sofi (sesión)

**Entrada:** abre `granja.app/s/<token>` desde un dispositivo autorizado. Sin login.

**Pantalla de selección de tema:**

Si hay AT presente y conectada, eligen juntas. Si no, Sofi elige sola entre los temas `available` y `featured`. Ve:
- Lista de temas elegibles agrupados por materia.
- Tema `featured` destacado arriba con texto "seguimos con esto".
- Temas `done` marcados como "ya visto", visibles para repaso.
- Si modo día difícil está activo: solo aparecen `done` y `mastered`.

**Estructura de una microtarea (componente repetido):**

Cada paso se compone de 2-4 bloques encadenados (explicación → visual → pregunta → feedback). Cada bloque ocupa una pantalla completa. Botón "Listo" siempre en el mismo lugar como único mecanismo de avance.

Rastro fijo arriba: `Materia · Tema · Paso N de M · Próximo: <qué>`.

**Errores:** sin "rojo" agresivo. Tutor responde con texto breve ("Casi. Te muestro otra forma") y abre un bloque alternativo, no repite el mismo. Después de 2 errores en el mismo paso, sistema notifica a Papá y propone a Sofi pasar al siguiente.

**Cierre:** pantalla de resumen específico de lo que hizo bien. Sin métricas, sin scores. Botón "Cerrar".

### 6.2 Papá (admin)

Single-page con 5 zonas accesibles por tabs:

**Home:** estado resumido. Sesiones de la semana. Sugerencias pendientes. Dial actual. Notas nuevas. Vacío si no hay nada pendiente.

**Sesiones:** timeline cronológico. Cada sesión expandible muestra transcripción, notas, métricas técnicas, acciones registradas, sugerencias generadas, botón "Exportar PDF".

**Plan:** editor jerárquico Materia → Bloque → Tema. Cada tema tiene editor con título, descripción, conceptos clave, materiales (URLs/imágenes), fecha de prueba, estado, dial override.

**Perfil:** editor por materia del `learning_profile`. Textareas para "lo que funciona", "lo que evitar", "notas sueltas". Lista de sugerencias pendientes (del sistema y de terapeutas) con [Aceptar] / [Editar] / [Descartar].

**Gente:** gestión de AT/DAI, terapeutas, tokens de Sofi. Invitar por email (magic link). Revocar acceso. Ver dispositivos activos por token.

**Acciones globales:** toggle "modo día difícil" global (vence al final del día). Toggle "pausar producto".

### 6.3 AT/DAI (co-pilot)

URL única `granja.app/copilot` después de entrar por magic link.

Cuando Sofi inicia sesión, la AT/DAI conectada ve en vivo:
- Estado actual: materia, tema, paso N de M, tiempo en sesión, tiempo sin respuesta.
- Lo que Sofi está viendo ahora, en proporción reducida.
- Intentos y respuestas previas en este paso.
- Sugerencias contextuales del sistema ("si no responde en 30s, sugiero pausa").

Acciones disponibles:
- Activar modo día difícil (vigente para esta sesión).
- Saltar este paso.
- Pausar/reanudar sesión.
- Agregar nota (campo persistente).

Las acciones son **opacas para Sofi**: el cambio se manifiesta como decisión del tutor, no como intervención visible de la AT.

**Sin AT presente:** Sofi puede usar normal. AT puede entrar después y rellenar notas retroactivas sobre esa sesión.

**Multi-dispositivo por AT:** limitado a uno por sesión.

### 6.4 Terapeuta

Tres tabs:

**Sesiones:** vista read-only de transcripción, notas, acciones, métricas. Botón "Comentar esta sesión" (su nota se guarda y la ve Papá).

**Perfil:** vista read-only de `learning_profiles`. Botón "Sugerir agregar al perfil" — entra como sugerencia pendiente en el admin de Papá.

**Notas:** espacio libre para notas no atadas a sesión. Aparecen como aviso Capa C en el admin.

**Exportar PDF** por sesión o rango de fechas.

**No ve:** configuración, gestión de usuarios, tokens, sugerencias pendientes de Papá, sugerencias del sistema crudas.

## 7. Autenticación

### Adultos (Papá, AT, DAI, terapeutas)

Magic link sin password:
1. Ingreso de email en `/login`.
2. Backend crea fila en `magic_links` con TTL 15 min.
3. Resend manda email con URL `granja.app/auth/<token>`.
4. Click → backend valida → cookie de sesión HttpOnly Secure SameSite=Lax, duración 30 días.

Logout invalida la cookie. Papá puede revocar sesiones de invitados desde "Gente".

### Sofi

Token-URL sin login. Papá genera el token desde admin → comparte URL `granja.app/s/<token>` → Sofi la abre → cookie de 90 días.

Misma URL en múltiples dispositivos = todos quedan autorizados bajo el mismo token. Papá puede:
- Regenerar token (invalida todos).
- Revocar dispositivo específico.

### Roles y permisos

| Recurso | Papá | AT/DAI | Terapeuta | Sofi |
|---------|------|--------|-----------|------|
| Ver sesiones | todas | solo donde acompañó | todas (read) | la suya activa |
| Editar plan | sí | no | no | no |
| Editar perfil | sí | no | sugerir | no |
| Acciones intra-sesión | sí (remoto) | sí (live) | no | no |
| Notas | leer todas | crear/editar suyas | crear/editar suyas | no ve |
| Gestionar usuarios | sí | no | no | no |
| Token de Sofi | sí | no | no | usa |

Enforcement en el backend, no en el frontend. Cada request valida rol + recurso.

### Recovery de Papá

- Backup email configurable en settings.
- Recovery code generado al primer setup, guardado aparte.

## 8. Avisos al admin (Papá)

Solo in-app, sin canales externos. Tres capas:

- **Capa A (live, intra-sesión):** destinatario natural AT/DAI. Cubierto en el co-pilot.
- **Capa B (post-sesión):** resumen del sistema + nota de AT + sugerencias para el perfil. Aparece como item pendiente en Home.
- **Capa C (patrón emergente):** sistema detecta patrones a través de N sesiones ("Sofi se trabó en provincias 3 sesiones seguidas. ¿Querés cambiar el enfoque?"). Aparece como item pendiente.
- **Capa D (digest semanal):** dirigido a terapeutas, no a Papá. Resumen estructurado, entregado por email (es decir, los terapeutas sí reciben un canal externo; la restricción de "solo in-app" aplica solamente a Papá).

Papá no recibe notificaciones externas: entra al admin cuando quiere y ve el estado.

## 9. Errores y casos borde

- **Sofi pierde internet:** frontend muestra "Esperá, ya volvemos" + retry cada 5s. Estado en backend, no se pierde. Si no vuelve en 10 min: sesión queda `abandoned`.
- **Groq cae:** cubierto en sección 5 (fallback a 8B, después a plantilla estática).
- **AT se desconecta:** sesión de Sofi sigue. Puede rellenar notas retroactivas.
- **Papá edita plan durante sesión activa:** cambios no afectan sesión en curso (snapshot al iniciar). Se aplican desde la próxima.
- **Modo día difícil activado mid-sesión:** aplica desde el próximo bloque, no abrupto.
- **Multi-dispositivo Sofi simultáneo:** solo una sesión activa. Segundo dispositivo pregunta "¿traer la sesión acá?", primero se cierra suave.
- **Sesión idle:** >15 min sin actividad = "inactiva". >60 min = `abandoned` automático. Umbrales configurables.
- **LLM responde inapropiado:** validación en backend, reintento, fallback a plantilla, evento al admin.
- **Papá pierde acceso:** backup email + recovery code.

## 10. Roadmap MVP

### Dentro del MVP

**Backend:**
- Node + TypeScript + Fastify.
- Magic link auth para adultos. Token URL para Sofi.
- CRUD del plan, perfil, sesiones, mensajes, notas, sugerencias.
- Integración Groq con streaming SSE.
- Post-procesamiento de cierre de sesión.
- Validación de contenido LLM.
- Roles enforced en cada endpoint.

**Frontend Sofi:**
- Selector de tema al iniciar.
- Componente bloque único para todos los `block_kind`.
- 5 visual templates SVG iniciales.
- Botón "Listo" como único mecanismo de avance.
- Cierre con resumen específico.

**Frontend admin (Papá):**
- 5 tabs (Home / Sesiones / Plan / Perfil / Gente).
- Editor de plan jerárquico.
- Editor de perfil con sugerencias pendientes.
- Gestión de invitaciones y tokens.

**Frontend AT/DAI (co-pilot):**
- Vista live de sesión activa.
- 4 acciones (modo difícil, saltar, pausar, nota).
- Notas retroactivas.

**Frontend terapeuta:**
- Sesiones read-only.
- Sugerencias al perfil.
- Notas libres.
- Exportar PDF.

**Operaciones:**
- Resend para email.
- Logs estructurados al stdout.
- Healthcheck.

### Fuera del MVP (ordenado por valor estimado)

1. IA generativa de contenido para el plan (ejercicios sugeridos, búsqueda web de mapas/imágenes).
2. Más materias (Naturales, Lengua, Matemática).
3. IA generativa visual (visual_kind: "generated").
4. Voz (Sofi escucha al tutor, dicta respuestas).
5. Métricas longitudinales con gráficos.
6. Notificaciones externas (WhatsApp, push).
7. PWA y mobile app.
8. Multi-usuario (otras chicas/chicos).

### Estimaciones (orientativas)

- Setup + auth + infra: 3-4 días.
- Backend completo: 5-7 días.
- Frontend Sofi básico: 4-5 días.
- Frontend admin: 5-7 días.
- Frontend AT/DAI: 3-4 días.
- Frontend terapeuta: 2-3 días.
- Integración Groq + visuales: 3-4 días.
- Testing end-to-end + ajustes: 5-7 días.

**Total estimado a algo usable:** 4-6 semanas full focus.

## 11. Testing

- **Backend:** tests de integración por endpoint con DB real (Postgres en contenedor para tests).
- **Validación de schema LLM:** tests deterministas usando respuestas grabadas + tests live periódicos contra Groq con muestras.
- **Roles:** tests por endpoint × rol verificando que el enforcement funcione.
- **Frontend Sofi:** test manual obligatorio antes de cada release. Idealmente con Sofi misma, con Papá observando.
- **Co-pilot:** test con dos navegadores simultáneos (sesión Sofi + sesión AT).
- **Latencia:** monitoreo del p95 de tiempo de respuesta de Groq. Alarma si supera 5s consistente.

## 12. Decisiones explícitamente NO tomadas

Se difieren al momento de implementación o a futuras iteraciones:

- Nombre de marca / dominio final.
- Diseño visual concreto (paleta, tipografía) — debe respetar criterios sensoriales: tonos suaves, sin estímulos bruscos.
- Política de retención de transcripciones más allá del default eterno.
- Soporte a múltiples chicos/perfiles (explícitamente diferido).
- Notificaciones externas para Papá (explícitamente diferidas).

## 13. Contexto persistido en memoria

El contexto operativo de Sofi (perfil de usuaria, principios de diseño derivados, lo que NO se asume) está persistido en la memoria del proyecto del entorno local de Claude (archivo `project_sofi_context.md` en la carpeta de memoria del proyecto). Toda implementación futura debe respetarlo. No se persisten ni se incluyen en este repo imágenes médicas ni texto clínico crudo: solo principios operativos derivados.
