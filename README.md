# SAS Restaurantes 🍗

Sistema de gestión para pollerías y restaurantes. Tres interfaces conectadas en tiempo real: cocina, mesero y administración.

---

## Interfaces

| Interfaz | Descripción | Dispositivo |
|---|---|---|
| **Cocina** | Cola de pedidos para cocineros, dark mode | Pantalla grande |
| **Mesero** | Toma de pedidos y pagos | Tableta (PWA instalable) |
| **Admin** | Gestión, analítica e inventario | Desktop |

---

## Stack

**Frontend** — React 18, Vite 5, TypeScript, TailwindCSS, Zustand, TanStack Query, Socket.io-client, PWA

**Backend** — Fastify 4, Prisma 5, PostgreSQL 16, Redis 7, Socket.io, BullMQ, JWT

**Infraestructura** — Docker Compose, Nginx, GitHub Actions

---

## Requisitos

- [Docker](https://www.docker.com/) y Docker Compose
- [Node.js](https://nodejs.org/) 20 LTS
- [pnpm](https://pnpm.io/) 9+

---

## Inicio rápido

### 1. Clonar y configurar variables de entorno

```bash
git clone https://github.com/MarcosFernandoCJ/sas-restaurantes.git
cd sas-restaurantes
cp .env.example .env
```

Edita `.env` con tus valores reales (JWT secret, credenciales Culqi, etc.).

### 2. Levantar en desarrollo

```bash
pnpm install
pnpm dev
```

Esto levanta todos los servicios con Docker Compose:

| Servicio | URL |
|---|---|
| Frontend (Vite) | http://localhost:3000 |
| API (Fastify) | http://localhost:3001 |
| pgAdmin | http://localhost:5050 |

### 3. Cargar datos de prueba

```bash
pnpm db:seed
```

---

## Comandos útiles

```bash
# Desarrollo
pnpm dev                  # levantar todos los servicios
pnpm build                # build de producción

# Base de datos
pnpm db:migrate           # correr migraciones pendientes
pnpm db:seed              # cargar datos de prueba
pnpm db:studio            # abrir Prisma Studio

# Tests
pnpm test                 # unit + api
pnpm test:e2e             # playwright

# Docker
pnpm docker:up            # producción
pnpm docker:down          # bajar servicios
```

---

## Estructura del proyecto

```
/
├── apps/
│   ├── web/          ← React 18 + Vite (PWA)
│   └── api/          ← Fastify + Prisma
├── packages/
│   ├── shared/       ← Tipos TS compartidos
│   └── ui/           ← Design system
├── infra/
│   ├── docker/
│   └── nginx/
├── scripts/
├── docker-compose.yml
└── docker-compose.dev.yml
```

---

## Variables de entorno

Copia `.env.example` a `.env` y completa los valores:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL |
| `REDIS_URL` | Conexión a Redis |
| `JWT_SECRET` | Secreto para firmar tokens JWT |
| `CULQI_SECRET_KEY` | Clave secreta Culqi (pagos) |
| `VITE_API_URL` | URL de la API desde el frontend |

> **Nunca commitear el archivo `.env` con claves reales.**

---

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md)
- [Sesiones de desarrollo](docs/SESSIONS.md)
- [Guía para Claude Code](CLAUDE.md)
