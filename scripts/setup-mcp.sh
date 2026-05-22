#!/usr/bin/env bash
# Configura un MCP de Postgres en Claude Code apuntando a la DB de prod de Railway.
# El URL de conexión se extrae al momento y se pasa al `claude mcp add` sin
# imprimirse en stdout, así no contamina el transcript de Claude Code.
#
# Requisitos:
#   - Estar en el directorio del proyecto (linked a Railway via `railway link`).
#   - Estar autenticado: `railway whoami` debe devolver tu usuario.
#   - Tener `claude` (Claude Code CLI) en el PATH.
#
# Uso:
#   ./scripts/setup-mcp.sh
#   o desde Claude Code:  !./scripts/setup-mcp.sh

set -euo pipefail

if ! command -v railway >/dev/null 2>&1; then
  echo "❌ railway CLI no encontrada. Instalala con: npm i -g @railway/cli" >&2
  exit 1
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "❌ claude CLI no encontrada en el PATH." >&2
  exit 1
fi

if ! railway whoami >/dev/null 2>&1; then
  echo "❌ No estás logueado en Railway. Corré 'railway login' primero." >&2
  exit 1
fi

# Extraer DATABASE_PUBLIC_URL del service Postgres SIN imprimirlo.
DB_URL="$(railway variable list --service Postgres -k 2>/dev/null \
  | grep '^DATABASE_PUBLIC_URL=' \
  | cut -d= -f2- || true)"

if [ -z "${DB_URL:-}" ]; then
  echo "❌ No se pudo extraer DATABASE_PUBLIC_URL del service Postgres." >&2
  echo "   Verificá: 'railway variable list --service Postgres -k | grep DATABASE_PUBLIC_URL'" >&2
  exit 1
fi

# Si ya existe el MCP con este nombre, removerlo primero (idempotencia).
claude mcp remove sofi-prod-db --scope user >/dev/null 2>&1 || true

# Agregar el MCP. El URL se pasa como argumento posicional al servidor MCP
# de Postgres. El comando de claude no echoa el valor del argumento.
claude mcp add sofi-prod-db --scope user \
  -- npx -y @modelcontextprotocol/server-postgres "$DB_URL" >/dev/null

# Verificación: chequear que aparezca en el listado.
if claude mcp list 2>&1 | grep -q "sofi-prod-db"; then
  echo "✅ MCP 'sofi-prod-db' configurado correctamente."
  echo ""
  echo "Próximo paso: reiniciá esta sesión de Claude Code (Ctrl-C y volver a entrar,"
  echo "o /reset según tu flujo) para que cargue el MCP nuevo."
else
  echo "⚠ MCP agregado pero no aparece en el listado. Revisá: claude mcp list" >&2
  exit 1
fi
