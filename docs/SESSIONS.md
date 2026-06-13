SAS RESTAURANTES

Guía de Implementación con Claude Code

SESSIONS.md · Plan de Sesiones · Skills · Contexto Rápido


|🍳  Cocina Dark mode · Pantalla grande | 🍹  Bar Cola de bebidas · Misma lógica | 🧑‍💼  Mesero PWA · Tableta táctil | 📊  Admin Dashboard · Desktop|
|---|---|---|---|



## 1. El archivo CLAUDE.md

El archivo CLAUDE.md es la memoria persistente del proyecto para Claude Code. Se coloca en la raíz del repositorio y es leído automáticamente al inicio de cada sesión de trabajo.


|¿Qué contiene el CLAUDE.md de este proyecto?|
|---|
|→  Contexto del negocio: 4 interfaces (Cocina, Bar, Mesero, Admin)|
|→  Stack tecnológico con versiones exactas|
|→  Estructura de carpetas del monorepo|
|→  Enums y tipos de BD que nunca deben cambiar en producción|
|→  DispatchArea: lógica central de routing de ítems|
|→  JourneySession: reglas de jornada operativa|
|→  Flujo de pago manual (sin pasarela externa en MVP)|
|→  Reglas de negocio críticas numeradas (pedidos, inventario, menú)|
|→  Convenciones de naming y estructura de módulos|
|→  Tokens de color del design system|
|→  Comandos del proyecto (dev, test, docker, prisma)|
|→  Lista de restricciones duras (qué NUNCA hacer)|
|→  Estrategia de Skills y MCP (futuros módulos de IA)|


---


## 2. Plan de Sesiones — Claude Code

Cada sesión tiene un scope pequeño y entregable verificable.
No saltar sesiones. Cada una asume que la anterior está mergeada a main.


### FASE 0 — Esqueleto del Proyecto ✅ COMPLETADA

Antes de escribir una sola línea de feature, el proyecto debe arrancar y tener CI verde.


### Sesión 0.1 — Monorepo + Docker ✅


|Prompt para Claude Code|
|---|
|→  Inicializa un monorepo con pnpm workspaces. Estructura: /apps/web (React 18 + Vite + TypeScript), /apps/api (Fastify + TypeScript), /packages/shared (tipos TS), /packages/ui (componentes vacíos).|
|→  Crea docker-compose.yml con servicios: nginx, frontend (3000), api (3001), db (PostgreSQL 16), redis (Redis 7), pgadmin (5050, solo dev).|
|→  Crea docker-compose.dev.yml que sobreescribe con volúmenes de desarrollo y hot reload.|
|→  Configura ESLint + Prettier + TypeScript strict mode en todos los workspaces.|
|→  El comando "pnpm dev" debe levantar todo.|



* ✅ Criterio de éxito: docker-compose up arranca sin errores. "Hello from API" en localhost:3001/health

### Sesión 0.2 — Schema de Base de Datos ✅


|Prompt para Claude Code|
|---|
|→  En apps/api, inicializa Prisma con PostgreSQL. Crea el schema completo con las entidades del CLAUDE.md.|
|→  Incluir enums: UserRole, TableStatus, WaiterMode, OrderType, OrderStatus, ItemStatus, InvoiceStatus, PaymentMethod, IngredientStatus, CategoryType, DispatchArea, JourneyStatus, SocketEventType.|
|→  Todos los IDs como UUID con @default(uuid()). Timestamps en todas las tablas.|
|→  Crea la migración inicial: prisma migrate dev --name init.|
|→  Crea seed con: 1 admin, 2 meseros, 2 chefs, 8 mesas, 10 menu_items (5 kitchen, 3 bar, 2 waiter), 15 ingredientes, recetas básicas.|
|→  Exportar tipos generados por Prisma al package @sas/shared.|



* ✅ Criterio de éxito: pnpm db:seed corre sin errores. Datos visibles en pgAdmin.

### Sesión 0.3 — Autenticación ✅


