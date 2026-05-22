# Plan 1 — Foundation + Vertical Slice

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el esqueleto end-to-end deployable del tutor de Sofi: Papá puede registrarse con magic link, generar un token de acceso para Sofi, ella entra por la URL, ve un selector de tema con datos seed, inicia una sesión, atraviesa una serie de bloques stub ("explanation → visual → question → feedback"), llega al cierre y se cierra la sesión. Sin LLM real, sin admin UI completo, sin co-pilot, sin terapeuta. El objetivo es validar arquitectura + flujo end-to-end antes de meter complejidad.

**Architecture:** Node 20 + TypeScript + Fastify + Postgres en Railway. Frontend HTML + JS vanilla (ESM modules, sin bundler). Auth por magic link (Resend) para Papá y por token-URL para Sofi. Migraciones SQL planas con `node-pg-migrate`. Tests con `vitest`.

**Tech Stack:**
- Runtime: Node 20 LTS + TypeScript 5.4
- Backend: Fastify 4, `@fastify/cookie`, `@fastify/static`
- DB: Postgres 16, driver `pg`, migraciones `node-pg-migrate`
- Email: `resend` SDK
- Tests: `vitest` + `supertest` para HTTP
- Tooling: `tsx` para dev (sin build step en local), `tsc --noEmit` para type-checking
- Frontend: HTML + ES Modules nativos, sin bundler, sin framework
- Deploy: Railway (servicio Node + servicio Postgres)
- Branch base: `feat/sofi-tutor-design`

**Scope deliberadamente fuera de este plan (planes siguientes):**
- Plan 2 — Integración Groq + structured blocks reales + visuales SVG + fallbacks
- Plan 3 — Admin de Papá (5 tabs completas)
- Plan 4 — Co-pilot AT/DAI con SSE
- Plan 5 — Vista terapeuta + sugerencias loop + post-procesamiento

---

## Estructura de archivos final de este plan

```
la-granja/
├── package.json
├── tsconfig.json
├── .gitignore                       (actualizar)
├── .env.example
├── docker-compose.yml               (Postgres local)
├── railway.json                     (deploy config)
├── vitest.config.ts
├── migrations/
│   ├── 001_initial_schema.sql
│   └── 002_seed_dev_data.sql        (solo dev, no se corre en prod)
├── src/
│   └── server/
│       ├── index.ts                 (entrypoint Fastify)
│       ├── config.ts                (carga env vars)
│       ├── db.ts                    (pool de Postgres)
│       ├── auth/
│       │   ├── magic-link.ts        (request + verify)
│       │   ├── sofi-token.ts        (generación + validación)
│       │   ├── cookies.ts           (set/clear/read)
│       │   └── middleware.ts        (requireParent, requireSofi)
│       ├── email/
│       │   └── resend.ts            (cliente + dev fallback a console)
│       ├── routes/
│       │   ├── auth.routes.ts
│       │   ├── sofi.routes.ts       (token entry, subjects, sessions)
│       │   ├── admin.routes.ts      (solo generar token Sofi por ahora)
│       │   └── health.routes.ts
│       ├── services/
│       │   ├── stub-tutor.ts        (bloques hardcoded por topic)
│       │   ├── sessions.ts          (start/next/finish lógica)
│       │   └── subjects.ts          (query temas elegibles)
│       └── lib/
│           ├── ids.ts               (uuid + nanoid)
│           └── errors.ts            (clases de error)
├── public/
│   ├── login.html                   (form de magic link para Papá)
│   ├── sofi.html                    (welcome + topic selector)
│   ├── session.html                 (loop de bloques + cierre)
│   ├── styles/base.css              (reset + variables CSS)
│   └── js/
│       ├── api.js                   (fetch wrapper)
│       ├── login.js
│       ├── sofi.js
│       └── session.js
├── tests/
│   ├── helpers/
│   │   ├── db.ts                    (setup/teardown DB de test)
│   │   └── app.ts                   (fixture de Fastify para tests)
│   ├── auth.test.ts
│   ├── sofi-token.test.ts
│   ├── subjects.test.ts
│   ├── sessions.test.ts
│   └── e2e/
│       └── full-flow.test.ts
└── docs/
    └── DEPLOY.md                    (instrucciones Railway)
```

---

### Task 1: Inicialización del proyecto y server Fastify "hello"

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore` (actualizar el existente)
- Create: `.env.example`
- Create: `src/server/index.ts`
- Create: `src/server/routes/health.routes.ts`
- Create: `vitest.config.ts`
- Create: `tests/helpers/app.ts`
- Create: `tests/health.test.ts`

- [ ] **Step 1: Inicializar package.json e instalar dependencias**

```bash
cd /Users/facu/Desktop/Tromen/la-granja
npm init -y
npm install fastify @fastify/cookie @fastify/static pg dotenv pino-pretty resend nanoid
npm install -D typescript @types/node @types/pg tsx vitest supertest @types/supertest node-pg-migrate
```

Editar `package.json` para agregar:

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server/index.ts",
    "start": "tsx src/server/index.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "migrate:up": "node-pg-migrate -m migrations up",
    "migrate:down": "node-pg-migrate -m migrations down"
  }
}
```

- [ ] **Step 2: Crear tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": false,
    "allowImportingTsExtensions": false
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Actualizar .gitignore**

Agregar al final del `.gitignore` existente:

```
node_modules/
.env
.env.local
*.log
dist/
.vitest-cache/
```

- [ ] **Step 4: Crear .env.example**

```
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/sofi_tutor

# Auth
COOKIE_SECRET=change-me-to-a-long-random-string-32-chars-min
SESSION_COOKIE_NAME=sofi_session
SOFI_COOKIE_NAME=sofi_device
PARENT_COOKIE_MAX_DAYS=30
SOFI_COOKIE_MAX_DAYS=90

# Email (Resend)
RESEND_API_KEY=re_your_key_here
EMAIL_FROM=noreply@example.com
APP_BASE_URL=http://localhost:3000

# Single tenant: email autorizado para crear cuenta de Papá
PARENT_EMAIL=facuompre@gmail.com
```

- [ ] **Step 5: Crear src/server/routes/health.routes.ts**

```typescript
import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/healthz", async () => {
    return { status: "ok", time: new Date().toISOString() };
  });
};
```

- [ ] **Step 6: Crear src/server/index.ts**

```typescript
import Fastify from "fastify";
import { healthRoutes } from "./routes/health.routes.js";
import dotenv from "dotenv";

dotenv.config();

export async function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV === "development"
      ? { transport: { target: "pino-pretty" } }
      : true,
  });

  await app.register(healthRoutes);

  return app;
}

async function start() {
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 3000);
  try {
    await app.listen({ port, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Solo arrancar si este es el módulo principal (no en tests)
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
```

- [ ] **Step 7: Crear vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 10_000,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
```

- [ ] **Step 8: Crear tests/helpers/app.ts**

```typescript
import { buildApp } from "../../src/server/index.js";
import type { FastifyInstance } from "fastify";

export async function makeTestApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}
```

- [ ] **Step 9: Escribir tests/health.test.ts (test que falla)**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { makeTestApp } from "./helpers/app.js";
import type { FastifyInstance } from "fastify";

describe("GET /healthz", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await makeTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns status ok", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ok");
    expect(typeof body.time).toBe("string");
  });
});
```

- [ ] **Step 10: Correr el test y verificar que pasa**

```bash
npm test -- tests/health.test.ts
```

Expected: 1 passed.

- [ ] **Step 11: Verificar arranque manual**

```bash
npm run dev
```

En otra terminal: `curl http://localhost:3000/healthz` → debe devolver `{"status":"ok",...}`. Cortar el server con Ctrl+C.

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore .env.example src/ tests/ vitest.config.ts
git commit -m "feat(server): scaffold Fastify server with health endpoint"
```

---

### Task 2: Setup de Postgres local con docker-compose y conexión

**Files:**
- Create: `docker-compose.yml`
- Create: `src/server/config.ts`
- Create: `src/server/db.ts`
- Create: `tests/helpers/db.ts`
- Create: `tests/db.test.ts`

- [ ] **Step 1: Crear docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: sofi_tutor
    ports:
      - "5432:5432"
    volumes:
      - sofi_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  sofi_pgdata:
```

- [ ] **Step 2: Levantar Postgres**

```bash
docker compose up -d postgres
docker compose ps
```

Verificar que el estado sea "healthy" o "running (healthy)".

- [ ] **Step 3: Crear DB de tests**

```bash
docker compose exec postgres psql -U postgres -c "CREATE DATABASE sofi_tutor_test;"
```

- [ ] **Step 4: Crear src/server/config.ts**

```typescript
import dotenv from "dotenv";
dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: required("DATABASE_URL"),
  cookieSecret: required("COOKIE_SECRET"),
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "sofi_session",
  sofiCookieName: process.env.SOFI_COOKIE_NAME ?? "sofi_device",
  parentCookieMaxDays: Number(process.env.PARENT_COOKIE_MAX_DAYS ?? 30),
  sofiCookieMaxDays: Number(process.env.SOFI_COOKIE_MAX_DAYS ?? 90),
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "noreply@example.com",
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
  parentEmail: required("PARENT_EMAIL"),
};
```

- [ ] **Step 5: Crear src/server/db.ts**

```typescript
import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
});

export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number }> {
  const res = await pool.query(text, params);
  return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
}

export async function closePool(): Promise<void> {
  await pool.end();
}
```

- [ ] **Step 6: Crear .env local con DATABASE_URL apuntando a la DB de test cuando NODE_ENV=test**

Modificar `tests/helpers/db.ts`:

```typescript
import pg from "pg";

// Conexión específica para tests: misma URL pero base sofi_tutor_test
function testDatabaseUrl(): string {
  const base = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/sofi_tutor";
  return base.replace(/\/[^/]+$/, "/sofi_tutor_test");
}

const { Pool } = pg;

export const testPool = new Pool({
  connectionString: testDatabaseUrl(),
  max: 5,
});

export async function resetDb(): Promise<void> {
  // Drop all tables in public schema (idempotente)
  await testPool.query(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);
}

export async function closeTestPool(): Promise<void> {
  await testPool.end();
}
```

- [ ] **Step 7: Crear .env (no commitear) con las vars mínimas**

```bash
cp .env.example .env
```

Editar `.env` y poner valores reales:
- `COOKIE_SECRET=` (32+ chars random — generar con `openssl rand -hex 32`)
- `RESEND_API_KEY=` (vacío por ahora, se valida después)
- `PARENT_EMAIL=facuompre@gmail.com`

