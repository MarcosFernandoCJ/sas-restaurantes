🍗

SAS RESTAURANTES

Sistema de Gestión para Pollerías

DOCUMENTO DE ARQUITECTURA

Versión 2.0  ·  2026


|INTERFACES DEL SISTEMA|
|---|
|• 🍳  Cocina — Cola de pedidos, pantalla grande, dark mode|
|• 🍹  Bar — Cola de bebidas y preparaciones de barra|
|• 🧑‍💼  Mesero — Toma de pedidos y registro de pagos (PWA)|
|• 📊  Admin — Panel de gestión, jornadas y analítica|


Confidencial · Uso interno


## 1. RESUMEN EJECUTIVO

Sistema de gestión para pollerías con cuatro interfaces conectadas en tiempo real. El MVP cubre el ciclo completo: toma de pedido → preparación paralela (cocina / bar) → entrega → registro de pago.

El sistema es una sola sucursal sin multitenancy. Los pagos son **registros manuales post-servicio** (sin pasarela de pago externa en el MVP). Cada ítem del menú tiene un `dispatchArea` que determina a qué pantalla va al crearse un pedido.


### Principios de Diseño

|Principio | Descripción|
|---|---|
|DispatchArea como eje central | Cada ítem sabe a dónde va: cocina, bar o mesero directo.|
|Dos flujos de pago | "Pagar ahora" bloquea dispatch. "Pagar después" despacha con tag pendiente.|
|JourneySession por jornada | Métricas incrementales crash-safe. El admin abre y cierra la jornada del día.|
|Offline-first en mesero | Pedidos en cola local si pierde red, sync al reconectar.|
|Docker desde el día 1 | Dev, staging y prod con el mismo entorno.|


---


## 2. STACK TECNOLÓGICO

### Frontend (apps/web) — PWA

|Librería / Herramienta | Uso|
|---|---|
|React 18 + Vite 5 | UI declarativa, HMR rápido.|
|TypeScript 5 | Tipado estático.|
|TailwindCSS 3 | Utilidades CSS, tokens en tailwind.config.ts.|
|Zustand 4 | Estado global.|
|TanStack Query 5 | Cache y server-state.|
|React Hook Form 7 + Zod 3 | Formularios y validación.|
|Socket.io-client 4 | WebSocket en tiempo real.|
|Vite PWA Plugin | Service Worker, manifest, instalable en tableta.|
|Recharts 2 | Gráficos del panel admin.|
|date-fns 3 | Manejo de fechas y tiempos.|

### Backend (apps/api)

|Tecnología | Uso|
|---|---|
|Node.js 20 LTS + Fastify 4 | HTTP server + WebSocket.|
|TypeScript 5 | Tipos compartidos con frontend.|
|Prisma 5 + PostgreSQL 16 | ORM, migraciones, queries type-safe.|
|Redis 7 | Sesiones JWT, Socket.io adapter, BullMQ.|
|Socket.io 4 | Notificaciones en tiempo real.|
|BullMQ 5 | Jobs async (recordatorios, reportes).|
|JWT + bcrypt | Auth stateless + hash de contraseñas.|
|Zod 3 | Validación de request body.|

### Infraestructura

|Herramienta | Rol|
|---|---|
|Docker + Docker Compose | Contenedores: api, frontend, db, redis, nginx.|
|Nginx | Reverse proxy, SSL, proxy WebSocket.|
|GitHub Actions | CI/CD: lint, tests, build, deploy.|


---


## 3. MODELO DE BASE DE DATOS

Diseño relacional (3NF), PostgreSQL 16, UUIDs como PKs.


### 3.1 Enums