|Prompt para Claude Code|
|---|
|→  Implementa auth en apps/api con JWT. Rutas: POST /auth/login, POST /auth/refresh, POST /auth/logout.|
|→  Access token: 15 min. Refresh token: 8h, guardado en Redis con key refresh:{userId}:{tokenId}.|
|→  Middleware requireRole(roles: UserRole[]). Aplícalo como preHandler hook.|
|→  Hashear contraseñas con bcrypt (salt rounds: 12). Campo mustChangePassword para primer login.|
|→  Validación de body con Zod en todas las rutas.|
|→  Tests unitarios para el servicio de auth y tests de integración para las 3 rutas.|



* ✅ Criterio de éxito: login retorna tokens válidos. Ruta protegida retorna 401 sin token. Tests en verde.

---


### FASE 1 — Ciclo Completo de Pedido ✅ COMPLETADA


### Sesión 1.1 — API de Pedidos ✅


|Prompt para Claude Code|
|---|
|→  Implementa el módulo orders en apps/api: orders.routes.ts, orders.service.ts, orders.repository.ts, orders.schema.ts.|
|→  Rutas: POST /orders, GET /orders, GET /orders/:id, PATCH /orders/:id/status, POST /orders/:id/items, PATCH /orders/:orderId/items/:itemId.|
|→  POST /orders: verificar que hay una JourneySession abierta (403 si no). Crear Order + OrderItems. Copiar dispatchArea del MenuItem al OrderItem.assignedArea. Despachar INMEDIATAMENTE a cocina/bar (el pago no bloquea el despacho).|
|→  Regla auto-delivered: cuando todos los order_items tienen status='served', actualizar order.status='delivered'.|
|→  Pedidos adicionales: recibir parentOrderId, setear is_additional=true.|
|→  Tests de integración para el happy path completo.|



* ✅ Criterio de éxito: CRUD de pedidos funciona. La regla auto-delivered pasa sus tests. Dispatch inmediato verificado.

### Sesión 1.2 — WebSocket Server ✅


|Prompt para Claude Code|
|---|
|→  Configura Socket.io 4 en apps/api con el adapter de Redis.|
|→  Rooms: room:kitchen, room:bar, room:waiter:{userId}, room:admin.|
|→  Eventos server→client: order:created, order:additional, order:item:claimed, order:item:ready, order:ready (solo delivery), order:delivered, order:item:updated, table:updated, journey:started, journey:ended, stock:alert.|
|→  Eventos client→server: item:claim, item:ready (con auto-claim si el ítem estaba pending), item:served (cancela BullMQ reminder).|
|→  Al crear un pedido (POST /orders), emitir inmediatamente a room:kitchen los ítems kitchen y a room:bar los ítems bar.|
|→  Al completar un pedido (todos served), emitir order:delivered a room:kitchen y room:bar.|
|→  Autenticación WebSocket: validar JWT en el handshake.|
|→  Audit log: registrar en socket_events cada evento relevante (fire-and-forget).|



* ✅ Criterio de éxito: pedido creado llega a cocina y bar según assignedArea. order:delivered saca la tarjeta de la cola.

### Sesión 1.3 — Frontend: Design System Base ✅


|Prompt para Claude Code|
|---|
|→  En packages/ui, configura el design system con tokens.ts.|
|→  Configura Tailwind en apps/web: primary=#1B2B3A, secondary=#C8410A, accent=#E8A838, surface=#FAFAF8, dark=#0F1A24.|
|→  Componentes base: Button (variants: primary/secondary/ghost/danger), Badge, Card, Spinner, Tag.|
|→  Tag con variantes: pending, in_prep, ready, additional, delivery.|
|→  Todos accesibles: aria-labels, focus visible, área táctil mínima 48px.|



* ✅ Criterio de éxito: componentes renderizan con los colores del brand. Ningún color hardcodeado.

### Sesión 1.4 — Interfaz Cocina ✅


