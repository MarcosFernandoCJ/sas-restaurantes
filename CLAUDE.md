# CLAUDE.md — SAS Restaurantes (Pollerías)
> Este archivo es leído automáticamente por Claude Code en cada sesión.
> Contiene las reglas de arquitectura, convenciones y contexto de negocio del proyecto.

---

## 🧭 Contexto del Proyecto

Sistema de gestión para pollerías / restaurantes. **Cuatro interfaces** conectadas en tiempo real:
- **Cocina**: cola de ítems `kitchen`, pantalla grande, dark mode
- **Bar**: cola de ítems `bar`, misma lógica que cocina, área separada
- **Mesero**: toma de pedidos y registro de cobros desde tableta (PWA instalable)
- **Admin**: panel de gestión, jornadas y analítica (desktop)

MVP actual. Sin multitenancy. Una sola sucursal.

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
├── docs/
│   ├── ARCHITECTURE.md ← Arquitectura detallada y flujos
│   └── SESSIONS.md     ← Plan de sesiones de desarrollo
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
| BullMQ | 5 | Cola de jobs async (recordatorios de recojo) |
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
enum UserRole         { admin waiter chef }
enum TableStatus      { free occupied reserved }
enum WaiterMode       { free assigned }
enum OrderType        { dine_in delivery }
enum OrderStatus      { pending in_prep ready delivered cancelled }
enum ItemStatus       { pending in_prep ready served }
enum InvoiceStatus    { pending paid voided }
enum PaymentMethod    { cash card yape plin other }
enum IngredientStatus { ok low critical out }
enum CategoryType     { food drink other }
enum DispatchArea     { kitchen bar waiter }   ← CENTRAL: determina a qué pantalla va cada ítem
enum JourneyStatus    { open closed }
enum SocketEventType  { ORDER_CREATED ADDITIONAL_ORDER_CREATED ITEM_STARTED
                        ITEM_READY WAITER_NOTIFIED ITEM_DELIVERED
                        SHIFT_OPENED SHIFT_CLOSED }