```
UserRole:        admin | waiter | chef
TableStatus:     free | occupied | reserved
WaiterMode:      free | assigned
OrderType:       dine_in | delivery
OrderStatus:     pending | in_prep | ready | delivered | cancelled
ItemStatus:      pending | in_prep | ready | served
InvoiceStatus:   pending | paid | voided
PaymentMethod:   cash | card | yape | plin | other
IngredientStatus: ok | low | critical | out
CategoryType:    food | drink | other
DispatchArea:    kitchen | bar | waiter   ← CENTRAL (ver sección 4)
SocketEventType: ORDER_CREATED | ADDITIONAL_ORDER_CREATED | ITEM_STARTED |
                 ITEM_READY | WAITER_NOTIFIED | ITEM_DELIVERED |
                 SHIFT_OPENED | SHIFT_CLOSED
JourneyStatus:   open | closed
```

**Nunca cambiar los valores string de estos enums en producción.**


### 3.2 Entidades

**users**

|Campo | Tipo | Descripción|
|---|---|---|
|id | UUID PK | |
|name | VARCHAR(100) | |
|email | VARCHAR(150) UNIQUE | |
|password_hash | TEXT | bcrypt|
|role | UserRole | admin / waiter / chef|
|is_active | BOOLEAN | |
|must_change_password | BOOLEAN | Forzar cambio en primer login|
|created_at | TIMESTAMPTZ | |


**tables**

|Campo | Tipo | Descripción|
|---|---|---|
|id | UUID PK | |
|number | INT UNIQUE | Número visible|
|capacity | INT | |
|status | TableStatus | free / occupied / reserved|
|section | VARCHAR(50) NULL | Salón, terraza, etc.|


**waiter_sessions / waiter_session_tables**

Turno del mesero. Una sesión puede tener N mesas (N:M via `waiter_session_tables`).

|Campo | Tipo | Descripción|
|---|---|---|
|waiter_id | UUID FK → users | |
|mode | WaiterMode | free / assigned|
|started_at / ended_at | TIMESTAMPTZ | |


**menu_categories**

|Campo | Tipo | Descripción|
|---|---|---|
|type | CategoryType | food / drink / other|
|sort_order | INT | Orden visual|


**menu_items** ← campos clave para DispatchArea

|Campo | Tipo | Descripción|
|---|---|---|
|base_price | DECIMAL(10,2) | |
|prep_time_minutes | INT DEFAULT 10 | |
|is_available | BOOLEAN | Activo hoy|
|is_featured | BOOLEAN | Plato estrella|
|is_direct_ingredient | BOOLEAN | Sin receta, ítem de stock directo|
|requires_preparation | BOOLEAN DEFAULT true | False = va al mesero directo|
|dispatch_area | DispatchArea DEFAULT kitchen | Destino al ordenar|


**ingredients / recipes / daily_menus**

Sin cambios respecto al diseño original. Ver schema.prisma para detalle.


**orders**

|Campo | Tipo | Descripción|
|---|---|---|
|order_number | SERIAL | Número visible|
|table_id | UUID FK NULL | NULL si delivery|
|waiter_id | UUID FK | |
|type | OrderType | dine_in / delivery|
|status | OrderStatus | |
|is_additional | BOOLEAN | Segunda ronda de una mesa|
|parent_order_id | UUID FK NULL | Referencia al pedido original|

> Los ítems se despachan a cocina/bar según su `assigned_area` al crear el pedido.
> El flujo exacto depende del modo de pago elegido (ver sección 5).


**order_items** ← campos clave

|Campo | Tipo | Descripción|
|---|---|---|
|status | ItemStatus | pending / in_prep / ready / served|
|assigned_area | DispatchArea | kitchen / bar / waiter — copiado de menu_item|
|assigned_chef_id | UUID FK NULL | Quién tomó el ítem|
|prep_started_at | TIMESTAMPTZ NULL | Cuando empieza preparación|
|prep_finished_at | TIMESTAMPTZ NULL | Cuando termina|
|notified_at | TIMESTAMPTZ NULL | Cuando se notificó al mesero|
|delivered_at | TIMESTAMPTZ NULL | Cuando el mesero lo recogió|

> Cuando **todos** los `order_items` tienen `status = served` → `order.status = delivered` automáticamente.


