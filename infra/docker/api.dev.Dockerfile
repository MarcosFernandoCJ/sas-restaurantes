# =============================================================================
# API — Dockerfile de desarrollo (hot reload con tsx watch)
# Build context: raíz del monorepo
# =============================================================================

FROM node:20-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apk add --no-cache openssl libc6-compat && corepack enable

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json      ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/ui/package.json   ./packages/ui/package.json
COPY apps/web/package.json      ./apps/web/package.json

RUN pnpm install --frozen-lockfile

# Copiar schema de Prisma para generar el client durante el build
COPY apps/api/prisma ./apps/api/prisma

# Generar Prisma Client (el código fuente TS se monta como volumen)
RUN pnpm --filter @sas/api run db:generate

COPY infra/docker/entrypoint.dev.sh /entrypoint.dev.sh
RUN chmod +x /entrypoint.dev.sh

EXPOSE 3001

ENTRYPOINT ["/entrypoint.dev.sh"]