|Prompt para Claude Code|
|---|
|→  Ruta /kitchen. Dark mode forzado (bg: #0F1A24). Wake Lock API activo.|
|→  KitchenCard: número de pedido, tipo (MESA/DELIVERY), lista de ítems kitchen con notas, timer desde creación, borde coloreado por estado.|
|→  Cola: grid ordenado por created_at ASC. Adicionales al final. Dos zonas: 'active' (pending/in_prep) y 'ready' (todos listos, esperando al mesero).|
|→  Suscribirse a room:kitchen. Eventos: order:created agrega tarjeta, order:item:claimed actualiza estado, order:item:updated muestra badge "ACTUALIZADO", order:delivered elimina la tarjeta.|
|→  Botones por ítem: "Tomar" → item:claim. "Listo" → item:ready.|
|→  Timer en rojo si el pedido lleva más de 15 minutos sin empezar.|



* ✅ Criterio de éxito: pedido creado desde API aparece en pantalla en < 1 segundo.

### Sesión 1.5 — Interfaz Bar ✅


|Prompt para Claude Code|
|---|
|→  Ruta /bar. Misma lógica y componentes que cocina — reutilizar KitchenCard como BarCard.|
|→  Suscribirse a room:bar. Los eventos y comportamientos son idénticos a cocina.|
|→  Solo muestra order_items con assignedArea = 'bar'.|
|→  Los tipos de bar re-exportan los tipos de kitchen (ya implementado en bar/types.ts).|
|→  El barman puede marcar ítems listos independientemente de cocina.|



* ✅ Criterio de éxito: bebida elaborada llega a pantalla de bar. Plato va a cocina. Ambos operan independientemente.

### Sesión 1.6 — Interfaz Mesero: Flujo de Pedido ✅


|Prompt para Claude Code|
|---|
|→  Login screen con email + PIN. Al ingresar: selector de modo (Asignado/Libre) + selección de mesas. Mesas ocupadas por otro mesero: deshabilitadas.|
|→  Tablero de mesas: grid con tarjeta por mesa. Badge "Falta pagar" si invoice.status='pending'. Badge de ítems listos pendientes de recoger.|
|→  Flujo de nuevo pedido: Paso 1 Platos (filtro food), Paso 2 Bebidas (filtro drink), Paso 3 Resumen + nota general.|
|→  Al confirmar resumen: POST /orders (despacho inmediato a cocina/bar) + POST /invoices (status='pending').|
|→  Pantalla de elección post-pedido: "Pagar ahora" → PaymentModal, "Pagar después" → vuelve al tablero.|
|→  Tap en mesa con pedido activo: ver detalle con estado de cada ítem. Botón "Agregar más" → is_additional=true.|
|→  Botón flotante "+ Delivery" para pedidos sin mesa.|
|→  Suscribirse a room:waiter:{id}: order:item:ready → notificación push + badge, table:updated → refrescar detalle.|



* ✅ Criterio de éxito: flujo completo platos→bebidas→resumen→cobro en < 3 minutos.

### Sesión 1.7 — Registro de Pago Manual ✅


|Prompt para Claude Code|
|---|
|→  PaymentModal: selección de método (cash / card / yape / plin). Campo de referencia opcional para card/QR (N° operación, voucher).|
|→  POST /invoices/:id/pay → marca invoice.status='paid', paid_at=now(), emite table:updated al mesero.|
|→  Sin integración con pasarela externa: el mesero registra lo que el cliente pagó. El sistema solo almacena el método y la referencia.|
|→  En la tarjeta de mesa: badge "Falta pagar" si invoice.status='pending', desaparece al pagar.|
|→  El historial de pagos del día es visible en el tab Ventas del admin.|
|→  Regla inmutable: si invoice.status='paid', rechazar cualquier intento de modificación (409).|



* ✅ Criterio de éxito: cobro registrado en < 10 segundos. Invoice paid es inmutable. Badge desaparece en tiempo real.

### Sesión 1.8 — Notificaciones al Mesero ✅


|Prompt para Claude Code|
|---|
|→  Al recibir order:item:ready: mostrar Notification API del browser + badge rojo en UI.|
|→  Panel de notificaciones: lista de ítems listos con nombre del plato, mesa y tiempo de espera.|
|→  Al tocar notificación: navegar a la tarjeta de mesa correspondiente.|
|→  Recordatorio BullMQ: si un ítem ready no es recogido en 3 min, re-notificar (isReminder: true).|
|→  Al confirmar recojo: item:served → cancela el job BullMQ (jobId: reminder-{itemId}).|
|→  Para delivery: esperar order:ready (todos los ítems de producción listos) antes de notificar.|



* ✅ Criterio de éxito: notificación en < 2 segundos. Reminder cancelado correctamente al servir.

---


### FASE 2 — Panel Admin Básico ✅ COMPLETADA


### Sesión 2.1 — JourneySession + Dashboard del Día ✅


|Prompt para Claude Code|
|---|
|→  Módulo journey en apps/api: journey.routes.ts, journey.service.ts, journey.repository.ts.|
|→  POST /journey-sessions (abrir jornada) → emite journey:started a room:waiter y room:admin. Registra SHIFT_OPENED en socket_events.|
|→  PATCH /journey-sessions/:id/close → emite journey:ended. Registra SHIFT_CLOSED.|
|→  GET /journey/current → retorna la jornada abierta o null (usada por el mesero al montar).|
|→  journeyService.recordDeliveredOrder(): actualiza journey_metrics incrementalmente al completar un pedido.|
|→  Ruta /admin/dashboard. Layout con tabs: Inicio, Insumos, Recetario, Reportes/Ventas, Compras, Configuración.|
|→  Tab Inicio: estado de jornada activa, menú del día (checklist), KPIs en tiempo real, insumos críticos, pedidos con pago pendiente.|



* ✅ Criterio de éxito: abrir jornada desbloquea el sistema para el mesero. KPIs se actualizan en tiempo real.

### Sesión 2.2 — Gestión de Insumos y Recetario ✅


|Prompt para Claude Code|
|---|
|→  Tab Insumos: tabla paginada con filtros por estado y búsqueda. CRUD completo.|
|→  Modal de alertas al entrar: ingredientes critical/out usados en el menú de hoy.|
|→  Tab Recetario: grid de menu_items con imagen, nombre, costo calculado. Click para ver receta detallada.|
|→  CRUD de menu_items. Incluir campo dispatchArea (kitchen/bar/waiter) y requires_preparation.|
|→  Al editar, recalcular costo de receta automáticamente.|
|→  Filtros: Todos / Platos (kitchen) / Bebidas (bar) / Directo (waiter).|



* ✅ Criterio de éxito: admin puede cambiar dispatchArea de un ítem. El cambio afecta el routing de futuros pedidos.

### Sesión 2.3 — Reportes, Ventas y Compras ✅


|Prompt para Claude Code|
|---|
|→  Tab Reportes/Ventas: KPIs con filtro temporal (Hoy/Semana/Mes/Año). Ingresos, Costos, Ganancias, Margen.|
|→  Gráfico de métodos de pago (pie chart con Recharts). Top 3 platos más vendidos.|
|→  Resumen de jornadas: métricas de journey_metrics por día (orders_completed, avg_prep_time, item_breakdown, hourly_breakdown).|
|→  Tab Compras: formulario de compra (proveedor + lista de ingredientes). Al confirmar: actualizar stock.|
|→  Tabla de compras agrupadas por proveedor. CRUD de proveedores.|



* ✅ Criterio de éxito: reportes muestran datos reales del día. Stock se actualiza al registrar compra.

### Sesión 2.4 — Configuración y Roles ✅


|Prompt para Claude Code|
|---|
|→  Tab Configuración: tabla de usuarios con nombre, email, rol, activo/inactivo.|
|→  Crear usuario: nombre, email, contraseña temporal, rol. mustChangePassword=true en primer login.|
|→  Gestión de mesas: CRUD con número, capacidad, sección.|
|→  Parámetros via system_settings: tiempo de recordatorio (default 3 min), umbral timer rojo (default 15 min), tasa de impuesto.|



* ✅ Criterio de éxito: admin puede crear un mesero que puede loguearse inmediatamente. Settings persisten en BD.

---


### FASE 3 — Pulido y Producción

Tests de extremo a extremo y deploy production-ready.


### Sesión 3.1 — Tests E2E y Stress


|Prompt para Claude Code|
|---|
|→  Tests E2E con Playwright: flujo completo admin abre jornada → mesero login → toma pedido → elige pagar después → pedido llega a cocina y bar → chef/barman marcan listo → mesero recoge → mesero registra cobro.|
|→  Test de estrés con k6: 30 pedidos concurrentes. El sistema debe mantenerse estable y notificaciones llegar en < 3 segundos bajo carga.|
|→  Configurar GitHub Actions: lint + type-check + unit tests en cada PR, E2E en merge a main.|



* ✅ Criterio de éxito: flujo E2E pasa. k6 sin errores al 30 pedidos concurrentes.

### Sesión 3.2 — PWA y Deploy


|Prompt para Claude Code|
|---|
|→  Configurar Vite PWA Plugin: service worker, manifest.json con iconos iOS y Android, modo standalone.|
|→  Service worker: cachear assets estáticos. Los requests API no se cachean.|
|→  Nginx: SSL (Let's Encrypt), gzip, headers de seguridad (CSP, HSTS).|
|→  Dockerfiles multi-stage para producción (api y frontend).|
|→  Variables de entorno documentadas en .env.example. Sin keys de pasarela en el MVP.|
|→  README con instrucciones de deploy desde cero.|



* ✅ Criterio de éxito: app instalable en Android/iOS. Deploy en VPS desde cero en < 30 minutos.

---


### FASE 4 — INTEGRACIÓN DE AGENTES (Skills / MCP)

Extensión del sistema con agentes de IA especializados por dominio.
Cada módulo MCP expone herramientas tipadas que Claude puede usar como contexto en sesiones de trabajo.
Los agentes son **read-only** por defecto; las escrituras requieren confirmación explícita del usuario.


### Sesión 4.1 — Agente de Analítica de Jornadas (`analytics.mcp.ts`)


|Prompt para Claude Code|
|---|
|→  Crear apps/api/src/mcp/analytics.mcp.ts.|
|→  Herramientas: getJourneyMetrics(sessionId), compareJourneys(fromDate, toDate), getHourlyBreakdown(sessionId), getTopItems(limit).|
|→  Contexto: lee JourneyMetrics, invoice history, item_breakdown y hourly_breakdown.|
|→  Registrar el módulo en el servidor MCP de la API.|
|→  Usar prompt caching para el contexto de jornadas (conversaciones largas).|



* Criterio de éxito: Claude puede responder "¿cuál fue el plato más vendido esta semana?" leyendo datos reales.
* Prioridad: ALTA — usa JourneyMetrics ya implementado, bajo esfuerzo.

### Sesión 4.2 — Agente de Inventario (`inventory.mcp.ts`)


|Prompt para Claude Code|
|---|
|→  Crear apps/api/src/mcp/inventory.mcp.ts.|
|→  Herramientas: getLowStockIngredients(), getReplenishmentList(menuDate), getPurchaseHistory(supplierId), estimateReorderCost().|
|→  Contexto: ingredient.status, purchase history, recipe quantities, daily_menus.|
|→  El agente nunca modifica stock directamente; sugiere y el admin confirma.|



* Criterio de éxito: Claude puede generar una lista de compras del día con costos estimados.
* Prioridad: ALTA — datos ya disponibles.

### Sesión 4.3 — Agente de Menú y Costos (`menu.mcp.ts`)


|Prompt para Claude Code|
|---|
|→  Crear apps/api/src/mcp/menu.mcp.ts.|
|→  Herramientas: getMenuItemCost(menuItemId), getMarginAnalysis(), suggestPriceAdjustments(), getPopularityRanking().|
|→  Contexto: recipe × ingredient.unitCost, sales history, daily_menus.|
|→  Requiere historial mínimo de 2 semanas de ventas para sugerencias útiles.|



* Criterio de éxito: Claude puede identificar los platos con menor margen y sugerir ajuste de precio.
* Prioridad: MEDIA — requiere suficiente historial.

### Sesión 4.4 — Agente de Demanda (`demand.mcp.ts`)


|Prompt para Claude Code|
|---|
|→  Crear apps/api/src/mcp/demand.mcp.ts.|
|→  Herramientas: predictDemandForDate(date), getCalendarContext(date), suggestStaffingLevels().|
|→  Contexto: calendar_events, hourly_breakdown histórico, day-of-week patterns.|
|→  Modelo simple: regresión por día de semana + factor eventos. Sin ML externo en esta sesión.|



* Criterio de éxito: predicción de clientes para el día siguiente con ± 20% de error.
* Prioridad: BAJA — requiere meses de historial.

### Sesión 4.5 — Agente de Compras (`purchasing.mcp.ts`)


|Prompt para Claude Code|
|---|
|→  Crear apps/api/src/mcp/purchasing.mcp.ts.|
|→  Herramientas: compareSupplierPrices(), getSupplierHistory(supplierId), flagPriceAnomalies().|
|→  Contexto: purchase_items history, ingredient.unitCost trend, suppliers.|
|→  Opcionalmente: búsqueda web para comparar precios de mercado (requiere ANTHROPIC_API_KEY con tool_use).|



* Criterio de éxito: Claude detecta si un insumo está siendo comprado a un precio fuera de rango.
* Prioridad: BAJA — depende de historial de compras suficiente.

---


## 3. Paleta de Colores — "Brasas & Carbón"

Paleta diseñada para un entorno de restaurante/pollería. Concepto: carbón del asador, brasas encendidas, ámbar de la grasa dorada.

Colores Principales


| |  |  | |
|---|---|---|---|
|Carbón #1B2B3A Primario · Headers · Nav | Brasa #C8410A Secundario · CTAs · Acento fuerte | Ámbar #E8A838 Accent · Warnings · Highlights | Crema #FAFAF8 Background general|


Colores de Soporte


| |  |  | |
|---|---|---|---|
|Noche #0F1A24 Dark mode cocina/bar · Fondo oscuro | Pizarra #2E4155 Hover de primario · Sidebar | Lino #F0EDE8 Surface cards · Inputs bg | Humo #8C9BAA Texto muted · Placeholders|


Colores de Estado (Semánticos)


| |  |  | |
|---|---|---|---|
|Glaciar #B0C4D8 Borde "Sin empezar" | Hierba #1A6B3C Listo · Éxito · Confirmado | Alerta #C8410A Crítico · Error · Cancelado | Mostaza #D4860A Advertencia · Stock bajo|



| |  |  | |
|---|---|---|---|
|Zafiro #2563A8 En preparación · Info | Brasa #C8410A Tag Delivery | Cobre #A05A2C Tag Adicional · Pedido extra | Índigo #4C3B8A Estadísticas · Gráficos|


Modo Oscuro — Cocina y Bar


| |  |  | |
|---|---|---|---|
|Fondo #0F1A24 Background principal | Surface #162230 Cards de pedido | Surface +1 #1E2F3F Cards hover / activo | Texto #B0C4D8 Texto principal en dark|


Variables CSS — globals.css


|:root {|
|---|
|--color-primary:     #1B2B3A;|
|--color-secondary:   #C8410A;|
|--color-accent:      #E8A838;|
|--color-bg:          #FAFAF8;|
|--color-surface:     #F0EDE8;|
|--color-text:        #1C1C1C;|
|--color-muted:       #8C9BAA;|
|--color-border:      #D4CFC9;|
|/* Estados semánticos */|
|--color-pending:     #B0C4D8;|
|--color-in-prep:     #2563A8;|
|--color-ready:       #1A6B3C;|
|--color-additional:  #A05A2C;|
|--color-delivery:    #C8410A;|
|--color-warning:     #D4860A;|
|--color-danger:      #B02020;|
|/* Tipografía */|
|--font-display: "Playfair Display", Georgia, serif;|
|--font-body:    "DM Sans", system-ui, sans-serif;|
|--font-mono:    "DM Mono", monospace;|
|}|
|[data-theme="dark"] {|
|--color-bg:      #0F1A24;|
|--color-surface: #162230;|
|--color-text:    #B0C4D8;|
|--color-border:  #1E2F3F;|
|}|


---


## 4. Guía de Skills — Cuándo y Para Qué


### Skills Disponibles

📐 frontend-design


|Cuándo activarla|
|---|
|→  Al construir componentes visuales: KitchenCard, BarCard, tablero de mesas, dashboard admin.|
|→  Al diseñar pantallas nuevas desde cero.|
|→  Cuando el resultado se ve genérico y necesitas elevar la calidad visual.|


📊 xlsx


|Cuándo activarla|
|---|
|→  Al crear la plantilla de carga masiva de recetas.|
|→  Al generar el reporte de compras exportable.|
|→  Al importar inventario inicial desde un archivo existente del cliente.|


📄 docx / pdf


|Cuándo activarla|
|---|
|→  Lista de compras imprimible desde el dashboard admin (pdf).|
|→  Manual de usuario por rol (chef, mesero, admin) (docx).|
|→  Reportes de cierre de jornada (pdf).|


🗂️ file-reading


|Cuándo activarla|
|---|
|→  Al procesar archivos del cliente (inventario inicial, recetas en Excel).|
|→  Migración de datos de sistemas anteriores.|


### Tabla de Referencia Rápida


|Tarea | Skill|
|---|---|
|KitchenCard, BarCard, pantallas UI | frontend-design|
|Plantilla carga de recetas | xlsx|
|Lista de compras imprimible | pdf|
|Cierre de jornada / reporte diario | pdf|
|Manual de usuario | docx|
|Leer inventario existente del cliente | file-reading|


---


## 5. Quick Reference — Prompts de Contexto

Fragmentos para añadir al inicio de prompts en Claude Code cuando se necesita contexto específico.


Al trabajar en la Interfaz Cocina


|Contexto: interfaz de cocina del sistema SAS Restaurantes.|
|---|
|Dark mode forzado (bg: #0F1A24). Pantalla grande (TV o tablet 10"+).|
|Operada por cocineros — botones grandes, mínima escritura, Wake Lock activo.|
|Solo muestra order_items con assignedArea = 'kitchen'.|
|Estados: pending (borde gris), in_prep (borde #2563A8), ready (borde #1A6B3C), additional (borde #A05A2C).|
|Dos zonas: 'active' (pending/in_prep) y 'ready' (esperando recojo del mesero).|
|Evento order:delivered elimina la tarjeta de la cola.|


Al trabajar en la Interfaz Bar


|Contexto: interfaz de bar, misma lógica que cocina.|
|---|
|Solo muestra order_items con assignedArea = 'bar'.|
|Bar reutiliza los tipos de kitchen (bar/types.ts re-exporta kitchen/types.ts).|
|El barman opera independientemente del chef — un ítem de bar puede marcarse listo sin esperar los platos.|


Al trabajar en la Interfaz Mesero


|Contexto: interfaz de mesero, tableta 10-12", landscape preferido, PWA instalable.|
|---|
|Paleta light mode: primary #1B2B3A, accent #C8410A, surface #FAFAF8.|
|Flujo crítico: Platos → Bebidas → Resumen → POST /orders (despacho inmediato) → POST /invoices → "Pagar ahora / Pagar después".|
|"Pagar ahora": abre PaymentModal → POST /invoices/:id/pay.|
|"Pagar después": badge "Falta pagar" en la mesa. El mesero registra el cobro al final del servicio.|
|ítems con dispatchArea='waiter' aparecen listos automáticamente (sin pantalla de preparación).|
|Una factura paid es inmutable. Los adicionales generan nueva factura separada.|


Al trabajar en el Panel Admin


|Contexto: panel admin desktop-first. Tabs: Inicio, Insumos, Recetario, Reportes/Ventas, Compras, Config.|
|---|
|El admin abre/cierra la JourneySession del día (sin jornada abierta el mesero no puede crear pedidos).|
|Gráficos con Recharts. Tablas paginadas con filtros.|
|Cálculo de costo = suma(recipe.quantity_needed × ingredient.unitCost) por plato.|
|Las alertas de stock se emiten via stock:alert a room:admin.|
|system_settings: parámetros configurables (reminder_minutes, timer_alert_minutes, tax_rate).|


Al crear un nuevo módulo de API


|Estructura obligatoria: nombre.routes.ts, nombre.service.ts, nombre.repository.ts, nombre.schema.ts|
|---|
|Validación con Zod en routes. Lógica de negocio en service. Queries en repository.|
|Tests: nombre.service.test.ts (unit) + nombre.routes.test.ts (integration con Supertest).|
|Usar request.log.info/error para logging, nunca console.log.|


Al crear un módulo MCP (Fase 4)


|Estructura: apps/api/src/mcp/{dominio}.mcp.ts|
|---|
|Cada herramienta tipada con Zod. El contexto se construye leyendo la BD, nunca desde el cliente.|
|Los agentes son read-only por defecto. Las escrituras requieren confirmación explícita.|
|Naming: {acción}{Dominio}Tool. Ejemplo: getJourneyMetricsTool, getLowStockIngredientsTool.|
|Usar prompt caching (Anthropic SDK) para contextos de jornadas largas.|


---

*Última actualización: 2026-06-12 — Flujo de pago manual, Interfaz Bar, FASE 4 Agentes MCP*
