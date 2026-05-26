# CLAUDE.md — SAS Restaurantes (Pollerías)
> Este archivo es leído automáticamente por Claude Code en cada sesión.
> Contiene las reglas de arquitectura, convenciones y contexto de negocio del proyecto.

---

## 🧭 Contexto del Proyecto

Sistema de gestión para pollerías / restaurantes. Tres interfaces conectadas en tiempo real:
- **Cocina**: cola de pedidos para cocineros (pantalla grande, dark mode)
- **Mesero**: toma de pedidos y pagos desde tableta (PWA instalable)
- **Admin**: panel de gestión, analítica e inventario (desktop)

MVP actual. Sin multitenancy todavía. Una sola sucursal.

---

## 📁 Estructura del Monorepo

```
/
├── apps/
│   ├── web/          ← React 18 + Vite + TypeScript (PWA)
│   └── api/          ← Fastify + Prisma + TypeScript
├── packages/
│   ├── shared/       ← Tipos TS compartidos (DTOs, enums, constantes)
│   └── ui/           ← Componentes React del design system
├── infra/
│   ├── docker/       ← Dockerfiles por servicio
│   └── nginx/        ← nginx.conf
├── scripts/          ← Seeds, migraciones manuales, utilidades
├── docker-compose.yml
├── docker-compose.dev.yml
├── pnpm-workspace.yaml
└── CLAUDE.md         ← Este archivo
```

---

## ⚙️ Stack Tecnológico

### Frontend (`apps/web`)
| Herramienta | Versión | Uso |
|---|---|---|
| React | 18 | UI |
| Vite | 5 | Build + HMR |
| TypeScript | 5 | Tipado |
| TailwindCSS | 3 | Estilos (tokens en `tailwind.config.ts`) |
| Zustand | 4 | Estado global |
| TanStack Query | 5 | Server state + cache |
| React Hook Form | 7 | Formularios |
| Zod | 3 | Validación de esquemas |
| Socket.io-client | 4 | WebSocket |
| Vite PWA Plugin | latest | Service Worker + manifest |
| Recharts | 2 | Gráficos admin |
| date-fns | 3 | Manejo de fechas |

### Backend (`apps/api`)
| Herramienta | Versión | Uso |
|---|---|---|
| Node.js | 20 LTS | Runtime |
| Fastify | 4 | HTTP server |
| TypeScript | 5 | Tipado |
| Prisma | 5 | ORM + migraciones |
| PostgreSQL | 16 | Base de datos principal |
| Redis | 7 | Sesiones, pub/sub, BullMQ |
| Socket.io | 4 | WebSocket server |
| BullMQ | 5 | Cola de jobs async |
| JWT (jsonwebtoken) | 9 | Auth tokens |
| bcrypt | 5 | Hash de contraseñas |
| Zod | 3 | Validación de request body |

### Infraestructura
- Docker + Docker Compose (dev y prod)
- Nginx como reverse proxy
- GitHub Actions para CI/CD

---

## 🗄️ Base de Datos — Reglas Prisma

- Siempre usar `uuid()` como default en IDs (`@default(uuid())`)
- Timestamps: `createdAt DateTime @default(now())` y `updatedAt DateTime @updatedAt`
- Enums en Prisma, no strings libres en la BD
- Nunca usar `CASCADE` en delete sin confirmación explícita
- Todas las migraciones con nombre descriptivo: `pnpm prisma migrate dev --name <nombre>`
- El schema vive en `apps/api/prisma/schema.prisma`

### Enums críticos (nunca cambiar los valores string en producción)
```prisma
enum UserRole        { admin waiter chef }
enum TableStatus     { free occupied reserved }
enum WaiterMode      { free assigned }
enum OrderType       { dine_in delivery }
enum OrderStatus     { pending in_prep ready delivered cancelled }
enum ItemStatus      { pending in_prep ready served }
enum InvoiceStatus   { pending paid voided }
enum PaymentMethod   { cash card yape plin other }
enum IngredientStatus { ok low critical out }
```

---

## 🔐 Autenticación

