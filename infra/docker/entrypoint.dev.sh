#!/bin/sh
# =============================================================================
# entrypoint.dev.sh — Arranque del contenedor API en DESARROLLO (hot reload)
# =============================================================================
set -e

cd /app/apps/api

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SAS Restaurantes — API (modo desarrollo)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "📦 Sincronizando schema con PostgreSQL..."
pnpm exec prisma db push --accept-data-loss
echo "   ✅ Schema aplicado"

if [ "$SEED_DB" = "true" ]; then
  echo "🌱 Cargando datos de prueba..."
  pnpm exec tsx prisma/seed.ts && echo "   ✅ Seed completado" \
    || echo "   ⚠️  Seed omitido (datos ya existen)"
fi

echo "🔄 Iniciando tsx watch (hot reload)..."
echo ""

exec pnpm exec tsx watch src/index.ts
