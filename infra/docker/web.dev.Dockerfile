# =============================================================================
# Frontend — Dockerfile de desarrollo (Vite dev server con HMR)
# Build context: raíz del monorepo
# =============================================================================

FROM node:20-alpine
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY apps/api/package.json ./apps/api/package.json

RUN pnpm install --frozen-lockfile

EXPOSE 3000

# El código fuente se monta como volumen en docker-compose.dev.yml
CMD ["pnpm", "--filter", "@sas/web", "dev"]