- [ ] **Step 8: Escribir tests/db.test.ts (test que falla)**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { testPool, closeTestPool } from "./helpers/db.js";

describe("Postgres connection", () => {
  afterAll(async () => {
    await closeTestPool();
  });

  it("can connect and run a basic query", async () => {
    const res = await testPool.query("SELECT 1 as n");
    expect(res.rows[0].n).toBe(1);
  });
});
```

- [ ] **Step 9: Correr el test**

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/sofi_tutor_test npm test -- tests/db.test.ts
```

Expected: 1 passed.

- [ ] **Step 10: Commit**

```bash
git add docker-compose.yml src/server/config.ts src/server/db.ts tests/helpers/db.ts tests/db.test.ts
git commit -m "feat(db): add Postgres setup with docker-compose and pool"
```

---

### Task 3: Migración inicial — schema completo del MVP

**Files:**
- Create: `migrations/001_initial_schema.sql`
- Create: `tests/migrations.test.ts`

- [ ] **Step 1: Crear migrations/001_initial_schema.sql**

```sql
-- Up Migration

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('parent', 'at', 'dai', 'therapist')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE TABLE magic_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX idx_magic_links_token ON magic_links(token) WHERE used_at IS NULL;

CREATE TABLE sofi_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  device_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_sofi_tokens_token ON sofi_tokens(token) WHERE revoked_at IS NULL;

CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0
);

CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  key_concepts JSONB NOT NULL DEFAULT '[]'::jsonb,
  materials JSONB NOT NULL DEFAULT '[]'::jsonb,
  exam_date DATE,
  status TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'available', 'featured', 'done', 'mastered')),
  integration_level_override INT CHECK (integration_level_override BETWEEN 0 AND 3),
  order_index INT NOT NULL DEFAULT 0
);

-- Solo un topic featured por materia
CREATE UNIQUE INDEX idx_topics_one_featured_per_subject
  ON topics(block_id)
  WHERE status = 'featured';

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  topic_id UUID NOT NULL REFERENCES topics(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'finished', 'abandoned')),
  difficult_mode BOOLEAN NOT NULL DEFAULT false,
  integration_level INT NOT NULL DEFAULT 0 CHECK (integration_level BETWEEN 0 AND 3),
  steps_planned INT NOT NULL DEFAULT 3,
  steps_completed INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_sessions_status_started ON sessions(status, started_at DESC);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  step_index INT NOT NULL,
  block_kind TEXT NOT NULL
    CHECK (block_kind IN ('explanation', 'visual', 'question', 'feedback')),
  role TEXT NOT NULL CHECK (role IN ('tutor', 'sofi')),
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_messages_session_step ON messages(session_id, step_index, created_at);

-- Down Migration

DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS topics CASCADE;
DROP TABLE IF EXISTS blocks CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS sofi_tokens CASCADE;
DROP TABLE IF EXISTS magic_links CASCADE;
DROP TABLE IF EXISTS users CASCADE;
```

Nota: `node-pg-migrate` por defecto usa archivos `.js`. Para usar `.sql` puro, alternativa simple: armamos un runner casero. Mejor: cambiar el formato a JS.

- [ ] **Step 2: Cambiar de SQL plano a node-pg-migrate JS**

Reemplazar el contenido de `migrations/001_initial_schema.sql` por un archivo JS. Renombrar:

```bash
mv migrations/001_initial_schema.sql migrations/1747900000000_initial-schema.js
```

(Usá un timestamp en ms, el orden importa. El número de arriba es a modo de ejemplo, generar uno real con `date +%s%3N`.)

Contenido de `migrations/1747900000000_initial-schema.js`:

```javascript
exports.up = (pgm) => {
  pgm.createExtension("pgcrypto", { ifNotExists: true });

  pgm.createTable("users", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    email: { type: "text", notNull: true, unique: true },
    name: { type: "text", notNull: true },
    role: { type: "text", notNull: true, check: "role IN ('parent', 'at', 'dai', 'therapist')" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    revoked_at: { type: "timestamptz" },
  });

  pgm.createTable("magic_links", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: { type: "uuid", notNull: true, references: '"users"', onDelete: "CASCADE" },
    token: { type: "text", notNull: true, unique: true },
    expires_at: { type: "timestamptz", notNull: true },
    used_at: { type: "timestamptz" },
  });
  pgm.createIndex("magic_links", "token", {
    name: "idx_magic_links_token",
    where: "used_at IS NULL",
  });

  pgm.createTable("sofi_tokens", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    token: { type: "text", notNull: true, unique: true },
    device_name: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    revoked_at: { type: "timestamptz" },
  });
  pgm.createIndex("sofi_tokens", "token", {
    name: "idx_sofi_tokens_token",
    where: "revoked_at IS NULL",
  });

  pgm.createTable("subjects", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    name: { type: "text", notNull: true },
    active: { type: "boolean", notNull: true, default: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createTable("blocks", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    subject_id: { type: "uuid", notNull: true, references: '"subjects"', onDelete: "CASCADE" },
    title: { type: "text", notNull: true },
    order_index: { type: "int", notNull: true, default: 0 },
  });

  pgm.createTable("topics", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    block_id: { type: "uuid", notNull: true, references: '"blocks"', onDelete: "CASCADE" },
    title: { type: "text", notNull: true },
    description: { type: "text", notNull: true, default: "" },
    key_concepts: { type: "jsonb", notNull: true, default: pgm.func("'[]'::jsonb") },
    materials: { type: "jsonb", notNull: true, default: pgm.func("'[]'::jsonb") },
    exam_date: { type: "date" },
    status: {
      type: "text",
      notNull: true,
      default: "upcoming",
      check: "status IN ('upcoming', 'available', 'featured', 'done', 'mastered')",
    },
    integration_level_override: {
      type: "int",
      check: "integration_level_override BETWEEN 0 AND 3",
    },
    order_index: { type: "int", notNull: true, default: 0 },
  });
  pgm.createIndex("topics", "block_id", {
    name: "idx_topics_one_featured_per_subject",
    unique: true,
    where: "status = 'featured'",
  });

  pgm.createTable("sessions", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    subject_id: { type: "uuid", notNull: true, references: '"subjects"' },
    topic_id: { type: "uuid", notNull: true, references: '"topics"' },
    started_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    ended_at: { type: "timestamptz" },
    status: {
      type: "text",
      notNull: true,
      default: "active",
      check: "status IN ('active', 'finished', 'abandoned')",
    },
    difficult_mode: { type: "boolean", notNull: true, default: false },
    integration_level: {
      type: "int",
      notNull: true,
      default: 0,
      check: "integration_level BETWEEN 0 AND 3",
    },
    steps_planned: { type: "int", notNull: true, default: 3 },
    steps_completed: { type: "int", notNull: true, default: 0 },
    metadata: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") },
  });
  pgm.createIndex("sessions", ["status", "started_at"], {
    name: "idx_sessions_status_started",
  });

  pgm.createTable("messages", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    session_id: { type: "uuid", notNull: true, references: '"sessions"', onDelete: "CASCADE" },
    step_index: { type: "int", notNull: true },
    block_kind: {
      type: "text",
      notNull: true,
      check: "block_kind IN ('explanation', 'visual', 'question', 'feedback')",
    },
    role: { type: "text", notNull: true, check: "role IN ('tutor', 'sofi')" },
    content: { type: "jsonb", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    metadata: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") },
  });
  pgm.createIndex("messages", ["session_id", "step_index", "created_at"], {
    name: "idx_messages_session_step",
  });
};

exports.down = (pgm) => {
  pgm.dropTable("messages");
  pgm.dropTable("sessions");
  pgm.dropTable("topics");
  pgm.dropTable("blocks");
  pgm.dropTable("subjects");
  pgm.dropTable("sofi_tokens");
  pgm.dropTable("magic_links");
  pgm.dropTable("users");
};
```

- [ ] **Step 3: Generar timestamp real para el nombre del archivo**

```bash
TS=$(date +%s%3N)
mv migrations/1747900000000_initial-schema.js migrations/${TS}_initial-schema.js
ls migrations/
```

- [ ] **Step 4: Correr la migración en la DB de tests**

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/sofi_tutor_test npm run migrate:up
```

Expected output: `Migrations complete!` y aparece una tabla `pgmigrations` con 1 fila.

- [ ] **Step 5: Correr la migración en la DB de dev**

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/sofi_tutor npm run migrate:up
```

- [ ] **Step 6: Escribir tests/migrations.test.ts**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { testPool, closeTestPool } from "./helpers/db.js";