**invoices** — Registro manual post-servicio

|Campo | Tipo | Descripción|
|---|---|---|
|order_id | UUID UNIQUE | Una factura por pedido|
|invoice_number | VARCHAR(30) UNIQUE | Correlativo|
|subtotal / tax / total | DECIMAL | |
|status | InvoiceStatus | pending / paid / voided|
|payment_method | PaymentMethod | cash / card / yape / plin / other|
|paid_at | TIMESTAMPTZ NULL | |
|payment_reference | TEXT NULL | Referencia libre (voucher, N° operación)|

> **Sin integración con pasarela externa en el MVP.** El mesero registra el pago manualmente.
> Una factura `paid` es inmutable. No modificar nunca.


**suppliers / purchases / purchase_items**

Sin cambios. Gestión de compras de insumos.


**journey_sessions + journey_metrics** ← NUEVO

Representa una jornada operativa (un día de trabajo). El admin la abre y la cierra.

|Campo | Tipo | Descripción|
|---|---|---|
|status | JourneyStatus | open / closed|
|started_at / ended_at | TIMESTAMPTZ | |
|started_by_id / ended_by_id | UUID FK → users | |

`journey_metrics` acumula datos incrementalmente durante la jornada (crash-safe):

|Campo | Descripción|
|---|---|
|orders_completed | Pedidos entregados en la jornada|
|items_prepared | Ítems despachados|
|total_revenue | Ingresos acumulados|
|avg_prep_time_secs | Promedio de tiempo de preparación|
|item_breakdown | JSON: `{ [menuItemId]: { name, count, totalPrepSecs, totalRevenue } }`|
|hourly_breakdown | JSON: `{ "14": { orders: 3, revenue: "120.00" } }`|


**system_settings** ← NUEVO

Configuración del sistema como clave/valor persistente en BD.

|key (PK) | value | Ejemplos|
|---|---|---|
|notification_reminder_minutes | "3" | Tiempo de recordatorio|
|kitchen_timer_alert_minutes | "15" | Umbral de timer rojo|
|tax_rate | "0.18" | IGV|


**socket_events** ← NUEVO (audit log)

Registro inmutable de todos los eventos de socket. Para trazabilidad y debugging.

|Campo | Tipo|
|---|---|
|type | SocketEventType|
|order_id / item_id / user_id | UUID NULL|
|payload | JSONB|
|created_at | TIMESTAMPTZ|


**notifications / calendar_events**

Sin cambios respecto al diseño original.


### 3.3 Diagrama de Relaciones

```
users (1)──< waiter_sessions (1)──< waiter_session_tables >── tables
tables (1)──< orders (1)──< order_items >── menu_items
orders (1)──< invoice
menu_items (1)──< recipes >── ingredients
ingredients (1)──< purchase_items >── purchases ── suppliers
orders (self-ref): is_additional → parent_order_id
daily_menus >── menu_items
journey_sessions (1)──< journey_metrics
```


---


## 4. LÓGICA CENTRAL: DISPATCH AREA

**Esta es la decisión arquitectónica más importante del sistema.**

Cada `MenuItem` tiene un `dispatch_area` que determina a qué pantalla va el ítem cuando se ordena. Al crear un `OrderItem`, se copia el valor en `assigned_area`.

```
DispatchArea:
  kitchen → Pantalla de cocina  (platos, preparaciones calientes)
  bar     → Pantalla de bar     (bebidas elaboradas, cócteles, jugos)
  waiter  → Sin pantalla        (ítems sin preparación: agua, delivery en caja, etc.)
```

### Reglas de dispatch

| `dispatch_area` | `requires_preparation` | `is_direct_ingredient` | Comportamiento|
|---|---|---|---|
| `kitchen` | `true` | `false` | Va a la cola de cocina. El chef lo reclama y prepara.|
| `bar` | `true` | `false` | Va a la cola de bar. El barman lo prepara.|
| `waiter` | `false` | `true` o `false` | No aparece en cocina ni bar. El mesero lo despacha directamente.|

