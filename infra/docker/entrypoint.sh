#!/bin/sh
# =============================================================================
# entrypoint.sh — Arranque del contenedor API
# Aplica el schema de Prisma y carga datos de prueba antes de iniciar el servidor
# =============================================================================
set -e

cd /app/apps/api

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SAS Restaurantes — API iniciando..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Aplicar schema a la base de datos (db push es idempotente)
echo "📦 Sincronizando schema con PostgreSQL..."
pnpm exec prisma db push --accept-data-loss
echo "   ✅ Schema aplicado"

# Cargar datos de prueba si se solicita
if [ "$SEED_DB" = "true" ]; then
  echo "🌱 Cargando datos de prueba..."
  pnpm exec tsx prisma/seed.ts && echo "   ✅ Seed completado" \
    || echo "   ⚠️  Seed omitido (datos ya existen o error esperado)"
fi

echo "🚀 Iniciando servidor Fastify en puerto ${PORT:-3001}..."
echo ""

exec node dist/index.js