describe("schema", () => {
  afterAll(async () => {
    await closeTestPool();
  });

  const expectedTables = [
    "users",
    "magic_links",
    "sofi_tokens",
    "subjects",
    "blocks",
    "topics",
    "sessions",
    "messages",
  ];

  it.each(expectedTables)("table %s exists", async (table) => {
    const res = await testPool.query(
      `SELECT to_regclass($1) AS regclass`,
      [`public.${table}`]
    );
    expect(res.rows[0].regclass).not.toBeNull();
  });

  it("constraints work — invalid role rejected on users", async () => {
    await expect(
      testPool.query(
        `INSERT INTO users (email, name, role) VALUES ($1, $2, $3)`,
        ["x@x.com", "X", "invalid"]
      )
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 7: Correr los tests**

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/sofi_tutor_test npm test -- tests/migrations.test.ts
```

Expected: all passed.

- [ ] **Step 8: Commit**

```bash
git add migrations/ tests/migrations.test.ts
git commit -m "feat(db): add initial schema migration"
```

---

### Task 4: Magic link — solicitud de envío

**Files:**
- Create: `src/server/email/resend.ts`
- Create: `src/server/auth/magic-link.ts`
- Create: `src/server/lib/ids.ts`
- Create: `src/server/routes/auth.routes.ts`
- Modify: `src/server/index.ts` (registrar rutas y cookie plugin)
- Create: `tests/auth.test.ts`

- [ ] **Step 1: Crear src/server/lib/ids.ts**

```typescript
import { nanoid } from "nanoid";
import { randomUUID } from "crypto";

export const uuid = (): string => randomUUID();
export const shortToken = (): string => nanoid(32);
export const sofiToken = (): string => nanoid(24);
```

- [ ] **Step 2: Crear src/server/email/resend.ts**

```typescript
import { Resend } from "resend";
import { config } from "../config.js";

const client = config.resendApiKey ? new Resend(config.resendApiKey) : null;

export async function sendMagicLink(email: string, link: string): Promise<void> {
  const subject = "Tu acceso a tutor de Sofi";
  const html = `
    <p>Hola,</p>
    <p>Para ingresar al tutor de Sofi, hacé click en este link (vence en 15 minutos):</p>
    <p><a href="${link}">${link}</a></p>
    <p>Si no pediste este link, ignorá este mail.</p>
  `;

  if (!client || config.nodeEnv !== "production") {
    // Dev: log a consola y seguir
    console.log("\n--- MAGIC LINK EMAIL ---");
    console.log("To:", email);
    console.log("Subject:", subject);
    console.log("Link:", link);
    console.log("------------------------\n");
    return;
  }

  await client.emails.send({
    from: config.emailFrom,
    to: email,
    subject,
    html,
  });
}
```

- [ ] **Step 3: Crear src/server/auth/magic-link.ts**

```typescript
import { query } from "../db.js";
import { shortToken } from "../lib/ids.js";
import { sendMagicLink } from "../email/resend.js";
import { config } from "../config.js";

const EXPIRATION_MINUTES = 15;

export async function requestMagicLink(email: string): Promise<void> {
  // Single-tenant: solo el email autorizado puede recibir magic link como parent.
  // Más adelante AT/DAI/terapeutas también, cuando exista invitación.
  const normalized = email.trim().toLowerCase();
  const isParent = normalized === config.parentEmail.toLowerCase();

  // Si no es el parent, verificamos que exista user activo con ese email (invitado)
  const { rows: users } = await query<{ id: string; revoked_at: Date | null }>(
    `SELECT id, revoked_at FROM users WHERE lower(email) = $1 LIMIT 1`,
    [normalized]
  );

  let userId: string;

  if (users.length === 0) {
    if (!isParent) {
      // No reveles que el email no existe — devolvemos OK igual.
      return;
    }
    // Crear cuenta de parent si no existe (primer login)
    const { rows: created } = await query<{ id: string }>(
      `INSERT INTO users (email, name, role) VALUES ($1, $2, 'parent') RETURNING id`,
      [normalized, "Papá"]
    );
    userId = created[0].id;
  } else {
    if (users[0].revoked_at) return; // revocado: no hacer nada visible
    userId = users[0].id;
  }

  const token = shortToken();
  const expiresAt = new Date(Date.now() + EXPIRATION_MINUTES * 60 * 1000);

  await query(
    `INSERT INTO magic_links (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  );

  const link = `${config.appBaseUrl}/api/auth/verify?token=${token}`;
  await sendMagicLink(normalized, link);
}
```

- [ ] **Step 4: Crear src/server/routes/auth.routes.ts**

```typescript
import type { FastifyPluginAsync } from "fastify";
import { requestMagicLink } from "../auth/magic-link.js";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: { email: string } }>("/api/auth/request-magic-link", {
    schema: {
      body: {
        type: "object",
        required: ["email"],
        properties: { email: { type: "string", format: "email" } },
      },
    },
  }, async (req, reply) => {
    await requestMagicLink(req.body.email);
    // Siempre devolver 200 para no leakear si el email existe o no
    return reply.code(200).send({ ok: true });
  });
};
```

- [ ] **Step 5: Modificar src/server/index.ts para registrar cookie y auth routes**

Reemplazar el contenido completo de `src/server/index.ts`:

```typescript
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { healthRoutes } from "./routes/health.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { config } from "./config.js";

export async function buildApp() {
  const app = Fastify({
    logger: config.nodeEnv === "development"
      ? { transport: { target: "pino-pretty" } }
      : true,
  });

  await app.register(cookie, { secret: config.cookieSecret });
  await app.register(healthRoutes);
  await app.register(authRoutes);

  return app;
}

async function start() {
  const app = await buildApp();
  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
```

- [ ] **Step 6: Escribir tests/auth.test.ts (test que falla)**

```typescript
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { makeTestApp } from "./helpers/app.js";
import { testPool, closeTestPool, resetDb } from "./helpers/db.js";
import type { FastifyInstance } from "fastify";

describe("POST /api/auth/request-magic-link", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await makeTestApp();
  });

  beforeEach(async () => {
    await resetDb();
    // Re-run migrations
    const { default: migrationRunner } = await import("node-pg-migrate");
    await migrationRunner.default({
      databaseUrl: process.env.DATABASE_URL!,
      dir: "migrations",
      direction: "up",
      migrationsTable: "pgmigrations",
      log: () => {},
    });
  });

  afterAll(async () => {
    await app.close();
    await closeTestPool();
  });

  it("creates magic_link row for parent email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/request-magic-link",
      payload: { email: process.env.PARENT_EMAIL ?? "facuompre@gmail.com" },
    });
    expect(res.statusCode).toBe(200);

    const { rows } = await testPool.query("SELECT count(*)::int AS c FROM magic_links");
    expect(rows[0].c).toBe(1);
  });

  it("does not create row for unknown email but still returns 200", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/request-magic-link",
      payload: { email: "unknown@example.com" },
    });
    expect(res.statusCode).toBe(200);

    const { rows } = await testPool.query("SELECT count(*)::int AS c FROM magic_links");
    expect(rows[0].c).toBe(0);
  });
});
```

- [ ] **Step 7: Correr los tests**

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/sofi_tutor_test PARENT_EMAIL=facuompre@gmail.com COOKIE_SECRET=test-secret-32-chars-long-ok npm test -- tests/auth.test.ts
```

Expected: 2 passed.

- [ ] **Step 8: Verificación manual del envío en dev (con console fallback)**

```bash
npm run dev
```

En otra terminal:

```bash
curl -X POST http://localhost:3000/api/auth/request-magic-link \
  -H "content-type: application/json" \
  -d '{"email":"facuompre@gmail.com"}'
```

Verificar en los logs del server que aparece `--- MAGIC LINK EMAIL ---` con un link válido.

- [ ] **Step 9: Commit**

```bash
git add src/server/email/ src/server/auth/ src/server/lib/ids.ts src/server/routes/auth.routes.ts src/server/index.ts tests/auth.test.ts
git commit -m "feat(auth): magic link request endpoint with Resend + dev console fallback"
```

---

### Task 5: Magic link — verificación + cookie de sesión

**Files:**
- Create: `src/server/auth/cookies.ts`
- Modify: `src/server/auth/magic-link.ts` (agregar verify)
- Modify: `src/server/routes/auth.routes.ts` (agregar /verify)
- Modify: `tests/auth.test.ts` (agregar test de verify)

- [ ] **Step 1: Crear src/server/auth/cookies.ts**

```typescript
import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";

export function setParentCookie(reply: FastifyReply, userId: string): void {
  reply.setCookie(config.sessionCookieName, userId, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
    signed: true,
    path: "/",
    maxAge: config.parentCookieMaxDays * 24 * 60 * 60,
  });
}

export function setSofiCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(config.sofiCookieName, token, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
    signed: true,
    path: "/",
    maxAge: config.sofiCookieMaxDays * 24 * 60 * 60,
  });
}

export function readParentCookie(req: FastifyRequest): string | null {
  const raw = req.cookies[config.sessionCookieName];
  if (!raw) return null;
  const unsigned = req.unsignCookie(raw);
  return unsigned.valid ? unsigned.value : null;
}

export function readSofiCookie(req: FastifyRequest): string | null {
  const raw = req.cookies[config.sofiCookieName];
  if (!raw) return null;
  const unsigned = req.unsignCookie(raw);
  return unsigned.valid ? unsigned.value : null;
}

export function clearAuthCookies(reply: FastifyReply): void {
  reply.clearCookie(config.sessionCookieName, { path: "/" });
  reply.clearCookie(config.sofiCookieName, { path: "/" });
}
```

- [ ] **Step 2: Agregar función verifyMagicLink en src/server/auth/magic-link.ts**

Agregar al final del archivo:

```typescript
export type VerifyResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; reason: "not_found" | "expired" | "already_used" };

export async function verifyMagicLink(token: string): Promise<VerifyResult> {
  const { rows } = await query<{
    id: string;
    user_id: string;
    expires_at: Date;
    used_at: Date | null;
    role: string;
    revoked_at: Date | null;
  }>(
    `SELECT ml.id, ml.user_id, ml.expires_at, ml.used_at, u.role, u.revoked_at
       FROM magic_links ml
       JOIN users u ON u.id = ml.user_id
      WHERE ml.token = $1
      LIMIT 1`,
    [token]
  );

  if (rows.length === 0) return { ok: false, reason: "not_found" };

  const link = rows[0];
  if (link.used_at) return { ok: false, reason: "already_used" };
  if (new Date(link.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  if (link.revoked_at) return { ok: false, reason: "not_found" };

  await query(`UPDATE magic_links SET used_at = now() WHERE id = $1`, [link.id]);

  return { ok: true, userId: link.user_id, role: link.role };
}
```

- [ ] **Step 3: Agregar /api/auth/verify en src/server/routes/auth.routes.ts**

Reemplazar el contenido del archivo:

```typescript
import type { FastifyPluginAsync } from "fastify";
import { requestMagicLink, verifyMagicLink } from "../auth/magic-link.js";
import { setParentCookie, clearAuthCookies } from "../auth/cookies.js";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: { email: string } }>("/api/auth/request-magic-link", {
    schema: {
      body: {
        type: "object",
        required: ["email"],
        properties: { email: { type: "string", format: "email" } },
      },
    },
  }, async (req, reply) => {
    await requestMagicLink(req.body.email);
    return reply.code(200).send({ ok: true });
  });

  fastify.get<{ Querystring: { token: string } }>("/api/auth/verify", {
    schema: {
      querystring: {
        type: "object",
        required: ["token"],
        properties: { token: { type: "string", minLength: 16 } },
      },
    },
  }, async (req, reply) => {
    const result = await verifyMagicLink(req.query.token);
    if (!result.ok) {
      return reply.code(401).send({ ok: false, reason: result.reason });
    }
    setParentCookie(reply, result.userId);
    // Redirigir a una página neutra que el frontend interpretará después
    return reply.redirect("/admin.html");
  });

  fastify.post("/api/auth/logout", async (req, reply) => {
    clearAuthCookies(reply);
    return { ok: true };
  });
};
```

- [ ] **Step 4: Agregar tests en tests/auth.test.ts**

Agregar al describe block, antes del último `})`:

```typescript
  it("verify endpoint accepts valid token and sets cookie", async () => {
    await app.inject({
      method: "POST",
      url: "/api/auth/request-magic-link",
      payload: { email: process.env.PARENT_EMAIL ?? "facuompre@gmail.com" },
    });

    const { rows } = await testPool.query("SELECT token FROM magic_links LIMIT 1");
    const token = rows[0].token;

    const res = await app.inject({
      method: "GET",
      url: `/api/auth/verify?token=${token}`,
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers["set-cookie"]).toBeTruthy();
  });

  it("verify endpoint rejects unknown token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/verify?token=this-is-a-fake-token-32-chars-long",
    });
    expect(res.statusCode).toBe(401);
  });

  it("verify endpoint rejects already-used token", async () => {
    await app.inject({
      method: "POST",
      url: "/api/auth/request-magic-link",
      payload: { email: process.env.PARENT_EMAIL ?? "facuompre@gmail.com" },
    });
    const { rows } = await testPool.query("SELECT token FROM magic_links LIMIT 1");
    const token = rows[0].token;

    await app.inject({ method: "GET", url: `/api/auth/verify?token=${token}` });
    const second = await app.inject({ method: "GET", url: `/api/auth/verify?token=${token}` });

    expect(second.statusCode).toBe(401);
  });
