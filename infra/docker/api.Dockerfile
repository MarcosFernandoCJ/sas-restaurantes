# =============================================================================
# API — Dockerfile (Node 20 Alpine)
# Incluye: pnpm install → prisma generate → tsc → entrypoint con db push + seed
# Build context: raíz del monorepo
# =============================================================================

FROM node:20-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Dependencias del sistema necesarias para Prisma (OpenSSL) y scripts
RUN apk add --no-cache openssl libc6-compat && corepack enable

WORKDIR /app

# --- Instalar dependencias (capa cacheada) ---
COPY pnpm-workspace.yaml package.json ./
COPY apps/api/package.json      ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/ui/package.json   ./packages/ui/package.json
COPY apps/web/package.json      ./apps/web/package.json

RUN pnpm install --no-frozen-lockfile

# --- Copiar código fuente ---
COPY . .

# --- Generar Prisma Client (binario para linux-musl) ---
RUN pnpm --filter @sas/api run db:generate

# --- Compilar TypeScript ---
RUN pnpm --filter @sas/api run build

# --- Copiar y preparar entrypoint ---
COPY infra/docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["/entrypoint.sh"]
