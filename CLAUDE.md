# Sofi Tutor Escolar

Web app de **tutoría escolar adaptada** para Sofi (10-12 años, autista, con perfil neurodesarrollo específico — adelgazamiento del tercio posterior del cuerpo calloso + leve disminución cortical frontal-parietal). Ayuda con materias del colegio (Sociales, Lengua, Matemática, Naturales). **No reemplaza terapia profesional.**

> **Antecedente**: hubo un concepto previo "La granja de Sofi" como app de **juegos cognitivos offline para una Lenovo G450**, descartado en mayo 2026. La spec original (`la-granja-de-sofi-spec.md`) y el documento de hardware (`hardware-target.md`) son **historia**, no contexto vigente. Los archivos quedan en el repo por referencia, pero **NO** describen el sistema actual.

## Modelo mental

- **Single-tenant**: solo Sofi. Papá (Facundo) la guía. La AT/DAI suele estar presente.
- **Web responsive**, accedida desde celu (iOS Chrome principalmente) o laptop. **No** funciona offline, **no** corre en el G450.
- **No es autónoma todavía**: necesita Papá o AT para arrancar la sesión.
- **El tutor LLM nunca reemplaza al humano**: complementa el material del colegio.

## Stack actual

| Capa | Tecnología |
|---|---|
| Runtime | Node 20 + TypeScript + Fastify |
| DB | Postgres (Railway managed) + node-pg-migrate (migrations `.cjs`) |
| Frontend | HTML + vanilla JS (ES modules) + CSS plano. **Sin** bundler, **sin** framework. |
| Auth Papá | Magic link a mail (mailer removido — se lee del DB) o password 1234 desde botón Admin |
| Auth Sofi | Token URL `/s/<slug-de-4-palabras>` → cookie `sofi_device` 90 días |
| LLM | **Groq** (Llama 3.3 70B) — generación de contenido de topics + chat conversacional |
| TTS | **Web Speech API** del browser (gratis, calidad iOS/macOS aceptable) |
| Pictogramas | **ARASAAC** vía URL directa (`static.arasaac.org/pictograms/<id>/<id>_300.png`) |
| Mapas | **Wikimedia Commons** vía `Special:FilePath` (IGN argentino: Argentina político + provincia Córdoba) |
| Deploy | **Railway** (Nixpacks). PR review obligatorio antes de mergear (hook). |
| Tests | Vitest |

## Cosas que NO usamos

- React/Vue/Svelte/Angular. **Vanilla JS y nada más.**
- Tailwind. CSS plano con tokens.
- Bundlers (Vite/webpack/esbuild). Importmaps / ES modules nativos en el browser.
- ElevenLabs, AWS Polly, ningún TTS de pago (lo evaluamos, lo descartamos por ahora).
- Resend ni ningún servicio de email (los magic links se leen del DB).
- Electron / Tauri.

## Estructura

```
la-granja/
├── src/server/                  # backend
│   ├── index.ts                 # Fastify bootstrap
│   ├── config.ts                # env vars
│   ├── db.ts                    # pg pool
│   ├── auth/
│   │   ├── cookies.ts           # set/read cookies de Papá y Sofi
│   │   ├── middleware.ts        # requireParent, requireSofi
│   │   └── magic-link.ts        # request + verify (sin email)
│   ├── routes/
│   │   ├── auth.routes.ts       # /api/auth/*
│   │   ├── admin.routes.ts      # /api/admin/* (parent-only)
│   │   └── sofi.routes.ts       # /s/:token, /api/sofi/*
│   ├── services/
│   │   ├── subjects.ts          # lista de materias + topics
│   │   ├── sessions.ts          # startSession / nextBlock / finishSession
│   │   ├── stub-tutor.ts        # contenido hand-crafted de topics (Phase 1)
│   │   ├── real-tutor.ts        # generación LLM de contenido (Plan 2)
│   │   ├── real-chat.ts         # chat conversacional con LLM
│   │   └── phrase-tokenizer.ts  # texto → PhraseUnit[] con pictogramas ARASAAC
│   ├── llm/
│   │   └── groq.ts              # cliente Groq + chatJson()
│   └── lib/
│       └── ids.ts               # sofiToken (4 palabras) + shortToken
├── public/                      # frontend (servido por @fastify/static)
│   ├── sofi.html                # home: grid de materias + CTA chat + admin link
│   ├── materia.html             # lista de topics de una materia
│   ├── session.html             # render de bloques de una sesión
│   ├── chat.html                # conversación libre con tutor
│   ├── recursos.html            # mapas y otros recursos (lightbox zoom)
│   ├── admin.html               # panel de Papá (login password 1234)
│   ├── login.html               # magic link (alternativa al password)
│   ├── js/
│   │   ├── api.js               # fetch wrapper, NoAccessError
│   │   ├── sofi.js              # render materias grid
│   │   ├── materia.js           # render topics list
│   │   ├── session.js           # render bloques + navegación + question state
│   │   ├── chat.js              # conversación + history en sessionStorage
│   │   ├── tts.js               # Web Speech + highlight de palabras
│   │   └── lightbox.js          # zoom de imágenes
│   └── styles/base.css
├── migrations/                  # node-pg-migrate (.cjs porque package.json es type:module)
├── tests/                       # Vitest
├── docs/                        # specs y planes
└── .claude/
    ├── agents/                  # subagentes especializados (ver más abajo)
    └── skills/                  # skills domain-specific (ver más abajo)
```

## Modelo de datos (Postgres)