```

- [ ] **Step 5: Correr los tests**

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/sofi_tutor_test PARENT_EMAIL=facuompre@gmail.com COOKIE_SECRET=test-secret-32-chars-long-ok npm test -- tests/auth.test.ts
```

Expected: 5 passed.

- [ ] **Step 6: Commit**

```bash
git add src/server/auth/cookies.ts src/server/auth/magic-link.ts src/server/routes/auth.routes.ts tests/auth.test.ts
git commit -m "feat(auth): magic link verification with signed cookie"
```

---

### Task 6: Middleware de auth — requireParent y requireSofi

**Files:**
- Create: `src/server/auth/middleware.ts`
- Modify: `src/server/index.ts` (decorar `request`)
- Create: `tests/middleware.test.ts`

- [ ] **Step 1: Crear src/server/auth/middleware.ts**

```typescript
import type { FastifyRequest, FastifyReply } from "fastify";
import { readParentCookie, readSofiCookie } from "./cookies.js";
import { query } from "../db.js";

export interface ParentUser {
  id: string;
  email: string;
  role: "parent";
}

export interface SofiContext {
  tokenId: string;
  tokenValue: string;
}

declare module "fastify" {
  interface FastifyRequest {
    parent?: ParentUser;
    sofi?: SofiContext;
  }
}

export async function requireParent(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = readParentCookie(req);
  if (!userId) {
    reply.code(401).send({ ok: false, reason: "unauthenticated" });
    return;
  }
  const { rows } = await query<{ id: string; email: string; role: string; revoked_at: Date | null }>(
    `SELECT id, email, role, revoked_at FROM users WHERE id = $1`,
    [userId]
  );
  if (rows.length === 0 || rows[0].revoked_at || rows[0].role !== "parent") {
    reply.code(401).send({ ok: false, reason: "unauthorized" });
    return;
  }
  req.parent = { id: rows[0].id, email: rows[0].email, role: "parent" };
}

export async function requireSofi(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const tokenValue = readSofiCookie(req);
  if (!tokenValue) {
    reply.code(401).send({ ok: false, reason: "unauthenticated" });
    return;
  }
  const { rows } = await query<{ id: string; revoked_at: Date | null }>(
    `SELECT id, revoked_at FROM sofi_tokens WHERE token = $1`,
    [tokenValue]
  );
  if (rows.length === 0 || rows[0].revoked_at) {
    reply.code(401).send({ ok: false, reason: "unauthorized" });
    return;
  }
  req.sofi = { tokenId: rows[0].id, tokenValue };
}
```

- [ ] **Step 2: Crear tests/middleware.test.ts**

```typescript
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { makeTestApp } from "./helpers/app.js";
import { testPool, closeTestPool, resetDb } from "./helpers/db.js";
import { requireParent, requireSofi } from "../src/server/auth/middleware.js";
import type { FastifyInstance } from "fastify";

describe("auth middleware", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await makeTestApp();

    // Endpoint dummy protegido por requireParent
    app.get("/test-parent", { preHandler: requireParent }, async (req) => {
      return { id: req.parent!.id, email: req.parent!.email };
    });

    // Endpoint dummy protegido por requireSofi
    app.get("/test-sofi", { preHandler: requireSofi }, async (req) => {
      return { tokenId: req.sofi!.tokenId };
    });

    await app.ready();
  });

  beforeEach(async () => {
    await resetDb();
    const { default: migrationRunner } = await import("node-pg-migrate");
    await migrationRunner.default({
      databaseUrl: process.env.DATABASE_URL!,
      dir: "migrations",
      direction: "up",
      migrationsTable: "pgmigrations",
      log: () => {},
    });
  });

  afterAll(async () => {
    await app.close();
    await closeTestPool();
  });

  it("requireParent rejects without cookie", async () => {
    const res = await app.inject({ method: "GET", url: "/test-parent" });
    expect(res.statusCode).toBe(401);
  });

  it("requireSofi rejects without cookie", async () => {
    const res = await app.inject({ method: "GET", url: "/test-sofi" });
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 3: Correr los tests**

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/sofi_tutor_test PARENT_EMAIL=facuompre@gmail.com COOKIE_SECRET=test-secret-32-chars-long-ok npm test -- tests/middleware.test.ts
```

Expected: 2 passed.

- [ ] **Step 4: Commit**

```bash
git add src/server/auth/middleware.ts tests/middleware.test.ts
git commit -m "feat(auth): add requireParent and requireSofi middleware"
```

---

### Task 7: Generación de token de Sofi (endpoint admin mínimo)

**Files:**
- Create: `src/server/routes/admin.routes.ts`
- Modify: `src/server/index.ts` (registrar admin routes)
- Create: `tests/sofi-token.test.ts`

- [ ] **Step 1: Crear src/server/routes/admin.routes.ts**

```typescript
import type { FastifyPluginAsync } from "fastify";
import { requireParent } from "../auth/middleware.js";
import { query } from "../db.js";
import { sofiToken } from "../lib/ids.js";
import { config } from "../config.js";

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: { device_name: string } }>(
    "/api/admin/sofi-tokens",
    {
      preHandler: requireParent,
      schema: {
        body: {
          type: "object",
          required: ["device_name"],
          properties: { device_name: { type: "string", minLength: 1, maxLength: 80 } },
        },
      },
    },
    async (req, reply) => {
      const token = sofiToken();
      const { rows } = await query<{ id: string }>(
        `INSERT INTO sofi_tokens (token, device_name) VALUES ($1, $2) RETURNING id`,
        [token, req.body.device_name]
      );
      return reply.code(201).send({
        ok: true,
        id: rows[0].id,
        url: `${config.appBaseUrl}/s/${token}`,
      });
    }
  );

  fastify.get(
    "/api/admin/sofi-tokens",
    { preHandler: requireParent },
    async () => {
      const { rows } = await query(
        `SELECT id, device_name, created_at, revoked_at
           FROM sofi_tokens
          ORDER BY created_at DESC`
      );
      return { tokens: rows };
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    "/api/admin/sofi-tokens/:id",
    { preHandler: requireParent },
    async (req, reply) => {
      await query(
        `UPDATE sofi_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`,
        [req.params.id]
      );
      return reply.code(200).send({ ok: true });
    }
  );
};
```

- [ ] **Step 2: Modificar src/server/index.ts**

Agregar import y register:

```typescript
import { adminRoutes } from "./routes/admin.routes.js";
// ...
await app.register(adminRoutes);
```

- [ ] **Step 3: Crear tests/sofi-token.test.ts**

```typescript
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { makeTestApp } from "./helpers/app.js";
import { testPool, closeTestPool, resetDb } from "./helpers/db.js";
import type { FastifyInstance } from "fastify";

async function loginAsParent(app: FastifyInstance): Promise<string> {
  await app.inject({
    method: "POST",
    url: "/api/auth/request-magic-link",
    payload: { email: process.env.PARENT_EMAIL ?? "facuompre@gmail.com" },
  });
  const { rows } = await testPool.query("SELECT token FROM magic_links LIMIT 1");
  const res = await app.inject({
    method: "GET",
    url: `/api/auth/verify?token=${rows[0].token}`,
  });
  const cookies = res.headers["set-cookie"] as string | string[];
  const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
  return cookieHeader;
}

describe("POST /api/admin/sofi-tokens", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await makeTestApp();
  });

  beforeEach(async () => {
    await resetDb();
    const { default: migrationRunner } = await import("node-pg-migrate");
    await migrationRunner.default({
      databaseUrl: process.env.DATABASE_URL!,
      dir: "migrations",
      direction: "up",
      migrationsTable: "pgmigrations",
      log: () => {},
    });
  });

  afterAll(async () => {
    await app.close();
    await closeTestPool();
  });

  it("rejects unauthenticated request", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/sofi-tokens",
      payload: { device_name: "Laptop personal" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("creates token when authenticated as parent", async () => {
    const cookie = await loginAsParent(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/sofi-tokens",
      headers: { cookie },
      payload: { device_name: "Laptop personal" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.url).toMatch(/\/s\/[\w-]+$/);

    const { rows } = await testPool.query("SELECT count(*)::int AS c FROM sofi_tokens");
    expect(rows[0].c).toBe(1);
  });

  it("revokes token via DELETE", async () => {
    const cookie = await loginAsParent(app);
    const create = await app.inject({
      method: "POST",
      url: "/api/admin/sofi-tokens",
      headers: { cookie },
      payload: { device_name: "Notebook cole" },
    });
    const id = create.json().id;

    const del = await app.inject({
      method: "DELETE",
      url: `/api/admin/sofi-tokens/${id}`,
      headers: { cookie },
    });
    expect(del.statusCode).toBe(200);

    const { rows } = await testPool.query(
      "SELECT revoked_at FROM sofi_tokens WHERE id = $1",
      [id]
    );
    expect(rows[0].revoked_at).not.toBeNull();
  });
});
```

- [ ] **Step 4: Correr los tests**

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/sofi_tutor_test PARENT_EMAIL=facuompre@gmail.com COOKIE_SECRET=test-secret-32-chars-long-ok npm test -- tests/sofi-token.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/server/routes/admin.routes.ts src/server/index.ts tests/sofi-token.test.ts
git commit -m "feat(admin): create/list/revoke Sofi tokens"
```

---

### Task 8: Entry point de Sofi `/s/:token`

**Files:**
- Create: `src/server/routes/sofi.routes.ts`
- Modify: `src/server/index.ts`
- Modify: `tests/sofi-token.test.ts` (agregar tests del entry point)

- [ ] **Step 1: Crear src/server/routes/sofi.routes.ts**

```typescript
import type { FastifyPluginAsync } from "fastify";
import { query } from "../db.js";
import { setSofiCookie } from "../auth/cookies.js";