- JWT con access token (15 min) + refresh token (8h para turno de mesero)
- El refresh token se guarda en Redis con key `refresh:{userId}:{tokenId}`
- Roles: `admin` > `waiter` > `chef`
- Middleware de rol en Fastify: `fastify.addHook('preHandler', requireRole(['admin']))`
- La vista de Cocina usa PIN de turno (sin login individual por ahora)
- Headers: `Authorization: Bearer <token>`

---

## 🌐 WebSocket — Rooms y Eventos

### Rooms
```
room:kitchen          → todos los chefs
room:waiter:{userId}  → mesero específico
room:admin            → panel admin
```

### Eventos (server → client)
```typescript
'order:created'       // nuevo pedido llega a cocina
'order:item:claimed'  // cocinero tomó un ítem
'order:item:ready'    // ítem listo, notifica al mesero
'order:item:updated'  // mesero editó ítem en preparación
'order:additional'    // pedido adicional de una mesa
'stock:alert'         // insumo bajó del umbral mínimo
```

### Eventos (client → server)
```typescript
'item:claim'          // cocinero reclama un ítem
'item:ready'          // cocinero marca ítem como listo
'item:served'         // mesero confirma recojo
```

---

## 💳 Pagos

- **Proveedor principal**: Culqi (mercado peruano)
- **Variables de entorno**: `CULQI_PUBLIC_KEY`, `CULQI_SECRET_KEY`
- Flujo: frontend crea token Culqi → envía al backend → backend carga con secret key
- Métodos soportados MVP: `cash` (manual), `card` (Culqi), `yape` (QR Culqi), `plin` (QR)
- Una factura por confirmación de pedido. Las facturas pagadas son inmutables.
- Pedidos adicionales = nueva factura separada, nunca modificar la original

---

## 🧾 Reglas de Negocio Críticas

### Pedidos
1. Un pedido solo entra a la cola de cocina **después de confirmado el pago** (invoice.status = 'paid')
2. Los pedidos adicionales (`is_additional: true`) tienen `parentOrderId` apuntando al pedido original
3. Los adicionales aparecen **al final** de la cola de cocina con tag visual "ADICIONAL"
4. Si un ítem en preparación es editado por el mesero → emitir `order:item:updated` → badge "ACTUALIZADO" en la tarjeta de cocina
5. Cuando **todos** los `order_items` de un order tienen `status = 'served'` → el `order.status` cambia automáticamente a `'delivered'`

### Inventario
6. Al confirmar una compra (`purchase`), actualizar automáticamente `ingredient.stockQty` sumando lo comprado
7. El `ingredient.status` se recalcula en cada update: `out` si stock=0, `critical` si stock ≤ minStockQty, `low` si stock ≤ minStockQty * 2, `ok` en otro caso
8. Al cambiar un status a `critical` o `out`, emitir `stock:alert` al room:admin

### Menú diario
9. Solo los `menu_items` que aparecen en `daily_menus` para la fecha de hoy están disponibles para tomar pedidos
10. El admin debe confirmar el menú del día; hasta entonces, el mesero ve "Menú no confirmado"

### Tiempos de preparación
11. El tiempo estimado de un pedido = `MAX(prep_time_minutes)` de sus ítems (preparación paralela)
12. Las bebidas simples (sin receta) tienen `prepTimeMinutes = 2` por defecto

---

## 📂 Convenciones de Código

### Naming
- Archivos: `kebab-case.ts` / `kebab-case.tsx`
- Componentes React: `PascalCase`
- Hooks: `useNombreDescriptivo`
- Stores Zustand: `useNombreStore`
- Servicios API: `nombre.service.ts`
- Rutas Fastify: `nombre.routes.ts`
- Schemas Zod: `nombreSchema` (ej: `createOrderSchema`)

### Estructura de un módulo backend
```
apps/api/src/modules/orders/
├── orders.routes.ts      ← definición de rutas Fastify
├── orders.service.ts     ← lógica de negocio
├── orders.repository.ts  ← queries Prisma
├── orders.schema.ts      ← schemas Zod de validación
└── orders.types.ts       ← tipos TypeScript del módulo
```