```

---

## 🔐 Autenticación

- JWT con access token (15 min) + refresh token (8h para turno de mesero)
- El refresh token se guarda en Redis con key `refresh:{userId}:{tokenId}`
- Roles: `admin` > `waiter` > `chef`
- Middleware de rol en Fastify: `requireRole(['admin'])` como `preHandler`
- La vista de Cocina y Bar usan PIN de turno (sin login individual por ahora)
- Headers: `Authorization: Bearer <token>`

---

## 🌐 WebSocket — Rooms y Eventos

### Rooms
```
room:kitchen          → pantalla de cocina
room:bar              → pantalla de bar
room:waiter:{userId}  → mesero específico
room:admin            → panel admin
```

### Eventos (server → client)
```typescript
'order:created'           // nuevo pedido → kitchen/bar reciben solo sus ítems
'order:additional'        // pedido adicional de una mesa
'order:item:claimed'      // chef/barman tomó un ítem (puede incluir autoClaimed: true)
'order:item:ready'        // ítem listo → sala lo atenúa + mesero recibe notificación push
'order:ready'             // solo delivery: todos los ítems de producción listos
'order:delivered'         // todos los ítems served → tarjeta sale de la cola
'order:item:updated'      // mesero editó notas en preparación → badge ACTUALIZADO
'table:updated'           // waiter refresca TableDetail (pago, claim, etc.)
'journey:started'         // jornada abierta por el admin
'journey:ended'           // jornada cerrada por el admin
'stock:alert'             // insumo bajó del umbral mínimo → room:admin
```

### Eventos (client → server)
```typescript
'item:claim'          // chef/barman reclama un ítem
'item:ready'          // chef/barman marca ítem como listo (auto-claim si estaba pending)
'item:served'         // mesero confirma recojo → cancela BullMQ reminder
```

---

## 🗂️ DispatchArea — Lógica Central

Cada `MenuItem` tiene `dispatchArea` que determina a qué pantalla va el ítem al ordenarse.
El valor se copia en `OrderItem.assignedArea` al crear el pedido.

| `dispatch_area` | `requires_preparation` | Comportamiento |
|---|---|---|
| `kitchen` | `true` | Va a la cola de cocina. Chef lo reclama y prepara. |
| `bar` | `true` | Va a la cola de bar. Barman lo prepara. |
| `waiter` | `false` | Sin pantalla de preparación. Mesero lo despacha directamente. |

- El admin configura `dispatchArea` en el Recetario. No se puede cambiar por pedido.
- Los ítems `waiter` se marcan `ready` automáticamente al crear el pedido.

---

## 💳 Pagos — Registro Manual

**No hay integración con pasarela de pago externa en el MVP.**
Los pagos son registros manuales realizados por el mesero.

### Dos flujos (la diferencia es solo cuándo se registra el cobro)

**Ambos flujos** despachan el pedido a cocina/bar **inmediatamente** al crearlo:

1. `POST /orders` → crea Order + OrderItems → `dispatchOrderToAreas()` emite a room:kitchen y/o room:bar
2. `POST /invoices` → crea Invoice con `status = 'pending'`
3. Pantalla de elección: **"Pagar ahora"** → abre PaymentModal → `POST /invoices/:id/pay`
                         **"Pagar después"** → vuelve al tablero, badge "Falta pagar" en la mesa

### Registro de pago
- Métodos: `cash | card | yape | plin | other`
- Referencia opcional: número de operación, voucher (`payment_reference`)
- Una factura `paid` es **inmutable**. Nunca modificar.
- Pedidos adicionales generan una nueva `Invoice` separada.

---

## 📅 JourneySession — Jornada Operativa

Cada día de operación tiene una `JourneySession` abierta por el admin.

- **`POST /orders` requiere jornada abierta** → devuelve 403 si no hay sesión activa.
- Las métricas (`JourneyMetrics`) se acumulan incrementalmente al completar cada pedido (crash-safe).
- El admin abre (`SHIFT_OPENED`) y cierra (`SHIFT_CLOSED`) la jornada. Ambos eventos se registran en `SocketEvent`.
- `journey:started` / `journey:ended` se emiten vía WebSocket a waiter y admin.

---

## 🧾 Reglas de Negocio Críticas

### Pedidos
1. El pedido se despacha a cocina/bar **inmediatamente** al crearse (`POST /orders`), sin depender del estado de pago
2. Si no hay `JourneySession` abierta, `POST /orders` retorna **403**
3. Los pedidos adicionales (`is_additional: true`) tienen `parentOrderId` apuntando al original
4. Los adicionales llegan **al final** de la cola con tag visual "ADICIONAL"
5. Si el mesero edita notas de un ítem en preparación → emitir `order:item:updated` → badge "ACTUALIZADO" en la tarjeta
6. Si un chef/barman marca `item:ready` sin haber hecho `item:claim`, el sistema hace **auto-claim** automático
7. Cuando **todos** los `order_items` tienen `status = 'served'` → `order.status = 'delivered'` automáticamente
8. Al completar un pedido (`delivered`) → `journeyService.recordDeliveredOrder()` actualiza `JourneyMetrics`
9. Para **delivery**: `order:ready` se emite al mesero solo cuando todos los ítems de cocina + bar están listos

### Inventario
10. Al confirmar una compra (`purchase`), actualizar automáticamente `ingredient.stockQty`
11. `ingredient.status` se recalcula en cada update: `out` si stock=0, `critical` si stock ≤ minStockQty, `low` si stock ≤ minStockQty × 2, `ok` en otro caso
12. Al cambiar status a `critical` o `out`, emitir `stock:alert` a room:admin

### Menú diario
13. Solo los `menu_items` en `daily_menus` para la fecha de hoy están disponibles para tomar pedidos
14. El admin debe confirmar el menú del día; hasta entonces, el mesero ve "Menú no confirmado"

### Tiempos de preparación
15. El tiempo estimado de un pedido = `MAX(prep_time_minutes)` de sus ítems (preparación paralela)
16. Los ítems `waiter` (`requires_preparation = false`) tienen `prepTimeMinutes = 0`

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
│   └── useKitchenSocket.ts
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
dark:       '#0F1A24'   // Fondo cocina/bar dark mode
```