export const sofiRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { token: string } }>("/s/:token", async (req, reply) => {
    const { rows } = await query<{ id: string; revoked_at: Date | null }>(
      `SELECT id, revoked_at FROM sofi_tokens WHERE token = $1`,
      [req.params.token]
    );

    if (rows.length === 0 || rows[0].revoked_at) {
      return reply.code(401).type("text/html").send(`
        <html><body>
          <p>Este link no funciona. Pedile a Papá uno nuevo.</p>
        </body></html>
      `);
    }

    setSofiCookie(reply, req.params.token);
    return reply.redirect("/sofi.html");
  });
};
```

- [ ] **Step 2: Modificar src/server/index.ts**

```typescript
import { sofiRoutes } from "./routes/sofi.routes.js";
// ...
await app.register(sofiRoutes);
```

- [ ] **Step 3: Agregar test en tests/sofi-token.test.ts**

Agregar dentro del describe, después de los tests existentes:

```typescript
  it("entry point /s/:token sets cookie for valid token", async () => {
    const cookie = await loginAsParent(app);
    const create = await app.inject({
      method: "POST",
      url: "/api/admin/sofi-tokens",
      headers: { cookie },
      payload: { device_name: "Laptop personal" },
    });
    const url = create.json().url;
    const token = url.split("/s/")[1];

    const res = await app.inject({ method: "GET", url: `/s/${token}` });
    expect(res.statusCode).toBe(302);
    expect(res.headers["set-cookie"]).toBeTruthy();
    expect(res.headers.location).toBe("/sofi.html");
  });

  it("entry point /s/:token rejects unknown token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/s/this-token-does-not-exist-1234567890",
    });
    expect(res.statusCode).toBe(401);
  });

  it("entry point /s/:token rejects revoked token", async () => {
    const cookie = await loginAsParent(app);
    const create = await app.inject({
      method: "POST",
      url: "/api/admin/sofi-tokens",
      headers: { cookie },
      payload: { device_name: "Test" },
    });
    const id = create.json().id;
    const url = create.json().url;
    const token = url.split("/s/")[1];

    await app.inject({
      method: "DELETE",
      url: `/api/admin/sofi-tokens/${id}`,
      headers: { cookie },
    });

    const res = await app.inject({ method: "GET", url: `/s/${token}` });
    expect(res.statusCode).toBe(401);
  });
```

- [ ] **Step 4: Correr los tests**

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/sofi_tutor_test PARENT_EMAIL=facuompre@gmail.com COOKIE_SECRET=test-secret-32-chars-long-ok npm test -- tests/sofi-token.test.ts
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/server/routes/sofi.routes.ts src/server/index.ts tests/sofi-token.test.ts
git commit -m "feat(sofi): entry point /s/:token sets device cookie"
```

---

### Task 9: Datos seed de Ciencias Sociales + endpoint de temas elegibles

**Files:**
- Create: `migrations/<timestamp>_seed-dev-data.js` (con `dev_only` flag)
- Create: `src/server/services/subjects.ts`
- Modify: `src/server/routes/sofi.routes.ts` (agregar /api/subjects)
- Create: `tests/subjects.test.ts`

- [ ] **Step 1: Crear migración de seed dev**

```bash
TS=$(date +%s%3N)
touch migrations/${TS}_seed-dev-data.js
```

Contenido:

```javascript
exports.up = (pgm) => {
  // Esta migración crea datos de dev. En prod se puede skipear con SKIP_SEED=1 al correr migrate:up.
  if (process.env.SKIP_SEED === "1") return;

  pgm.sql(`
    INSERT INTO subjects (id, name, active)
    VALUES ('11111111-1111-1111-1111-111111111111', 'Ciencias Sociales', true)
    ON CONFLICT DO NOTHING;

    INSERT INTO blocks (id, subject_id, title, order_index) VALUES
      ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'Geografía argentina', 0),
      ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Historia argentina', 1)
    ON CONFLICT DO NOTHING;

    INSERT INTO topics (id, block_id, title, description, status, order_index) VALUES
      ('33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222221',
       'Puntos cardinales y mapas', 'Norte, sur, este, oeste. Cómo leer un mapa básico.', 'done', 0),
      ('33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222221',
       'Provincias y regiones', 'Las 23 provincias y CABA, agrupadas por región (NOA, NEA, Cuyo, Centro, Patagonia).', 'featured', 1),
      ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222221',
       'Capitales', 'Capital de cada provincia.', 'available', 2),
      ('33333333-3333-3333-3333-333333333334', '22222222-2222-2222-2222-222222222221',
       'Relieves y climas', 'Llanura, montaña, meseta. Climas dominantes por región.', 'upcoming', 3)
    ON CONFLICT DO NOTHING;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM topics WHERE id IN (
      '33333333-3333-3333-3333-333333333331',
      '33333333-3333-3333-3333-333333333332',
      '33333333-3333-3333-3333-333333333333',
      '33333333-3333-3333-3333-333333333334'
    );
    DELETE FROM blocks WHERE id IN (
      '22222222-2222-2222-2222-222222222221',
      '22222222-2222-2222-2222-222222222222'
    );
    DELETE FROM subjects WHERE id = '11111111-1111-1111-1111-111111111111';
  `);
};
```

- [ ] **Step 2: Correr migraciones en dev y test**

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/sofi_tutor npm run migrate:up
DATABASE_URL=postgres://postgres:postgres@localhost:5432/sofi_tutor_test npm run migrate:up
```

- [ ] **Step 3: Crear src/server/services/subjects.ts**

```typescript
import { query } from "../db.js";

export interface TopicForSelector {
  id: string;
  title: string;
  status: "featured" | "available" | "done" | "mastered";
}

export interface SubjectForSelector {
  id: string;
  name: string;
  topics: TopicForSelector[];
}

export async function getSubjectsForSofi(opts: { difficultMode: boolean }): Promise<SubjectForSelector[]> {
  // Si modo día difícil: solo 'done' y 'mastered'.
  // Caso normal: 'featured', 'available', 'done', 'mastered'.
  const statusFilter = opts.difficultMode
    ? `('done', 'mastered')`
    : `('featured', 'available', 'done', 'mastered')`;

  const { rows } = await query<{
    subject_id: string;
    subject_name: string;
    topic_id: string;
    topic_title: string;
    topic_status: TopicForSelector["status"];
  }>(`
    SELECT s.id AS subject_id, s.name AS subject_name,
           t.id AS topic_id, t.title AS topic_title, t.status AS topic_status
      FROM subjects s
      JOIN blocks b ON b.subject_id = s.id
      JOIN topics t ON t.block_id = b.id
     WHERE s.active = true
       AND t.status IN ${statusFilter}
     ORDER BY s.name,
              CASE t.status
                WHEN 'featured' THEN 0
                WHEN 'available' THEN 1
                WHEN 'done' THEN 2
                WHEN 'mastered' THEN 3
              END,
              b.order_index, t.order_index
  `);

  const map = new Map<string, SubjectForSelector>();
  for (const r of rows) {
    if (!map.has(r.subject_id)) {
      map.set(r.subject_id, { id: r.subject_id, name: r.subject_name, topics: [] });
    }
    map.get(r.subject_id)!.topics.push({
      id: r.topic_id,
      title: r.topic_title,
      status: r.topic_status,
    });
  }
  return Array.from(map.values());
}
```

- [ ] **Step 4: Agregar endpoint en src/server/routes/sofi.routes.ts**

Reemplazar el contenido completo:

```typescript
import type { FastifyPluginAsync } from "fastify";
import { query } from "../db.js";
import { setSofiCookie } from "../auth/cookies.js";
import { requireSofi } from "../auth/middleware.js";
import { getSubjectsForSofi } from "../services/subjects.js";

export const sofiRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { token: string } }>("/s/:token", async (req, reply) => {
    const { rows } = await query<{ id: string; revoked_at: Date | null }>(
      `SELECT id, revoked_at FROM sofi_tokens WHERE token = $1`,
      [req.params.token]
    );

    if (rows.length === 0 || rows[0].revoked_at) {
      return reply.code(401).type("text/html").send(`
        <html><body>
          <p>Este link no funciona. Pedile a Papá uno nuevo.</p>
        </body></html>
      `);
    }

    setSofiCookie(reply, req.params.token);
    return reply.redirect("/sofi.html");
  });

  fastify.get(
    "/api/sofi/subjects",
    { preHandler: requireSofi },
    async () => {
      // En MVP, modo día difícil viene de un flag global futuro. Por ahora siempre false.
      const subjects = await getSubjectsForSofi({ difficultMode: false });
      return { subjects };
    }
  );
};
```

Nota sobre imports: bajo Node ESM con `tsx`, los imports de archivos locales deben usar extensión `.js` aunque el archivo fuente sea `.ts`. Es la convención correcta.

- [ ] **Step 5: Crear tests/subjects.test.ts**

```typescript
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { makeTestApp } from "./helpers/app.js";
import { testPool, closeTestPool, resetDb } from "./helpers/db.js";
import type { FastifyInstance } from "fastify";

async function getSofiCookie(app: FastifyInstance): Promise<string> {
  // Crear un token de sofi directamente en DB
  const { rows } = await testPool.query<{ token: string }>(
    `INSERT INTO sofi_tokens (token, device_name)
     VALUES ('test-sofi-token-12345', 'Test device')
     RETURNING token`
  );
  const res = await app.inject({ method: "GET", url: `/s/${rows[0].token}` });
  const cookies = res.headers["set-cookie"] as string | string[];
  return Array.isArray(cookies) ? cookies.join("; ") : cookies;
}