### Configuración en el menú

El admin configura `dispatch_area` al crear o editar un `MenuItem`. No se puede cambiar por pedido individual. Si un ítem necesita reasignarse, se edita el menú.

### Impacto en las interfaces

- **Pantalla Cocina**: filtra `order_items WHERE assigned_area = 'kitchen'`
- **Pantalla Bar**: filtra `order_items WHERE assigned_area = 'bar'`
- **Vista Mesero**: recibe notificación cuando un ítem de `kitchen` o `bar` está `ready`. Los ítems con `assigned_area = 'waiter'` se marcan `ready` automáticamente al crear el pedido.


---


## 5. FLUJOS DE PAGO

**No hay integración con pasarela de pago externa en el MVP.** Los pagos son registros manuales.

El mesero elige el modo de pago al confirmar el pedido:


> **Regla invariante**: el pedido **siempre** se despacha a cocina/bar en el momento de creación
> (`POST /orders`), independientemente del estado de pago. La jornada debe estar abierta —
> sin `JourneySession` activa el endpoint devuelve 403.

### Flujo A — "Pagar ahora"

```
Mesero confirma pedido
  ↓
POST /orders → crea Order + OrderItems → despacha INMEDIATAMENTE a cocina/bar
POST /invoices → crea Invoice con status = 'pending'
  ↓
Pantalla de elección: "Pagar ahora / Pagar después"
  ↓
Mesero elige "Pagar ahora" → abre PaymentModal
  ↓
Mesero selecciona método y referencia opcional
POST /invoices/:id/pay → Invoice.status = 'paid', paid_at = now()
```

El pago se registra inmediatamente después de crear el pedido, mientras cocina ya trabaja.


### Flujo B — "Pagar después"

```
Mesero confirma pedido
  ↓
POST /orders → crea Order + OrderItems → despacha INMEDIATAMENTE a cocina/bar
POST /invoices → crea Invoice con status = 'pending'
  ↓
Pantalla de elección: "Pagar ahora / Pagar después"
  ↓
Mesero elige "Pagar después" → vuelve al tablero de mesas
  ↓
Mesa muestra badge "Falta pagar" (invoice.status = 'pending')
  ↓
Al finalizar el servicio: mesero abre la mesa → registra pago
POST /invoices/:id/pay → Invoice.status = 'paid'
```

El pedido ya está en cocina con tag visual de pago pendiente. No bloquea la preparación.


### Registro de pago

En ambos flujos, el registro es idéntico:
- Método de pago: `cash | card | yape | plin | other`
- Referencia opcional: número de operación, voucher, referencia Yape, etc. (`payment_reference`)
- Una vez `paid`, la factura es **inmutable**. Nunca modificar.
- Pedidos adicionales generan una nueva `Invoice` separada.


---


## 6. INTERFAZ COCINA