Paleta completa en `packages/ui/src/tokens.ts` — consultar antes de estilar.

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

## 🤖 Estrategia de Skills y MCP

Esta sección define la estructura base para futuros agentes de IA y herramientas MCP
que extenderán las capacidades del sistema. Es la **fuente de verdad** para planificar
integraciones de IA. No contiene implementación, solo la arquitectura de módulos.

### Estructura de módulos MCP (futuro)

```
apps/api/src/mcp/
├── analytics.mcp.ts       ← Agente de análisis de jornadas y ventas
│                             Contexto: JourneyMetrics, invoice history, item breakdown
├── inventory.mcp.ts       ← Agente de gestión de inventario
│                             Contexto: ingredient status, purchase history, recipes
├── menu.mcp.ts            ← Agente de recomendaciones de menú
│                             Contexto: daily_menus, item popularity, ingredient cost
├── demand.mcp.ts          ← Agente de predicción de demanda
│                             Contexto: calendar_events, hourly_breakdown histórico
└── purchasing.mcp.ts      ← Agente de compras y proveedores
│                             Contexto: ingredient alerts, supplier prices, purchase history
```

### Skills activas en Claude Code (por tipo de tarea)

| Tarea | Skill | Cuándo activarla |
|---|---|---|
| Componentes UI, pantallas, layouts | `frontend-design` | Cualquier componente visual nuevo |
| Plantillas Excel (recetas, inventario) | `xlsx` | Importación/exportación masiva |
| Reportes descargables | `pdf` | Lista de compras, cierre de caja |
| Lectura de archivos del cliente | `file-reading` | Migración de datos iniciales |
| Manuals de usuario | `docx` | Documentación por rol |

### Convenciones para módulos MCP

- Cada módulo `.mcp.ts` expone herramientas tipadas con Zod
- El contexto de cada agente se construye leyendo la BD, nunca recibiendo datos del cliente
- Los agentes son **read-only** por defecto; las escrituras requieren confirmación explícita
- Naming: `{dominio}.mcp.ts` para el módulo, `{acción}{Dominio}Tool` para cada herramienta

### Prioridad de implementación

1. `analytics.mcp.ts` — usa `JourneyMetrics` ya implementado, bajo esfuerzo, alto valor
2. `inventory.mcp.ts` — usa datos de stock ya disponibles
3. `menu.mcp.ts` — requiere historial suficiente de ventas
4. `demand.mcp.ts` — requiere `calendar_events` y varios meses de `hourly_breakdown`
5. `purchasing.mcp.ts` — requiere integración con proveedores externos

---

## 🚫 Restricciones — NUNCA hacer esto

- ❌ Nunca modificar una `invoice` con `status = 'paid'`
- ❌ Nunca bloquear el despacho del pedido esperando el pago (el despacho es siempre inmediato)
- ❌ Nunca crear un pedido sin verificar que hay una `JourneySession` abierta
- ❌ Nunca hardcodear keys de API o hexadecimales de color en componentes
- ❌ Nunca usar `any` en TypeScript sin un comentario `// TODO: tipar`
- ❌ Nunca borrar datos de inventario; solo marcar `isActive: false`
- ❌ Nunca usar `console.log` en producción; usar el logger de Fastify (`request.log.info`)
- ❌ Nunca commits directos a `main`; siempre PR con nombre `feat/`, `fix/`, `chore/`
- ❌ Nunca cambiar los valores string de los enums en producción

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

*Última actualización: 2026-06-12 — DispatchArea, JourneySession, flujo de pagos manuales, Estrategia MCP*
*Cualquier decisión de arquitectura que cambie este archivo debe documentarse en el PR correspondiente.*