### Estructura de un módulo frontend
```
apps/web/src/features/kitchen/
├── components/           ← componentes de la feature
│   └── KitchenCard.tsx
├── hooks/                ← hooks específicos
│   └── useKitchenQueue.ts
├── store/                ← slice de Zustand si aplica
│   └── kitchen.store.ts
├── types.ts              ← tipos locales
└── index.ts              ← re-exports públicos
```

### Imports
- Usar path aliases: `@/` para `apps/web/src/`, `@api/` para `apps/api/src/`
- Los tipos compartidos se importan desde `@sas/shared`
- Nunca imports relativos que suban más de 2 niveles (`../../..`)

---

## 🎨 Design System — Tokens

Los tokens de color están en `tailwind.config.ts` y como variables CSS en `globals.css`.
Ver `packages/ui/src/tokens.ts` para la fuente de verdad.

```typescript
// Colores principales — NUNCA hardcodear hexadecimales en componentes
primary:    '#1B2B3A'   // Azul carbón profundo
secondary:  '#C8410A'   // Rojo brasas
accent:     '#E8A838'   // Ámbar dorado
surface:    '#FAFAF8'   // Crema cálida
dark:       '#0F1A24'   // Fondo cocina dark mode
```

Paleta completa en `/packages/ui/src/tokens.ts` — consultar antes de estilar.

---

## 🐳 Docker

### Servicios (`docker-compose.yml`)
```yaml
services:
  nginx:     puerto 80/443 → proxy a frontend:3000 y api:3001
  frontend:  puerto 3000 (Vite preview en prod, dev server en dev)
  api:       puerto 3001 (Fastify)
  db:        puerto 5432 (PostgreSQL 16)
  redis:     puerto 6379 (Redis 7)
  pgadmin:   puerto 5050 (solo en dev)
```

### Comandos frecuentes
```bash
# Levantar todo en desarrollo
docker-compose -f docker-compose.dev.yml up

# Correr migraciones
docker-compose exec api pnpm prisma migrate dev

# Seed de datos de prueba
docker-compose exec api pnpm db:seed

# Ver logs de un servicio
docker-compose logs -f api
```

---

## 🧪 Testing

- **Unit tests**: Vitest (`pnpm test`)
- **API tests**: Vitest + Supertest (`pnpm test:api`)
- **E2E**: Playwright (`pnpm test:e2e`)
- **Stress**: k6 (`pnpm test:stress`)
- Archivos de test: `*.test.ts` o `*.spec.ts` junto al archivo que testean
- Coverage mínimo: 85% en módulos de pedidos, auth y cálculos de costos

---

## 🚫 Restricciones — NUNCA hacer esto

- ❌ Nunca modificar una `invoice` con `status = 'paid'`
- ❌ Nunca enviar pedidos a cocina antes de confirmar el pago
- ❌ Nunca hardcodear keys de API (usar variables de entorno)
- ❌ Nunca usar `any` en TypeScript sin un comentario `// TODO: tipar`
- ❌ Nunca borrar datos de inventario; solo marcar `isActive: false`
- ❌ Nunca usar `console.log` en producción; usar el logger de Fastify (`request.log.info`)
- ❌ Nunca commits directos a `main`; siempre PR con nombre `feat/`, `fix/`, `chore/`

---

## 📋 Comandos del Proyecto

```bash
# Instalar dependencias
pnpm install

# Desarrollo (todos los servicios)
pnpm dev

# Build de producción
pnpm build

# Tests
pnpm test          # unit + api
pnpm test:e2e      # playwright
pnpm test:stress   # k6

# Prisma
pnpm --filter api prisma migrate dev --name <nombre>
pnpm --filter api prisma studio
pnpm --filter api db:seed

# Lint + format
pnpm lint
pnpm format

# Docker producción
docker-compose up --build
```

---

*Última actualización: Sesión 0.1 — Monorepo + Docker*
*Cualquier decisión de arquitectura que cambie este archivo debe documentarse en el PR correspondiente.*