**Dispositivo**: pantalla grande fija (TV 40"–55" o tablet 10") · Dark mode · Sin login propio (PIN de turno)

Muestra exclusivamente `order_items` con `assigned_area = 'kitchen'`.


### 6.1 Cola de tarjetas

- Ordenadas por `created_at` ASC (FIFO).
- Los adicionales aparecen al final con tag **ADICIONAL**.
- Pedidos con `invoice.status = 'pending'` muestran tag **⏳ PAGO PENDIENTE**.


### 6.2 Estados de tarjeta

|Estado | Visual|
|---|---|
|Sin empezar | Borde gris · Timer rojo si supera umbral configurable|
|En preparación | Borde azul · Timer desde inicio de prep|
|Listo | Borde verde · Notificación push al mesero|
|Adicional | Borde naranja · Tag ADICIONAL|
|Delivery | Tag DELIVERY|
|Pago pendiente | Badge ⏳ sobre la tarjeta|

### 6.3 Acciones del cocinero

- **Tomar ítem** → `item:claim` → `ItemStatus = in_prep`, `prep_started_at = now()`
- **Marcar listo** → `item:ready` → `ItemStatus = ready`, `prep_finished_at = now()`

### 6.4 Reglas UI

- Wake Lock API: pantalla siempre activa.
- Fondo `#0F1A24` (dark mode forzado).
- Fuente mínima 24px para lectura a distancia.
- Botones táctiles mínimo 48×48px.
- Sin animaciones distractoras.


---


## 7. INTERFAZ BAR

**Dispositivo**: tablet o monitor en la barra · Puede compartir layout con cocina o ser pantalla independiente

Muestra exclusivamente `order_items` con `assigned_area = 'bar'`. Misma lógica de tarjetas que cocina.

### Diferencias respecto a cocina

- El "barman" reclama ítems igual que el chef.
- Los tiempos de preparación suelen ser más cortos.
- Un ítem de bar puede marcarse listo independientemente de los platos del mismo pedido.
- Visualmente puede tener tema diferente (aún a definir con el cliente).


---


## 8. INTERFAZ MESERO

**Dispositivo**: tablet 10"–12" · PWA instalable · Landscape recomendado

### 8.1 Autenticación y turno

- Login con email + PIN.
- JWT access token 15 min, refresh 8h (turno completo).
- Al ingresar: selector de modo (Asignado / Libre) + selección de mesas.

### 8.2 Flujo de toma de pedido

```
Paso 1 — Selección de platos (filtro: dispatch_area = kitchen)
Paso 2 — Selección de bebidas (filtro: dispatch_area = bar o waiter)
Paso 3 — Resumen + nota general
Paso 4 — Confirmación de pago (Pagar ahora / Pagar después)
Paso 5 — Pedido despachado a cocina/bar según flujo elegido
```

### 8.3 Pedidos adicionales

- Mesa con pedido activo → botón "Agregar más" → nuevo `Order` con `is_additional = true`.
- Nueva `Invoice` independiente (la original es inmutable si está `paid`).
- En cocina/bar llega con tag ADICIONAL al final de la cola.

### 8.4 Notificaciones

- Al recibir `order:item:ready`: notification push + badge en UI.
- Panel de notificaciones: pedidos listos con número de mesa y tiempo de espera.
- Recordatorio BullMQ: re-notifica si no se recoge en N minutos (configurable en `system_settings`).
- Al recoger: emite `item:served` → `deliveredAt = now()`.

### 8.5 ítems con dispatch_area = waiter

Estos ítems se marcan `ready` automáticamente al crear el pedido. El mesero los ve en su lista directamente sin esperar confirmación de cocina o bar.

### 8.6 Registro de pago posterior (Flujo B)

El mesero puede abrir cualquier pedido con `invoice.status = 'pending'` y registrar el pago al final del servicio. La UI muestra un indicador de deuda pendiente en la tarjeta de mesa.


---


## 9. INTERFAZ ADMINISTRADOR

**Dispositivo**: desktop / laptop · Login con rol `admin`

### 9.1 Tabs del panel

|Tab | Descripción|
|---|---|
|🏠 Inicio (Dashboard) | Jornada activa, menú del día, insumos críticos, ventas live.|
|📦 Insumos | Inventario, alertas, CRUD de ingredientes.|
|📋 Recetario | Gestión de menu_items, dispatch_area, recetas, costos.|
|📊 Reportes | Ventas, costos, márgenes, rendimiento de jornadas.|
|🛒 Compras | Registro de compras, proveedores, historial.|
|⚙️ Configuración | Usuarios, mesas, parámetros del sistema.|

### 9.2 Gestión de JourneySession

El admin abre una jornada al inicio del día. Al cerrarla, se consolidan las métricas finales.

- **Abrir jornada**: `POST /journey-sessions` → emite `SHIFT_OPENED` en `socket_events`
- **Cerrar jornada**: `PATCH /journey-sessions/:id/close` → emite `SHIFT_CLOSED`
- Las métricas se acumulan incrementalmente: cada pedido entregado actualiza `journey_metrics`.
- Si el sistema cae y se reinicia, las métricas no se pierden (crash-safe).

### 9.3 Tab Inicio — Dashboard

- Menú del día: checklist con opción de desactivar ítems sin insumos. Botón confirmar.
- Insumos críticos: tabla Insumo / Necesario hoy / Stock actual / A comprar / Estado.
- Seguimiento en tiempo real: KPIs de la jornada activa (ventas, órdenes, platos).
- Pedidos con pago pendiente: lista de `invoices` con `status = 'pending'` del día.

### 9.4 Tab Recetario — configuración de DispatchArea

El admin puede editar `dispatch_area` de cada `MenuItem`. Opciones: cocina / bar / mesero directo. También configura `requires_preparation` y `is_direct_ingredient`.

### 9.5 Tab Configuración

- Gestión de usuarios (crear, editar, desactivar).
- Gestión de mesas (número, capacidad, sección).
- Parámetros del sistema via `system_settings`: tiempo de recordatorio, umbral de timer rojo, tasa de impuesto.
- **No hay configuración de pasarela de pago** (MVP sin integración externa).


---


## 10. COMUNICACIÓN EN TIEMPO REAL

### 10.1 WebSocket Rooms

|Room | Quién se suscribe|
|---|---|
|`room:kitchen` | Pantalla de cocina|
|`room:bar` | Pantalla de bar|
|`room:waiter:{userId}` | Mesero específico|
|`room:admin` | Panel admin|

### 10.2 Eventos servidor → cliente

|Evento | Destino | Descripción|
|---|---|---|
|`order:created` | kitchen / bar | Nuevo pedido. Cada sala recibe solo sus ítems (`assigned_area`).|
|`order:additional` | kitchen / bar | Pedido adicional de una mesa.|
|`order:item:claimed` | kitchen / bar | Chef/barman tomó un ítem (incluye `autoClaimed: true` si fue auto-claim).|
|`order:item:ready` | kitchen / bar + `waiter:{id}` | Ítem listo: sala lo atenúa, mesero recibe notificación push (dine_in).|
|`order:ready` | `waiter:{id}` | **Solo delivery**: todos los ítems de producción listos → mesero embala.|
|`order:delivered` | kitchen + bar | Todos los ítems `served` → pedido completado, tarjeta sale de la cola.|
|`order:item:updated` | kitchen / bar | Mesero editó notas de un ítem en preparación. Badge ACTUALIZADO.|
|`table:updated` | `waiter:{id}` | Refresco de `TableDetail` (pago registrado, ítem claimed, etc.).|
|`journey:started` | waiter + admin | Jornada abierta por el admin.|
|`journey:ended` | waiter + admin | Jornada cerrada por el admin.|
|`stock:alert` | admin | Insumo bajó del umbral mínimo.|

### 10.3 Eventos cliente → servidor

|Evento | Emitido por | Descripción|
|---|---|---|
|`item:claim` | Cocina / Bar | Chef/barman reclama un ítem.|
|`item:ready` | Cocina / Bar | Ítem terminado, notificar al mesero.|
|`item:served` | Mesero | Mesero confirmó recojo.|

### 10.4 Audit log

Cada evento relevante genera un registro en `socket_events`. Permite trazar el ciclo completo de cualquier pedido para debugging y análisis.


---


## 11. FLUJO COMPLETO DE UN PEDIDO

```
1.  Mesero selecciona ítems (Platos → Bebidas → Resumen)
2.  POST /orders → crea Order + OrderItems
    → dispatchOrderToAreas() emite order:created a room:kitchen y/o room:bar
    → ítems con assignedArea='waiter' quedan ready automáticamente
3.  POST /invoices → crea Invoice con status='pending'
4.  Pantalla de elección: "Pagar ahora" o "Pagar después"

    ── Pagar ahora ──────────────────────────────────────────
5a. Mesero selecciona método y referencia
    POST /invoices/:id/pay → Invoice.status = 'paid'

    ── Pagar después ────────────────────────────────────────
5b. Mesero vuelve al tablero. Mesa muestra badge "Falta pagar".
    El cobro se registra más tarde con POST /invoices/:id/pay.
    ─────────────────────────────────────────────────────────

6.  Chef/barman: item:claim → order:item:claimed (o auto-claim al marcar listo)
7.  Chef/barman: item:ready → order:item:ready al mesero + pickup_reminder_queue
8.  Mesero: item:served → deliveredAt = now()
    → si todos los ítems = served: order.status = delivered
    → emite order:delivered a room:kitchen y room:bar
    → journeyService.recordDeliveredOrder() actualiza journey_metrics
```

> **Nota sobre delivery**: en el paso 7, el evento `order:ready` se emite al mesero
> solo cuando TODOS los ítems de producción (kitchen + bar) están listos,
> en lugar de notificar por ítem individual.


---


## 12. JOURNEY SESSION — JORNADA OPERATIVA

Cada día de operación tiene exactamente una `JourneySession` activa. Es el contenedor de métricas del día.

### Ciclo de vida

```
Admin abre jornada (SHIFT_OPENED)
  ↓
Operación normal del día
  ↓
Métricas se acumulan en journey_metrics con cada pedido completado
  ↓
Admin cierra jornada (SHIFT_CLOSED) → métricas finales consolidadas
```

### Métricas disponibles

- Total de pedidos completados en la jornada
- Ítems preparados por área (cocina / bar)
- Ingresos totales de la jornada
- Tiempo promedio de preparación
- Breakdown por ítem: qué se vendió más, tiempos por plato
- Breakdown por hora: picos de demanda

### Uso en admin

El tab Reportes puede mostrar jornadas pasadas y comparar métricas entre días. La jornada activa se actualiza en tiempo real vía WebSocket (`journey:metric` a `room:admin`).


---


## 13. ARQUITECTURA DOCKER Y ESTRUCTURA DE PROYECTO

### 13.1 Servicios

|Servicio | Rol|
|---|---|
|nginx | Reverse proxy, SSL, static files, proxy WS.|
|frontend | Vite build / dev server, puerto 3000.|
|api | Fastify, puerto 3001.|
|db | PostgreSQL 16, volumen persistente.|
|redis | Redis 7, BullMQ y Socket.io adapter.|
|pgadmin | Solo en dev, puerto 5050.|

### 13.2 Estructura del monorepo

```
/
├── apps/
│   ├── web/          ← React PWA (cocina, bar, mesero, admin)
│   └── api/          ← Fastify + Prisma
├── packages/
│   ├── shared/       ← Tipos TS compartidos (DTOs, enums)
│   └── ui/           ← Design system (tokens, componentes base)
├── infra/
│   ├── docker/       ← Dockerfiles
│   └── nginx/        ← nginx.conf
├── scripts/          ← Seeds, migraciones, utilidades
├── docs/             ← ARCHITECTURE.md, SESSIONS.md
├── docker-compose.yml
├── docker-compose.dev.yml
└── CLAUDE.md
```

### 13.3 Variables de entorno

|Archivo | Variables|
|---|---|
|`.env.api` | `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `ANTHROPIC_API_KEY`|
|`.env.frontend` | `VITE_API_URL`, `VITE_WS_URL`|

**Sin variables de pasarela de pago en el MVP.**
Nunca commitear `.env`; usar `.env.example` en el repo.


---


## 14. ALCANCE DEL MVP

### Fase 1 — Core (semana 1–2)

|✅ Fase 1|
|---|
|• Auth y roles (admin, waiter, chef)|
|• Gestión de mesas y turno de mesero|
|• Toma de pedidos con flujo de DispatchArea|
|• Dos flujos de pago: pagar ahora / pagar después|
|• Cola de cocina en tiempo real (room:kitchen)|
|• Cola de bar en tiempo real (room:bar)|
|• ítems waiter: despacho automático sin preparación|
|• Notificaciones de pedido listo al mesero|
|• Pedidos adicionales con segunda factura|
|• Tag Delivery en cocina y bar|
|• Tag ⏳ Pago Pendiente en cocina y bar|
|• JourneySession: abrir/cerrar jornada|
|• journey_metrics incrementales por jornada|

### Fase 2 — Admin y analítica (semana 3)

|🔵 Fase 2|
|---|
|• Dashboard admin: menú del día, KPIs, insumos críticos|
|• Reportes por jornada: breakdown por ítem y por hora|
|• CRUD de insumos, recetas, proveedores|
|• Registro de compras y actualización de stock|
|• Configuración de system_settings desde la UI|
|• Alertas de stock (stock:alert a room:admin)|

### Fase 3 — Pulido y producción (semana 4)

|🟡 Fase 3|
|---|
|• Tests E2E con Playwright (flujo completo)|
|• Stress test con k6 (30 pedidos concurrentes)|
|• PWA: service worker, manifest, instalable en tablet|
|• Nginx SSL + headers de seguridad|
|• Dockerfiles multi-stage para producción|
|• GitHub Actions: lint + tests en PR, E2E en merge|

### Fase futura — Post-MVP

|⬜ Futuro|
|---|
|• Integración con pasarela de pago (Culqi u otra) si el cliente lo requiere|
|• Predicción de demanda (ML / Python microservicio)|
|• Multi-sucursal (tenant_id en todas las tablas)|
|• Impresora de tickets ESC/POS|
|• Pantalla de estado para el cliente (QR en mesa)|
|• App nativa (React Native)|


---


## 15. SISTEMA DE DISEÑO

Los tokens de color y tipografía están definidos en:
- `packages/ui/src/tokens.ts` — fuente de verdad
- `apps/web/tailwind.config.ts` — extensión de Tailwind
- `apps/web/src/styles/globals.css` — variables CSS

Ver `CLAUDE.md` para los tokens de color actuales y la paleta "Brasas & Carbón".
**No hardcodear hexadecimales en componentes. Siempre usar los tokens.**


---


## 16. TESTING Y CALIDAD

|Herramienta | Uso|
|---|---|
|Vitest | Unit tests frontend y backend|
|React Testing Library | Tests de componentes|
|Playwright | E2E: flujo completo mesero → cocina → bar → admin|
|Supertest + Fastify inject | Tests de API|
|k6 | Stress: 30 pedidos concurrentes, notificaciones < 3s|

### Coverage mínimo por módulo

|Módulo | Objetivo|
|---|---|
|Lógica de pedidos y DispatchArea | 90%|
|Cálculo de costos y métricas de jornada | 90%|
|Autenticación y roles | 85%|
|Rutas API (happy path + errores) | 85%|
|Componentes UI críticos (flujo de pedido) | 80%|


---


## 17. DECISIONES PENDIENTES

|Pregunta | Impacto|
|---|---|
|¿Integración con pasarela de pago en futuro? | Si sí: Culqi para mercado peruano. Afecta Invoice y flujo de pago.|
|¿Factura electrónica SUNAT? | Si sí: integrar con OSE/PSE (ej. Nubefact). Cambia estructura de Invoice.|
|¿El Bar tiene login propio o comparte sesión con cocina? | Afecta autenticación de la pantalla de bar.|
|¿Impresora de tickets? | ESC/POS (Epson, Star). Recomendado para Fase futura.|
|¿Cuántos cocineros/barmans simultáneos? | Afecta UI de cocina y bar (1 pantalla compartida vs 1 por persona).|
|¿Modelo SaaS o instalación única? | Si SaaS: `tenant_id` en todas las tablas.|


---

*Versión 2.0 — Revisión post-implementación: DispatchArea, JourneySession, flujos de pago manuales*
*Actualizar este documento en cada PR que cambie la arquitectura o el schema.*
