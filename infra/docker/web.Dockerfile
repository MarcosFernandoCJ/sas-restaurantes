# =============================================================================
# Frontend — Dockerfile de producción (Vite build + nginx)
# Build context: raíz del monorepo
# =============================================================================

FROM node:20-alpine AS installer
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY apps/api/package.json ./apps/api/package.json

RUN pnpm install --no-frozen-lockfile

COPY . .

# Build del frontend
RUN pnpm --filter @sas/web build

# --- Runner: nginx sirve los estáticos ---
FROM nginx:1.27-alpine AS runner

# Copiar el build de Vite
COPY --from=installer /app/apps/web/dist /usr/share/nginx/html

# Config de nginx para SPA (React Router)
RUN printf 'server {\n\
    listen 3000;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
    gzip on;\n\
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