```
users                  # single tenant: solo Papá
magic_links            # magic links generados (los lee Papá)
sofi_tokens            # tokens de acceso de Sofi (cookies)
subjects               # Ciencias Sociales, Lengua, Matemática, Ciencias Naturales
blocks                 # agrupación intermedia (1 block por subject por ahora)
topics                 # temas dentro de cada materia. Tiene generated_blocks JSONB
sessions               # cada vez que Sofi arranca un topic. Snapshotea blocks en metadata.
messages               # log de cada bloque que se le mostró (auditoría)
```

## Tipos clave (JSDoc-like, pero TypeScript real en `services/stub-tutor.ts` y `phrase-tokenizer.ts`)

```typescript
type PhraseUnit = { word: string; pic?: number } | { break: true };

type QuestionContent =
  | { kind: "multiple_choice"; text; options; correct_index }
  | { kind: "multi_select"; text; options; correct_indices }
  | { kind: "true_false"; text; correct };

type StubBlock =
  | { block_kind: "explanation"; content: { text; phrase?: PhraseUnit[] } }
  | { block_kind: "visual"; content: VisualContent }
  | { block_kind: "question"; content: QuestionContent }
  | { block_kind: "feedback"; content: { text; tone; phrase?: PhraseUnit[] } };
```

El frontend renderiza cada `PhraseUnit[]` como **tabla SAAC** (Sistema Aumentativo y Alternativo de Comunicación): pictograma arriba, palabra en MAYÚSCULAS abajo, una columna por palabra, máximo 6 columnas por línea (auto-chunk).

## Flujo de contenido

**Hand-crafted (Phase 1)**: topics como `PAISES_LIMITROFES`, `PROVINCIAS_ANDES`, etc. viven en `stub-tutor.ts`. Usados mientras se valida el formato y la pedagogía.

**LLM (Plan 2 — activo)**: desde `/admin.html`, Papá clickea "Generar con LLM" en un topic → backend llama a Groq con system prompt en capas → recibe JSON con bloques → tokeniza cada `text` para asignar pictogramas → guarda en `topics.generated_blocks JSONB`. Cuando Sofi entra al topic, prefiere `generated_blocks` sobre el stub.

**Chat conversacional**: `/chat.html` → `POST /api/sofi/chat { history, message }` → Groq responde corto → tokenizado → renderizado como SAAC.

## Reglas duras del contenido (vinculantes para todo lo que se le muestre a Sofi)

Definidas formalmente en `.claude/skills/sofi-content-rules/`. Resumen:

1. **Lenguaje literal**, sin metáforas no explicadas, sin sarcasmo, sin ironía.
2. **Máximo 12 palabras por oración**. Una sola idea por oración.
3. **Sin presión temporal**: no decir "rápido", "vamos ya", "apurate".
4. **Validación específica**: "marcaste 4 de 5 correctas" no "muy bien".
5. **Sin "rojo agresivo"** en errores: decir lo correcto sin descalificar.
6. **Sin infantilizar**: Sofi tiene 10-12 años y lee bien. No "nena", no diminutivos por defecto.
7. **Saludos y cierres breves y constantes** (predictibilidad).
8. **Locale es-AR** en toda la UI.
9. **Pictograma ARASAAC** en cada palabra de contenido posible (nombre, verbo, lugar). Conectores sin pic.

## Subagentes y skills

### Agentes (`.claude/agents/`)

Para tareas que requieren contexto específico:

- `fono-therapist.md` — valida contenido desde fonoaudiología (vocabulario, pronunciación, estructura)
- `psicoped-therapist.md` — valida desde psicopedagogía (carga cognitiva, atención, memoria de trabajo)
- `psicomot-therapist.md` — valida desde psicomotricidad (cuando aplica — ej. actividades futuras de drag/drop)
- `to-therapist.md` — valida desde terapia ocupacional (interacción, motor fino, percepción)

### Skills (`.claude/skills/`)

Domain-specific, invocables desde cualquier agente:

- `sofi-content-rules` — encapsula las reglas duras de arriba
- `arasaac-coverage` — dado texto nuevo, encuentra palabras sin pictograma, propone IDs vía API
- `topic-block-flow` — valida estructura de una secuencia de bloques (intro + question + feedback…)
- `llm-prompt-tuning` — metodología A/B para iterar sobre el system prompt

### Skills genéricas (a nivel usuario, ya instaladas via plugin superpowers)

`brainstorming`, `dispatching-parallel-agents`, `executing-plans`, `systematic-debugging`, `test-driven-development`, `writing-plans`, `using-git-worktrees`, `requesting-code-review`, etc.

## Convenciones

- **Schema versionado** vía node-pg-migrate. Migrations `.cjs` (porque `package.json` es `type:module`).
- **IDs en kebab-case** para slugs/tokens. UUIDs para entidades.
- **Cookies signed** (`@fastify/cookie` con `COOKIE_SECRET`).
- **POST JSON bodies opcionales**: ver `api.js` y `src/server/index.ts` (custom parser acepta body vacío).
- **Sin dependencias de red en runtime para el contenido core**: el LLM cachea en `topics.generated_blocks`, pictogramas y mapas son URLs estables.
- **PR review obligatorio antes de mergear a main** (hook). No hacer `railway up` desde la rama de feature sin haber abierto y hecho review del PR.

## Limpieza de creds

Si alguna API key cae en el transcript (Groq, ElevenLabs, AWS, etc.), rotarla apenas se termine la prueba.

## Roadmap próximo (snapshot — ver issues de GitHub para detalle)

- [#2](https://github.com/facuO/la-granja/issues/2) Rompecabezas de provincias drag-and-drop
- [#3](https://github.com/facuO/la-granja/issues/3) Memory match + cartografía progresiva + audio+map + trazar + exploración libre
- Pollito system (corral en home + huevos + eclosiones — discutido, no abierto como issue todavía)
- Content fill para Lengua / Matemática / Ciencias Naturales (vacías hoy)
- Speech input (Web Speech Recognition) para chat
