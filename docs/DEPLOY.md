# Deploy a Railway

## Setup inicial (una sola vez)

1. Instalar Railway CLI: `npm i -g @railway/cli`
2. Login: `railway login`
3. Crear proyecto: `railway init` (desde la raíz del repo)
4. Sumar plugin de Postgres: en el dashboard de Railway, agregar el service "PostgreSQL"
5. Configurar env vars en el dashboard del service web:
   - `NODE_ENV=production`
   - `DATABASE_URL=${{ Postgres.DATABASE_URL }}` (variable de referencia al service Postgres)
   - `COOKIE_SECRET=` (generar con `openssl rand -hex 32`)
   - `APP_BASE_URL=` (URL pública del service, ej. `https://sofi.up.railway.app`)
   - `PARENT_EMAIL=facuompre@gmail.com`

> **Sin integración de email.** Los magic links se guardan en la tabla `magic_links` y se consultan directamente (vía Postgres MCP o `railway connect Postgres`). Quien tiene acceso a la DB / al operador es quien puede entrar como Papá. Tradeoff aceptado para el MVP.

## Deploy

Push a la branch que Railway esté escuchando (configurable en el dashboard). Railway corre `npm ci`, luego `npm run migrate:up && npm start`.

## Smoke test post-deploy

```bash
curl https://<tu-url-railway>/healthz
```

Debe devolver `{"status":"ok",...}`.

Después, abrir `https://<tu-url-railway>/login.html`, pedir magic link, completar el flujo como en local.

## Logs y troubleshooting

- Logs en vivo: `railway logs` o desde el dashboard.
- Si las migraciones fallan, conectarse a la DB: `railway connect Postgres`.

## Notas

- Las migraciones corren automáticamente en cada deploy. Son idempotentes (node-pg-migrate trackea las aplicadas en la tabla `pgmigrations`).
- El seed dev (`*_seed-dev-data.cjs`) también se ejecuta en producción — los datos de "Ciencias Sociales" con sus topics se insertan automáticamente. Si querés evitarlo en prod, setear `SKIP_SEED=1` en las env vars del service.
- La app sirve archivos estáticos desde `public/` en la misma URL.