describe("GET /api/sofi/subjects", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await makeTestApp();
  });

  beforeEach(async () => {
    await resetDb();
    const { default: migrationRunner } = await import("node-pg-migrate");
    await migrationRunner.default({
      databaseUrl: process.env.DATABASE_URL!,
      dir: "migrations",
      direction: "up",
      migrationsTable: "pgmigrations",
      log: () => {},
    });
  });

  afterAll(async () => {
    await app.close();
    await closeTestPool();
  });

  it("returns Sociales with featured + available + done topics", async () => {
    const cookie = await getSofiCookie(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/sofi/subjects",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.subjects).toHaveLength(1);
    const sociales = body.subjects[0];
    expect(sociales.name).toBe("Ciencias Sociales");

    const statuses = sociales.topics.map((t: any) => t.status);
    expect(statuses).toContain("featured");
    expect(statuses).toContain("available");
    expect(statuses).toContain("done");
    expect(statuses).not.toContain("upcoming");

    // El featured viene primero
    expect(sociales.topics[0].status).toBe("featured");
  });

  it("rejects unauthenticated", async () => {
    const res = await app.inject({ method: "GET", url: "/api/sofi/subjects" });
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 6: Correr los tests**

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/sofi_tutor_test PARENT_EMAIL=facuompre@gmail.com COOKIE_SECRET=test-secret-32-chars-long-ok npm test -- tests/subjects.test.ts
```

Expected: 2 passed.

- [ ] **Step 7: Commit**

```bash
git add migrations/ src/server/services/subjects.ts src/server/routes/sofi.routes.ts tests/subjects.test.ts
git commit -m "feat(sofi): seed Sociales + endpoint of eligible topics"
```

---

### Task 10: Endpoint de inicio de sesión + stub tutor

**Files:**
- Create: `src/server/services/stub-tutor.ts`
- Create: `src/server/services/sessions.ts`
- Modify: `src/server/routes/sofi.routes.ts` (agregar endpoints de sesión)
- Create: `tests/sessions.test.ts`

- [ ] **Step 1: Crear src/server/services/stub-tutor.ts**

```typescript
export type StubBlock =
  | { block_kind: "explanation"; content: { text: string } }
  | { block_kind: "visual"; content: { visual_kind: string; caption: string } }
  | { block_kind: "question"; content: { kind: "multiple_choice"; text: string; options: string[]; correct_index: number } }
  | { block_kind: "feedback"; content: { text: string; tone: "positive" | "redirect" } };

const PROVINCES_STUB: StubBlock[] = [
  {
    block_kind: "explanation",
    content: { text: "Las provincias se agrupan en regiones. Hoy vamos a ver el Noroeste argentino, el NOA." },
  },
  {
    block_kind: "visual",
    content: { visual_kind: "map_argentina", caption: "El NOA es esta zona del país, arriba a la izquierda." },
  },
  {
    block_kind: "question",
    content: {
      kind: "multiple_choice",
      text: "¿Cuál de estas provincias es del NOA?",
      options: ["Jujuy", "Río Negro", "Mendoza"],
      correct_index: 0,
    },
  },
  {
    block_kind: "feedback",
    content: { text: "Bien. Jujuy queda al norte, dentro del NOA.", tone: "positive" },
  },
];

export function nextStubBlock(stepIndex: number): StubBlock | null {
  if (stepIndex < 0 || stepIndex >= PROVINCES_STUB.length) return null;
  return PROVINCES_STUB[stepIndex];
}

export function totalStubBlocks(): number {
  return PROVINCES_STUB.length;
}

export function stubSessionSummary(): string {
  return "Hoy aprendiste que Jujuy es una provincia del NOA y dónde queda en el mapa.";
}
```

- [ ] **Step 2: Crear src/server/services/sessions.ts**

```typescript
import { query } from "../db.js";
import { nextStubBlock, totalStubBlocks, stubSessionSummary } from "./stub-tutor.js";

export interface StartSessionInput {
  topicId: string;
}

export interface StartSessionResult {
  sessionId: string;
}

export async function startSession(input: StartSessionInput): Promise<StartSessionResult> {
  const { rows: topicRows } = await query<{ id: string; subject_id: string; status: string }>(
    `SELECT t.id, b.subject_id, t.status
       FROM topics t JOIN blocks b ON b.id = t.block_id
      WHERE t.id = $1`,
    [input.topicId]
  );
  if (topicRows.length === 0) throw new Error("topic_not_found");
  const topic = topicRows[0];
  if (!["featured", "available", "done", "mastered"].includes(topic.status)) {
    throw new Error("topic_not_eligible");
  }

  const { rows: sessionRows } = await query<{ id: string }>(
    `INSERT INTO sessions (subject_id, topic_id, steps_planned)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [topic.subject_id, topic.id, totalStubBlocks()]
  );
  return { sessionId: sessionRows[0].id };
}

export interface NextBlockResult {
  done: boolean;
  block?: ReturnType<typeof nextStubBlock>;
  stepIndex?: number;
}

export async function nextBlock(sessionId: string): Promise<NextBlockResult> {
  const { rows } = await query<{ steps_completed: number; status: string }>(
    `SELECT steps_completed, status FROM sessions WHERE id = $1`,
    [sessionId]
  );
  if (rows.length === 0) throw new Error("session_not_found");
  if (rows[0].status !== "active") return { done: true };

  const stepIndex = rows[0].steps_completed;
  const block = nextStubBlock(stepIndex);

  if (!block) return { done: true };

  // Guardar el mensaje y avanzar
  await query(
    `INSERT INTO messages (session_id, step_index, block_kind, role, content)
     VALUES ($1, $2, $3, 'tutor', $4)`,
    [sessionId, stepIndex, block.block_kind, JSON.stringify(block.content)]
  );
  await query(
    `UPDATE sessions SET steps_completed = steps_completed + 1 WHERE id = $1`,
    [sessionId]
  );

  return { done: false, block, stepIndex };
}

export interface FinishSessionResult {
  summary: string;
}

export async function finishSession(sessionId: string): Promise<FinishSessionResult> {
  await query(
    `UPDATE sessions
        SET status = 'finished', ended_at = now()
      WHERE id = $1 AND status = 'active'`,
    [sessionId]
  );
  return { summary: stubSessionSummary() };
}
```

- [ ] **Step 3: Modificar src/server/routes/sofi.routes.ts — agregar endpoints de sesión**

Agregar al top del archivo el import:

```typescript
import { startSession, nextBlock, finishSession } from "../services/sessions.js";
```

Agregar al final del plugin (antes del cierre del export):

```typescript
  fastify.post<{ Body: { topic_id: string } }>(
    "/api/sofi/sessions",
    {
      preHandler: requireSofi,
      schema: {
        body: {
          type: "object",
          required: ["topic_id"],
          properties: { topic_id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (req, reply) => {
      try {
        const result = await startSession({ topicId: req.body.topic_id });
        return reply.code(201).send({ ok: true, session_id: result.sessionId });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown";
        return reply.code(400).send({ ok: false, reason: msg });
      }
    }
  );

  fastify.post<{ Params: { id: string } }>(
    "/api/sofi/sessions/:id/next-block",
    { preHandler: requireSofi },
    async (req, reply) => {
      try {
        const result = await nextBlock(req.params.id);
        return reply.send(result);
      } catch {
        return reply.code(404).send({ ok: false, reason: "session_not_found" });
      }
    }
  );

  fastify.post<{ Params: { id: string } }>(
    "/api/sofi/sessions/:id/finish",
    { preHandler: requireSofi },
    async (req, reply) => {
      const result = await finishSession(req.params.id);
      return reply.send(result);
    }
  );
```

- [ ] **Step 4: Crear tests/sessions.test.ts**

```typescript
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { makeTestApp } from "./helpers/app.js";
import { testPool, closeTestPool, resetDb } from "./helpers/db.js";
import type { FastifyInstance } from "fastify";

const FEATURED_TOPIC_ID = "33333333-3333-3333-3333-333333333332";

async function getSofiCookie(app: FastifyInstance): Promise<string> {
  await testPool.query(
    `INSERT INTO sofi_tokens (token, device_name)
     VALUES ('test-sofi-token-12345', 'Test device')`
  );
  const res = await app.inject({ method: "GET", url: "/s/test-sofi-token-12345" });
  const cookies = res.headers["set-cookie"] as string | string[];
  return Array.isArray(cookies) ? cookies.join("; ") : cookies;
}

describe("session lifecycle", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await makeTestApp();
  });

  beforeEach(async () => {
    await resetDb();
    const { default: migrationRunner } = await import("node-pg-migrate");
    await migrationRunner.default({
      databaseUrl: process.env.DATABASE_URL!,
      dir: "migrations",
      direction: "up",
      migrationsTable: "pgmigrations",
      log: () => {},
    });
  });

  afterAll(async () => {
    await app.close();
    await closeTestPool();
  });

  it("starts a session, fetches all blocks, finishes", async () => {
    const cookie = await getSofiCookie(app);

    const start = await app.inject({
      method: "POST",
      url: "/api/sofi/sessions",
      headers: { cookie },
      payload: { topic_id: FEATURED_TOPIC_ID },
    });
    expect(start.statusCode).toBe(201);
    const sessionId = start.json().session_id;

    const kinds: string[] = [];
    for (let i = 0; i < 10; i++) {
      const res = await app.inject({
        method: "POST",
        url: `/api/sofi/sessions/${sessionId}/next-block`,
        headers: { cookie },
      });
      const body = res.json();
      if (body.done) break;
      kinds.push(body.block.block_kind);
    }

    expect(kinds).toEqual(["explanation", "visual", "question", "feedback"]);

    const finish = await app.inject({
      method: "POST",
      url: `/api/sofi/sessions/${sessionId}/finish`,
      headers: { cookie },
    });
    expect(finish.statusCode).toBe(200);
    expect(typeof finish.json().summary).toBe("string");

    const { rows } = await testPool.query(
      `SELECT status FROM sessions WHERE id = $1`,
      [sessionId]
    );
    expect(rows[0].status).toBe("finished");
  });

  it("rejects starting session on upcoming topic", async () => {
    const cookie = await getSofiCookie(app);
    const UPCOMING_TOPIC_ID = "33333333-3333-3333-3333-333333333334";
    const start = await app.inject({
      method: "POST",
      url: "/api/sofi/sessions",
      headers: { cookie },
      payload: { topic_id: UPCOMING_TOPIC_ID },
    });
    expect(start.statusCode).toBe(400);
    expect(start.json().reason).toBe("topic_not_eligible");
  });
});
```

- [ ] **Step 5: Correr los tests**

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/sofi_tutor_test PARENT_EMAIL=facuompre@gmail.com COOKIE_SECRET=test-secret-32-chars-long-ok npm test -- tests/sessions.test.ts
```

Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add src/server/services/stub-tutor.ts src/server/services/sessions.ts src/server/routes/sofi.routes.ts tests/sessions.test.ts
git commit -m "feat(sofi): session lifecycle endpoints with stub tutor"
```

---

### Task 11: Frontend de Sofi — HTML + JS vanilla

**Files:**
- Create: `public/styles/base.css`
- Create: `public/js/api.js`
- Create: `public/sofi.html`
- Create: `public/js/sofi.js`
- Create: `public/session.html`
- Create: `public/js/session.js`
- Modify: `src/server/index.ts` (servir public/)

- [ ] **Step 1: Modificar src/server/index.ts para servir static files**

```typescript
import path from "path";
import { fileURLToPath } from "url";
import staticPlugin from "@fastify/static";
// ...

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../../public");

// Dentro de buildApp:
await app.register(staticPlugin, {
  root: publicDir,
  prefix: "/",
});
```

- [ ] **Step 2: Crear public/styles/base.css**

```css
:root {
  --bg: #fdfaf3;
  --surface: #ffffff;
  --text: #2a2a2a;
  --text-soft: #5a5a5a;
  --accent: #8db580;
  --accent-strong: #6b9e60;
  --border: #e5e0d4;
  --shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  --radius: 12px;
  --space-1: 0.5rem;
  --space-2: 1rem;
  --space-3: 1.5rem;
  --space-4: 2rem;
  --space-5: 3rem;
}

* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.55;
}
body {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  padding: var(--space-3);
}
.app {
  width: 100%;
  max-width: 640px;
}
h1, h2 {
  font-weight: 600;
  margin-top: 0;
}
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--space-4);
  margin-bottom: var(--space-3);
  box-shadow: var(--shadow);
}
button {
  font: inherit;
  background: var(--accent-strong);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.05rem;
}
button:hover { background: var(--accent); }
button.subtle {
  background: transparent;
  color: var(--text-soft);
  border: 1px solid var(--border);
}
.topic-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.topic {
  display: block;
  padding: var(--space-2) var(--space-3);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  width: 100%;
  color: var(--text);
}
.topic[data-status="featured"] {
  background: white;
  border-color: var(--accent);
  font-weight: 600;
}
.topic[data-status="done"] {
  color: var(--text-soft);
}
.topic .badge {
  font-size: 0.85rem;
  color: var(--text-soft);
  margin-left: 0.5rem;
}
.trail {
  font-size: 0.85rem;
  color: var(--text-soft);
  margin-bottom: var(--space-3);
}
.block-text {
  font-size: 1.2rem;
  margin: var(--space-3) 0;
}
.block-visual-placeholder {
  background: var(--bg);
  border: 2px dashed var(--border);
  padding: var(--space-5);
  text-align: center;
  border-radius: 8px;
  margin: var(--space-3) 0;
  color: var(--text-soft);
}
.options {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: var(--space-3) 0;
}
.option {
  padding: var(--space-2);
  border: 1px solid var(--border);
  background: white;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
}
.option.selected { border-color: var(--accent-strong); }
.advance { display: flex; justify-content: flex-end; margin-top: var(--space-3); }
.summary-list {
  list-style: none;
  padding: 0;
}
.summary-list li::before { content: "✓ "; color: var(--accent-strong); }
```

- [ ] **Step 3: Crear public/js/api.js**

```javascript
export async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}
```

- [ ] **Step 4: Crear public/sofi.html**

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hola, Sofi</title>
  <link rel="stylesheet" href="/styles/base.css">
</head>
<body>
  <div class="app">
    <div class="card">
      <h1>Hola, Sofi</h1>
      <p>¿Qué vamos a ver hoy?</p>
      <div id="subjects"></div>
    </div>
  </div>
  <script type="module" src="/js/sofi.js"></script>
</body>
</html>
```

- [ ] **Step 5: Crear public/js/sofi.js**

```javascript
import { api } from "./api.js";

const STATUS_LABEL = {
  featured: "← seguimos con esto",
  available: "",
  done: "ya visto",
  mastered: "repaso",
};

async function init() {
  const root = document.getElementById("subjects");
  try {
    const { subjects } = await api("/api/sofi/subjects");
    if (!subjects.length) {
      root.textContent = "Todavía no hay nada para ver. Avisale a Papá.";
      return;
    }
    for (const subject of subjects) {
      const h2 = document.createElement("h2");
      h2.textContent = subject.name;
      root.appendChild(h2);

      const list = document.createElement("div");
      list.className = "topic-list";
      for (const topic of subject.topics) {
        const btn = document.createElement("button");
        btn.className = "topic";
        btn.dataset.status = topic.status;
        btn.textContent = topic.title;
        if (STATUS_LABEL[topic.status]) {
          const badge = document.createElement("span");
          badge.className = "badge";
          badge.textContent = STATUS_LABEL[topic.status];
          btn.appendChild(badge);
        }
        btn.addEventListener("click", () => startSession(topic.id));
        list.appendChild(btn);
      }
      root.appendChild(list);
    }
  } catch (err) {
    root.textContent = "No pudimos cargar las materias. Probá refrescar.";
    console.error(err);
  }
}

async function startSession(topicId) {
  try {
    const { session_id } = await api("/api/sofi/sessions", {
      method: "POST",
      body: { topic_id: topicId },
    });
    window.location.href = `/session.html?id=${session_id}`;
  } catch (err) {
    alert("No se pudo empezar. Probá de nuevo.");
    console.error(err);
  }
}

init();
```

- [ ] **Step 6: Crear public/session.html**

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sesión</title>
  <link rel="stylesheet" href="/styles/base.css">
</head>
<body>
  <div class="app">
    <div class="trail" id="trail"></div>
    <div class="card" id="block"></div>
    <div class="advance" id="advance"></div>
  </div>
  <script type="module" src="/js/session.js"></script>
</body>
</html>
```

- [ ] **Step 7: Crear public/js/session.js**

```javascript
import { api } from "./api.js";

const params = new URLSearchParams(window.location.search);
const sessionId = params.get("id");

const blockEl = document.getElementById("block");
const trailEl = document.getElementById("trail");
const advanceEl = document.getElementById("advance");

let stepIndex = 0;
const stepsTotal = 4; // stub fijo por ahora

function setTrail() {
  trailEl.textContent = `Paso ${stepIndex + 1} de ${stepsTotal}`;
}

function renderBlock(block) {
  blockEl.innerHTML = "";
  if (block.block_kind === "explanation") {
    const p = document.createElement("p");
    p.className = "block-text";
    p.textContent = block.content.text;
    blockEl.appendChild(p);
  } else if (block.block_kind === "visual") {
    const placeholder = document.createElement("div");
    placeholder.className = "block-visual-placeholder";
    placeholder.textContent = `[ ${block.content.visual_kind} ]`;
    blockEl.appendChild(placeholder);
    const caption = document.createElement("p");
    caption.className = "block-text";
    caption.textContent = block.content.caption;
    blockEl.appendChild(caption);
  } else if (block.block_kind === "question") {
    const p = document.createElement("p");
    p.className = "block-text";
    p.textContent = block.content.text;
    blockEl.appendChild(p);
    const options = document.createElement("div");
    options.className = "options";
    block.content.options.forEach((label, idx) => {
      const btn = document.createElement("button");
      btn.className = "option";
      btn.textContent = label;
      btn.addEventListener("click", () => {
        document.querySelectorAll(".option").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
      });
      options.appendChild(btn);
    });
    blockEl.appendChild(options);
  } else if (block.block_kind === "feedback") {
    const p = document.createElement("p");
    p.className = "block-text";
    p.textContent = block.content.text;
    blockEl.appendChild(p);
  }
}

function renderAdvance(label, handler) {
  advanceEl.innerHTML = "";
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.addEventListener("click", handler);
  advanceEl.appendChild(btn);
}

async function nextBlock() {
  const res = await api(`/api/sofi/sessions/${sessionId}/next-block`, { method: "POST" });
  if (res.done) {
    await finishSession();
    return;
  }
  renderBlock(res.block);
  stepIndex = res.stepIndex + 1;
  setTrail();
  renderAdvance("Listo", nextBlock);
}

async function finishSession() {
  const { summary } = await api(`/api/sofi/sessions/${sessionId}/finish`, { method: "POST" });
  blockEl.innerHTML = `
    <h2>¡Terminaste!</h2>
    <ul class="summary-list"><li>${escapeHtml(summary)}</li></ul>
  `;
  trailEl.textContent = "";
  renderAdvance("Cerrar", () => { window.location.href = "/sofi.html"; });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

if (!sessionId) {
  blockEl.textContent = "Falta el id de la sesión.";
} else {
  nextBlock();
}
```

- [ ] **Step 8: Smoke test manual end-to-end**

```bash
docker compose up -d postgres
DATABASE_URL=postgres://postgres:postgres@localhost:5432/sofi_tutor npm run migrate:up
npm run dev
```

En otra terminal:

```bash
# 1) Pedir magic link
curl -X POST http://localhost:3000/api/auth/request-magic-link \
  -H "content-type: application/json" \
  -d '{"email":"facuompre@gmail.com"}'

# 2) Copiar el link de la consola del server y abrirlo en el browser → redirige a /admin.html (404 por ahora, OK)

# 3) Crear token de Sofi (necesitás la cookie del browser)
```

Mejor: abrí el browser, hacé:
1. `http://localhost:3000/api/auth/request-magic-link` con DevTools, manda POST con `{email:"facuompre@gmail.com"}`.
2. Mirá la consola del server, copiá el link `http://localhost:3000/api/auth/verify?token=...`, abrílo en el browser. Se setea cookie.
3. En DevTools console: `fetch('/api/admin/sofi-tokens', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({device_name: 'Mi laptop'}), credentials:'include'}).then(r=>r.json()).then(console.log)`. Mirá el `url` que devuelve.
4. Abrí ese URL en otra ventana → te redirige a `/sofi.html`.
5. Hacé click en "Provincias y regiones" → arranca sesión.
6. Avanzá con "Listo" 4 veces → pantalla de cierre.
7. Click "Cerrar" → vuelta al selector.

- [ ] **Step 9: Commit**

```bash
git add public/ src/server/index.ts
git commit -m "feat(frontend): Sofi welcome + session UI with stub blocks"
```

---

### Task 12: Página de login de Papá (form mínimo)

**Files:**
- Create: `public/login.html`
- Create: `public/js/login.js`
- Create: `public/admin.html` (página placeholder, completar en Plan 3)

- [ ] **Step 1: Crear public/login.html**

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ingresar</title>
  <link rel="stylesheet" href="/styles/base.css">
</head>
<body>
  <div class="app">
    <div class="card">
      <h1>Ingresar</h1>
      <p>Te mandamos un link al mail para entrar.</p>
      <form id="login-form">
        <input
          type="email"
          name="email"
          placeholder="tu@email.com"
          required
          style="width:100%;padding:0.75rem;border:1px solid var(--border);border-radius:8px;font:inherit"
        />
        <div class="advance">
          <button type="submit">Enviar link</button>
        </div>
      </form>
      <p id="status" style="color: var(--text-soft); margin-top: 1rem;"></p>
    </div>
  </div>
  <script type="module" src="/js/login.js"></script>
</body>
</html>
```

- [ ] **Step 2: Crear public/js/login.js**

```javascript
import { api } from "./api.js";

const form = document.getElementById("login-form");
const status = document.getElementById("status");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = form.email.value.trim();
  status.textContent = "Enviando...";
  try {
    await api("/api/auth/request-magic-link", { method: "POST", body: { email } });
    status.textContent = "Si el email está autorizado, recibiste un link. Revisá tu mail.";
  } catch (err) {
    status.textContent = "Error. Probá de nuevo.";
    console.error(err);
  }
});
```

- [ ] **Step 3: Crear public/admin.html placeholder**

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Admin · Sofi Tutor</title>
  <link rel="stylesheet" href="/styles/base.css">
</head>
<body>
  <div class="app">
    <div class="card">
      <h1>Admin</h1>
      <p>Ingresaste correctamente. La interfaz completa de admin viene en el próximo plan.</p>
      <p>Por ahora, podés crear un token de Sofi desde la consola del navegador:</p>
      <pre style="background: var(--bg); padding: 1rem; border-radius: 8px; overflow:auto;">
fetch('/api/admin/sofi-tokens', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ device_name: 'Laptop personal' }),
  credentials: 'include'
}).then(r => r.json()).then(console.log)
      </pre>
      <button id="logout" class="subtle">Cerrar sesión</button>
    </div>
  </div>
  <script type="module">
    import { api } from "/js/api.js";
    document.getElementById("logout").addEventListener("click", async () => {
      await api("/api/auth/logout", { method: "POST" });
      window.location.href = "/login.html";
    });
  </script>
</body>
</html>
```

- [ ] **Step 4: Smoke test manual**

Reiniciar `npm run dev`. Abrir `http://localhost:3000/login.html`, ingresar email, mirar consola del server, abrir el link de magic link → redirige a `/admin.html`. Crear token desde la consola del browser. Abrir el URL del token en otra ventana → flujo de Sofi.

- [ ] **Step 5: Commit**

```bash
git add public/login.html public/js/login.js public/admin.html
git commit -m "feat(frontend): login page + admin placeholder"
```

---

### Task 13: E2E test del flujo completo

**Files:**
- Create: `tests/e2e/full-flow.test.ts`

- [ ] **Step 1: Crear tests/e2e/full-flow.test.ts**

```typescript
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { makeTestApp } from "../helpers/app.js";
import { testPool, closeTestPool, resetDb } from "../helpers/db.js";
import type { FastifyInstance } from "fastify";

const FEATURED_TOPIC_ID = "33333333-3333-3333-3333-333333333332";

describe("E2E full flow", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await makeTestApp();
  });

  beforeEach(async () => {
    await resetDb();
    const { default: migrationRunner } = await import("node-pg-migrate");
    await migrationRunner.default({
      databaseUrl: process.env.DATABASE_URL!,
      dir: "migrations",
      direction: "up",
      migrationsTable: "pgmigrations",
      log: () => {},
    });
  });

  afterAll(async () => {
    await app.close();
    await closeTestPool();
  });

  it("parent login → sofi token creation → sofi entry → session start → 4 blocks → finish", async () => {
    // 1. Parent requests magic link
    await app.inject({
      method: "POST",
      url: "/api/auth/request-magic-link",
      payload: { email: process.env.PARENT_EMAIL ?? "facuompre@gmail.com" },
    });

    // 2. Parent verifies and gets cookie
    const { rows: linkRows } = await testPool.query("SELECT token FROM magic_links LIMIT 1");
    const verify = await app.inject({
      method: "GET",
      url: `/api/auth/verify?token=${linkRows[0].token}`,
    });
    const parentCookie = (verify.headers["set-cookie"] as string | string[]);
    const parentCookieHeader = Array.isArray(parentCookie) ? parentCookie.join("; ") : parentCookie;

    // 3. Parent creates Sofi token
    const createToken = await app.inject({
      method: "POST",
      url: "/api/admin/sofi-tokens",
      headers: { cookie: parentCookieHeader },
      payload: { device_name: "Test laptop" },
    });
    expect(createToken.statusCode).toBe(201);
    const tokenUrl = createToken.json().url;
    const tokenValue = tokenUrl.split("/s/")[1];

    // 4. Sofi enters via /s/:token
    const enter = await app.inject({ method: "GET", url: `/s/${tokenValue}` });
    expect(enter.statusCode).toBe(302);
    const sofiCookie = enter.headers["set-cookie"] as string | string[];
    const sofiCookieHeader = Array.isArray(sofiCookie) ? sofiCookie.join("; ") : sofiCookie;

    // 5. Sofi fetches subjects
    const subjects = await app.inject({
      method: "GET",
      url: "/api/sofi/subjects",
      headers: { cookie: sofiCookieHeader },
    });
    expect(subjects.statusCode).toBe(200);
    const featured = subjects.json().subjects[0].topics.find((t: any) => t.status === "featured");
    expect(featured.id).toBe(FEATURED_TOPIC_ID);

    // 6. Sofi starts session
    const start = await app.inject({
      method: "POST",
      url: "/api/sofi/sessions",
      headers: { cookie: sofiCookieHeader },
      payload: { topic_id: FEATURED_TOPIC_ID },
    });
    const sessionId = start.json().session_id;

    // 7. Loop next-block until done
    let blocks = 0;
    while (blocks < 10) {
      const res = await app.inject({
        method: "POST",
        url: `/api/sofi/sessions/${sessionId}/next-block`,
        headers: { cookie: sofiCookieHeader },
      });
      if (res.json().done) break;
      blocks++;
    }
    expect(blocks).toBe(4);

    // 8. Finish
    const finish = await app.inject({
      method: "POST",
      url: `/api/sofi/sessions/${sessionId}/finish`,
      headers: { cookie: sofiCookieHeader },
    });
    expect(finish.statusCode).toBe(200);

    // 9. Verify session is finished in DB
    const { rows: sRows } = await testPool.query(
      "SELECT status, steps_completed FROM sessions WHERE id = $1",
      [sessionId]
    );
    expect(sRows[0].status).toBe("finished");
    expect(sRows[0].steps_completed).toBe(4);
  });
});
```

- [ ] **Step 2: Correr el test**

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/sofi_tutor_test PARENT_EMAIL=facuompre@gmail.com COOKIE_SECRET=test-secret-32-chars-long-ok npm test -- tests/e2e/full-flow.test.ts
```

Expected: 1 passed.

- [ ] **Step 3: Correr toda la suite**

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/sofi_tutor_test PARENT_EMAIL=facuompre@gmail.com COOKIE_SECRET=test-secret-32-chars-long-ok npm test
```

Expected: all passed (un único conteo que incluye los 16+ tests acumulados).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/
git commit -m "test(e2e): full flow from parent login to Sofi session finish"
```

---

### Task 14: Deploy a Railway

**Files:**
- Create: `railway.json`
- Create: `Procfile`
- Create: `docs/DEPLOY.md`

- [ ] **Step 1: Crear railway.json**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm ci"
  },
  "deploy": {
    "startCommand": "npm run migrate:up && npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3,
    "healthcheckPath": "/healthz",
    "healthcheckTimeout": 100
  }
}
```

- [ ] **Step 2: Crear Procfile (fallback / claridad)**

```
web: npm run migrate:up && npm start
```

- [ ] **Step 3: Crear docs/DEPLOY.md**

```markdown
# Deploy a Railway

## Setup inicial (una sola vez)

1. Instalar Railway CLI: `npm i -g @railway/cli`
2. Login: `railway login`
3. Crear proyecto: `railway init` (desde la raíz del repo)
4. Sumar plugin de Postgres: en el dashboard de Railway, agregar el service "PostgreSQL"
5. Configurar env vars en el dashboard del service web:
   - `NODE_ENV=production`
   - `DATABASE_URL=` (Railway lo expone via variable de referencia: `${{ Postgres.DATABASE_URL }}`)
   - `COOKIE_SECRET=` (generar con `openssl rand -hex 32`)
   - `RESEND_API_KEY=` (sacar de resend.com)
   - `EMAIL_FROM=noreply@tudominio.com` (verificar dominio en Resend antes)
   - `APP_BASE_URL=` (URL pública del service, ej. `https://sofi.up.railway.app`)
   - `PARENT_EMAIL=facuompre@gmail.com`

## Deploy

Push a la branch que Railway esté escuchando (configurable en el dashboard). Railway corre `npm ci`, después `npm run migrate:up && npm start`.

## Smoke test post-deploy

```bash
curl https://<tu-url-railway>/healthz
```

Debe devolver `{"status":"ok",...}`.

Después, abrir `https://<tu-url-railway>/login.html`, pedir magic link, completar el flujo como en local.

## Logs y troubleshooting

- Logs en vivo: `railway logs` o desde el dashboard.
- Si migraciones fallan, conectarse a la DB: `railway connect Postgres`.
```

- [ ] **Step 4: Verificar package.json tiene start script y engines**

Asegurar que en `package.json`:

```json
{
  "engines": { "node": ">=20.0.0" },
  "scripts": {
    "start": "tsx src/server/index.ts",
    "migrate:up": "node-pg-migrate -m migrations up"
  }
}
```

- [ ] **Step 5: Commit y push para que el usuario haga el deploy manual**

```bash
git add railway.json Procfile docs/DEPLOY.md package.json
git commit -m "chore(deploy): Railway config + deploy docs"
git push -u origin feat/sofi-tutor-design
```

- [ ] **Step 6: Deploy manual (acción del operador)**

Seguir `docs/DEPLOY.md` para crear el proyecto en Railway y configurar env vars. Disparar deploy desde Railway → verificar `/healthz` responde 200 en la URL pública.

---

## Self-review checklist (al terminar el plan)

- [ ] Todos los tests pasan: `npm test` con la suite completa
- [ ] Type-check pasa: `npm run typecheck`
- [ ] El smoke test manual end-to-end funciona localmente
- [ ] `/healthz` responde OK en Railway tras deploy
- [ ] Las migraciones corren idempotentes (re-correrlas no rompe)
- [ ] El email autorizado (`PARENT_EMAIL`) está bien seteado en prod
- [ ] El `COOKIE_SECRET` de prod NO es el de dev/test

## Siguiente plan

Cuando este plan esté completo y verificado en Railway, arrancar:

**Plan 2 — Integración Groq LLM:**
- Cliente Groq con streaming SSE
- System prompt en capas (identidad / reglas / perfil / estado / contrato)
- Reemplazo del stub-tutor por LLM real con structured output
- 3-4 visual templates SVG (map_argentina como mínimo)
- Fallback en cascada: 70B → 8B → plantillas estáticas
- Validación de contenido del LLM
- Post-procesamiento asíncrono de cierre

Y después: Plan 3 (admin Papá completo), Plan 4 (co-pilot AT/DAI con SSE), Plan 5 (terapeuta + sugerencias loop + post-proc).
