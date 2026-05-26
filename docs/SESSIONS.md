SAS RESTAURANTES

Guía de Implementación con Claude Code

CLAUDE.md · Sesiones · Paleta de Colores · Skills


|🍳  Cocina Dark mode · Pantalla grande | 🧑‍💼  Mesero PWA · Tableta táctil | 📊  Admin Dashboard · Desktop|
|---|---|---|



## 1. El archivo CLAUDE.md

El archivo CLAUDE.md es la memoria persistente del proyecto para Claude Code. Se coloca en la raíz del repositorio y es leído automáticamente al inicio de cada sesión de trabajo. Sin él, Claude Code empieza cada sesión sin contexto del proyecto.


|¿Qué contiene el CLAUDE.md de este proyecto?|
|---|
|→  Contexto del negocio: qué es el sistema y para quién|
|→  Stack tecnológico con versiones exactas|
|→  Estructura de carpetas del monorepo|
|→  Enums y tipos de BD que nunca deben cambiar en producción|
|→  Reglas de negocio críticas numeradas (pedidos, inventario, menú)|
|→  Convenciones de naming y estructura de módulos|
|→  Tokens de color del design system|
|→  Comandos del proyecto (dev, test, docker, prisma)|
|→  Lista de restricciones duras (qué NUNCA hacer)|


El archivo CLAUDE.md completo está incluido en este paquete como archivo separado listo para pegar en la raíz del repositorio.


## 2. Plan de Sesiones — Claude Code

Cada sesión tiene un scope pequeño y entregable verificable. No saltar sesiones. Cada una asume que la anterior está funcionando y mergeada a main.


### FASE 0 — Esqueleto del Proyecto (1–2 días)

Antes de escribir una sola línea de feature, el proyecto debe arrancar y tener CI verde.


### Sesión 0.1 — Monorepo + Docker


|Prompt para Claude Code|
|---|
|→  Inicializa un monorepo con pnpm workspaces. Estructura: /apps/web (React 18 + Vite + TypeScript), /apps/api (Fastify + TypeScript), /packages/shared (tipos TS), /packages/ui (componentes vacíos por ahora).|
|→  Crea docker-compose.yml con servicios: nginx, frontend (puerto 3000), api (puerto 3001), db (PostgreSQL 16), redis (Redis 7), pgadmin (solo dev, puerto 5050).|
|→  Crea docker-compose.dev.yml que sobreescribe con volúmenes de desarrollo y hot reload.|
|→  Configura ESLint + Prettier + TypeScript strict mode en todos los workspaces.|
|→  El comando "pnpm dev" debe levantar todo. Verificar que los servicios se comunican.|



* ✅ Criterio de éxito: docker-compose up arranca sin errores. "Hello from API" en localhost:3001/health

### Sesión 0.2 — Schema de Base de Datos


|Prompt para Claude Code|
|---|
|→  En apps/api, inicializa Prisma con PostgreSQL. Crea el schema completo en prisma/schema.prisma con las siguientes entidades: User, Table, WaiterSession, WaiterSessionTable, MenuCategory, MenuItem, Ingredient, Recipe, DailyMenu, Order, OrderItem, Invoice, Supplier, Purchase, PurchaseItem, Notification, CalendarEvent.|
|→  Usa los enums definidos en CLAUDE.md. Todos los IDs como UUID con @default(uuid()). Timestamps en todas las tablas.|
|→  Crea la migración inicial: prisma migrate dev --name init.|
|→  Crea un seed en prisma/seed.ts con: 1 admin, 2 meseros, 2 chefs, 8 mesas, 10 menu_items (5 platos + 5 bebidas), 15 ingredientes, recetas básicas.|
|→  Exportar todos los tipos generados por Prisma al package @sas/shared.|



* ✅ Criterio de éxito: pnpm db:seed corre sin errores. Datos visibles en pgAdmin.

### Sesión 0.3 — Autenticación


|Prompt para Claude Code|
|---|
|→  Implementa autenticación en apps/api con JWT. Rutas: POST /auth/login, POST /auth/refresh, POST /auth/logout.|
|→  Access token: 15 min. Refresh token: 8h, guardado en Redis con key refresh:{userId}:{tokenId}.|
|→  Middleware de Fastify: requireRole(roles: UserRole[]). Aplícalo como preHandler hook.|
|→  Hashear contraseñas con bcrypt (salt rounds: 12).|
|→  Validación de body con Zod en todas las rutas.|
|→  Tests unitarios para el servicio de auth y tests de integración para las 3 rutas.|



* ✅ Criterio de éxito: login retorna tokens válidos. Ruta protegida retorna 401 sin token. Tests en verde.

### FASE 1 — Ciclo Completo de Pedido (1.5–2 semanas)

Esta fase es el corazón del MVP. El objetivo es que un pedido pueda ir de punta a punta.


### Sesión 1.1 — API de Pedidos


|Prompt para Claude Code|
|---|
|→  Implementa el módulo de orders en apps/api siguiendo la estructura: orders.routes.ts, orders.service.ts, orders.repository.ts, orders.schema.ts.|
|→  Rutas: POST /orders (crear), GET /orders (listar con filtros), GET /orders/:id, PATCH /orders/:id/status, POST /orders/:id/items (agregar ítem).|
|→  Al crear un order, el status inicial es "pending" y NO entra a cocina todavía (espera confirmación de pago).|
|→  Regla crítica: cuando todos los order_items tienen status="served", actualizar automáticamente order.status="delivered" (hook en el service).|
|→  Para pedidos adicionales: recibir parentOrderId en el body, setear is_additional=true.|
|→  Tests de integración para el happy path completo.|



* ✅ Criterio de éxito: CRUD de pedidos funciona. La regla de auto-delivered pasa sus tests.

### Sesión 1.2 — WebSocket Server


|Prompt para Claude Code|
|---|
|→  Configura Socket.io 4 en apps/api con el adapter de Redis (para escalar horizontalmente en el futuro).|
|→  Implementa los rooms: room:kitchen, room:waiter:{userId}, room:admin.|
|→  Eventos server→client: order:created, order:item:claimed, order:item:ready, order:item:updated, order:additional, stock:alert.|
|→  Eventos client→server: item:claim (cocinero reclama), item:ready (cocinero termina), item:served (mesero recoge).|
|→  Al confirmar un pago (invoice.status cambia a "paid"), emitir order:created a room:kitchen automáticamente.|
|→  Autenticación WebSocket: validar JWT en el handshake.|
|→  Test de integración: simular el flujo completo con 2 clientes socket.|



* ✅ Criterio de éxito: en Postman WebSocket, un mensaje item:ready llega al mesero correcto.

### Sesión 1.3 — Frontend: Design System Base


|Prompt para Claude Code|
|---|
|→  En packages/ui, configura el design system. Crea tokens.ts con los colores del CLAUDE.md como variables CSS y como objeto JS.|
|→  Configura Tailwind en apps/web con los tokens extendidos: primary=#1B2B3A, secondary=#C8410A, accent=#E8A838, surface=#FAFAF8, dark=#0F1A24.|
|→  Implementa componentes base: Button (variants: primary/secondary/ghost/danger), Badge (variants por estado de pedido), Card, Spinner, Tag.|
|→  El componente Tag tiene variantes: pending (gris), in_prep (azul), ready (verde), additional (naranja), delivery (rojo).|
|→  Todos los componentes deben ser accesibles: aria-labels, focus visible, tamaño táctil mínimo 48px.|
|→  Storybook no es necesario en MVP; documentar props con JSDoc.|



* ✅ Criterio de éxito: componentes renderizan en /dev con los colores del brand. Ningún color hardcodeado.

### Sesión 1.4 — Interfaz Cocina


|Prompt para Claude Code|
|---|
|→  Crea la ruta /kitchen en apps/web. Fondo oscuro (dark mode forzado, color dark=#0F1A24).|
|→  Componente KitchenCard: muestra número de pedido, tipo (MESA/DELIVERY con tag visual), lista de ítems con notas, timer desde creación, estado con color de borde.|
|→  La cola es un grid responsive de tarjetas ordenadas por created_at ASC. Los adicionales van al final.|
|→  Suscribirse a room:kitchen via Socket.io al montar. Manejar eventos: order:created agrega tarjeta, order:item:claimed actualiza estado, order:item:updated muestra badge parpadeante "ACTUALIZADO".|
|→  Botón en cada ítem: "Tomar" → emite item:claim. "Listo" → emite item:ready.|
|→  Timer en rojo si el pedido lleva más de 15 minutos sin empezar (configurable).|
|→  Wake Lock API para mantener la pantalla activa.|



* ✅ Criterio de éxito: un pedido creado desde Postman aparece en pantalla en menos de 1 segundo.

### Sesión 1.5 — Interfaz Mesero: Flujo de Pedido


|Prompt para Claude Code|
|---|
|→  Login screen con email + PIN. Al ingresar: selector de modo (Asignado/Libre) + selección de mesas. Las mesas ocupadas por otro mesero deben aparecer deshabilitadas.|
|→  Tablero de mesas: grid con tarjeta por mesa mostrando número y estado del pedido activo.|
|→  Flujo de nuevo pedido (3 pasos): Paso 1 menú del día (platos), Paso 2 bebidas, Paso 3 resumen + confirmar.|
|→  En el resumen: subtotal por platos, subtotal por bebidas, total. Campo de nota general.|
|→  Al confirmar: crear order + order_items via API. Llevar al paso de pago.|
|→  Tap en mesa con pedido activo: ver detalle con estado de cada ítem (en prep / listo). Botón "Agregar más" que inicia flujo con is_additional=true.|
|→  Botón flotante "+ Delivery" para pedidos sin mesa.|



* ✅ Criterio de éxito: mesero puede crear pedido completo en menos de 3 minutos.

### Sesión 1.6 — Pagos con Culqi


|Prompt para Claude Code|
|---|
|→  Integrar Culqi en el frontend: cargar SDK de Culqi en index.html, crear componente PaymentForm.|
|→  Métodos MVP: Tarjeta (Culqi token → backend), Yape/Plin (mostrar QR generado por Culqi), Efectivo (registra manualmente, sin procesador).|
|→  En el backend: ruta POST /invoices/:id/pay. Recibe método de pago y token. Llama a Culqi API con secret key. Si exitoso: invoice.status = "paid" → emitir order:created a room:kitchen.|
|→  Manejo de errores de Culqi: mostrar mensajes claros al mesero (tarjeta rechazada, etc.).|
|→  En modo dev: usar Culqi en modo test con tarjetas de prueba documentadas en README.|



* ✅ Criterio de éxito: pago con tarjeta de prueba de Culqi confirma y el pedido llega a cocina.

### Sesión 1.7 — Notificaciones al Mesero


|Prompt para Claude Code|
|---|
|→  Al recibir evento order:item:ready en room:waiter:{id}: mostrar notificación browser (Notification API) y badge rojo en la UI.|
|→  Panel de notificaciones: lista de pedidos listos para recoger con número de mesa/pedido y tiempo de espera.|
|→  Al tocar una notificación: navegar a la tarjeta de mesa correspondiente.|
|→  Recordatorio automático: si un ítem marcado "ready" no es recogido en 3 minutos, re-notificar (BullMQ job en el backend).|
|→  Al confirmar recojo: emitir item:served → el ítem desaparece de notificaciones pendientes.|



* ✅ Criterio de éxito: notificación llega en menos de 2 segundos de que el cocinero marca listo.

### FASE 2 — Panel Admin Básico (1 semana)

Con el ciclo de pedido funcionando, el admin ya tiene datos para mostrar.


### Sesión 2.1 — Dashboard del Día


|Prompt para Claude Code|
|---|
|→  Ruta /admin/dashboard. Layout con tabs: Inicio, Insumos, Recetario, Reportes, Compras, Configuración.|
|→  Tab Inicio: sección "Menú de hoy" con checklist de items del daily_menu (con opción de desactivar), botón confirmar menú.|
|→  Sección "Seguimiento de hoy": tarjetas KPI (ventas, órdenes, platos servidos). Actualización en tiempo real via Socket.io room:admin.|
|→  Sección "Insumos críticos del día": tabla con columnas Insumo / Necesario hoy / Stock actual / A comprar / Estado. Calcular "Necesario hoy" sumando quantities de las recetas de los platos del daily_menu.|
|→  Botón descargar lista de compras (PDF simple con los ítems en estado low/critical/out).|



### Sesión 2.2 — Gestión de Insumos y Recetario


|Prompt para Claude Code|
|---|
|→  Tab Insumos: tabla paginada con todos los ingredientes. Filtros por estado y búsqueda. CRUD completo.|
|→  Al entrar al tab: modal de alertas si hay ingredientes critical/out usados en el menú de hoy.|
|→  Tab Recetario: grid de tarjetas de menu_items con imagen, nombre, costo calculado de receta. Click para ver detalle con todos los ingredientes y cantidades.|
|→  CRUD de menu_items con formulario. Al editar, recalcular costo de receta automáticamente.|
|→  Filtros en recetario: Todos / Platos / Bebidas.|



### Sesión 2.3 — Reportes y Compras


|Prompt para Claude Code|
|---|
|→  Tab Reportes: KPIs con filtro temporal (Hoy/Semana/Mes/Año). Ingresos, Costos (suma de recipe costs × quantities vendidas), Ganancias, Margen.|
|→  Gráfico de métodos de pago (pie chart con Recharts). Top 3 platos más vendidos.|
|→  Tab Compras: formulario de registro de compra (proveedor, lista de ingredientes con cantidades y precios). Al confirmar, actualizar stock de cada ingrediente.|
|→  Tabla de compras agrupadas por proveedor, colapsables.|
|→  CRUD de proveedores.|



### Sesión 2.4 — Configuración y Roles


|Prompt para Claude Code|
|---|
|→  Tab Configuración: tabla de usuarios con nombre, email, rol, estado activo/inactivo.|
|→  Formulario de crear usuario: nombre, email, contraseña temporal, rol. El usuario debe cambiar contraseña en primer login.|
|→  Gestión de mesas: CRUD de mesas con número, capacidad, sección.|
|→  Parámetros del sistema: tiempo de recordatorio de notificación (default 3 min), umbral de timer rojo en cocina (default 15 min).|



### FASE 3 — Pulido y Producción (3–4 días)


### Sesión 3.1 — Tests E2E y Stress


|Prompt para Claude Code|
|---|
|→  Escribe tests E2E con Playwright para el flujo completo: login mesero → asignar mesas → tomar pedido → pagar → pedido llega a cocina → cocinero marca listo → mesero recoge.|
|→  Test de estrés con k6: simular 30 pedidos concurrentes. El sistema debe mantenerse estable y las notificaciones deben llegar en menos de 3 segundos bajo carga.|
|→  Configurar GitHub Actions: lint + type-check + unit tests en cada PR, E2E en merge a main.|



### Sesión 3.2 — PWA y Deploy


|Prompt para Claude Code|
|---|
|→  Configurar Vite PWA Plugin: service worker, manifest.json con iconos para iOS y Android, modo standalone.|
|→  El service worker debe cachear assets estáticos. Los requests API no se cachean (siempre fresh).|
|→  Configurar nginx para SSL (Let's Encrypt con certbot), gzip, headers de seguridad.|
|→  Crear Dockerfile optimizados para producción (multi-stage build) para api y frontend.|
|→  Variables de entorno documentadas en .env.example para cada servicio.|
|→  README con instrucciones de deploy desde cero.|



## 3. Paleta de Colores — "Brasas & Carbón"

Paleta diseñada específicamente para un entorno de restaurante/pollería. Se aleja de los azules corporativos genéricos y usa la calidez del fuego y los materiales orgánicos de cocina como inspiración.

Concepto: el carbón del asador, las brasas encendidas, el ámbar de la grasa dorada, el humo y la cerámica cálida.

Colores Principales


| |  |  | |
|---|---|---|---|
|Carbón #1B2B3A Primario · Headers · Nav | Brasa #C8410A Secundario · CTAs · Accento fuerte | Ámbar #E8A838 Accent · Warnings · Highlights | Crema #FAFAF8 Background general|


Colores de Soporte


| |  |  | |
|---|---|---|---|
|Noche #0F1A24 Dark mode cocina · Fondo oscuro | Pizarra #2E4155 Hover de primario · Sidebar | Lino #F0EDE8 Surface cards · Inputs bg | Humo #8C9BAA Texto muted · Placeholders|


Colores de Estado (Semánticos)


| |  |  | |
|---|---|---|---|
|Glaciar #B0C4D8 Borde "Sin empezar" | Hierba #1A6B3C Listo · Éxito · Confirmado | Alerta #C8410A Crítico · Error · Cancelado | Mostaza #D4860A Advertencia · Stock bajo|



| |  |  | |
|---|---|---|---|
|Zafiro #2563A8 En preparación · Info | Brasa #C8410A Tag Delivery | Cobre #A05A2C Tag Adicional · Pedido extra | Índigo #4C3B8A Estadísticas · Gráficos 2|


Modo Oscuro — Interfaz Cocina


| |  |  | |
|---|---|---|---|
|Fondo #0F1A24 Background principal cocina | Surface #162230 Cards de pedido | Surface +1 #1E2F3F Cards hover / activo | Texto #B0C4D8 Texto principal en dark|



| |  |  | |
|---|---|---|---|
|En prep #2563A8 Borde tarjeta en preparación | Listo #1A6B3C Borde tarjeta lista para llevar | Adicional #A05A2C Borde tarjeta adicional | Delivery #C8410A Borde + tag delivery|


Tipografía


|Rol | Fuente y Justificación|
|---|---|
|Display / Títulos | Playfair Display (Google Fonts) — Elegancia con carácter, evoca menús de restaurante tradicional.|
|Cuerpo / UI | DM Sans (Google Fonts) — Legible, geométrica, bien espaciada para tabletas.|
|Monospace / Precios | DM Mono (Google Fonts) — Para cifras, IDs de pedido, timestamps.|
|Cocina (dark) | DM Sans Bold 600 — Mayor peso para lectura a distancia.|


Importar en index.html:


|<link rel="preconnect" href="https://fonts.googleapis.com">|
|---|
|<link href="https://fonts.googleapis.com/css2?|
|family=Playfair+Display:wght@600;700&|
|family=DM+Sans:wght@400;500;600&|
|family=DM+Mono:wght@400;500&|
|display=swap" rel="stylesheet">|


Variables CSS — globals.css


|:root {|
|---|
|/* Colores principales */|
|--color-primary:     #1B2B3A;|
|--color-secondary:   #C8410A;|
|--color-accent:      #E8A838;|
|--color-bg:          #FAFAF8;|
|--color-surface:     #F0EDE8;|
|--color-text:        #1C1C1C;|
|--color-muted:       #8C9BAA;|
|--color-border:      #D4CFC9;|
||
|/* Estados semánticos */|
|--color-pending:     #B0C4D8;|
|--color-in-prep:     #2563A8;|
|--color-ready:       #1A6B3C;|
|--color-additional:  #A05A2C;|
|--color-delivery:    #C8410A;|
|--color-warning:     #D4860A;|
|--color-danger:      #B02020;|
||
|/* Tipografía */|
|--font-display: "Playfair Display", Georgia, serif;|
|--font-body:    "DM Sans", system-ui, sans-serif;|
|--font-mono:    "DM Mono", monospace;|
|}|
||
|[data-theme="dark"] {|
|--color-bg:      #0F1A24;|
|--color-surface: #162230;|
|--color-text:    #B0C4D8;|
|--color-border:  #1E2F3F;|
|}|


Tailwind Config — extensión de colores


|// tailwind.config.ts|
|---|
|export default {|
|theme: {|
|extend: {|
|colors: {|
|primary:   { DEFAULT: "#1B2B3A", hover: "#2E4155" },|
|secondary: { DEFAULT: "#C8410A", hover: "#A83508" },|
|accent:    { DEFAULT: "#E8A838", hover: "#D4860A" },|
|surface:   "#F0EDE8",|
|dark:      "#0F1A24",|
|state: {|
|pending:    "#B0C4D8",|
|"in-prep":  "#2563A8",|
|ready:      "#1A6B3C",|
|additional: "#A05A2C",|
|delivery:   "#C8410A",|
|}|
|},|
|fontFamily: {|
|display: ["Playfair Display", "Georgia", "serif"],|
|body:    ["DM Sans", "system-ui", "sans-serif"],|
|mono:    ["DM Mono", "monospace"],|
|}|
|}|
|}|
|}|



## 4. Guía de Skills — Cuándo y Para Qué

Las skills son instrucciones especializadas que Claude activa al recibir ciertos tipos de tarea. Esta guía documenta cuándo usar cada skill durante el desarrollo del proyecto.

Skills Disponibles y su Aplicación en este Proyecto

📐 frontend-design


|Cuándo activarla|
|---|
|→  Al construir cualquier componente visual: KitchenCard, tablero de mesas, dashboard admin.|
|→  Al diseñar pantallas nuevas desde cero (login, selector de modo del mesero).|
|→  Cuando el resultado se ve genérico o "plantilla" y necesitas elevar la calidad visual.|
|→  Para el sistema de colores, el layout del dashboard, animaciones de estado de pedidos.|



|Cómo usarla con Claude Code|
|---|
|→  Prompt: "Usando la paleta Brasas & Carbón del CLAUDE.md, diseña el componente KitchenCard con los 4 estados visuales. Evita diseño genérico. La cocina usa dark mode."|
|→  Prompt: "Diseña la pantalla de login del mesero para tableta. Debe sentirse como una app de restaurante premium, no un panel corporativo."|


📊 xlsx


|Cuándo activarla|
|---|
|→  Al crear la plantilla de carga masiva de recetas (el admin puede subir un Excel).|
|→  Al generar el reporte de compras exportable en Excel para el admin.|
|→  Al importar inventario inicial desde un archivo que el cliente ya tiene.|
|→  Para la plantilla de proveedores con sus insumos asociados.|



|Ejemplos de uso|
|---|
|→  "Crea la plantilla Excel para carga masiva de recetas con columnas: nombre_plato, ingrediente, cantidad, unidad, notas. Con validación de datos y formato de ejemplo en las primeras 3 filas."|
|→  "Genera el reporte mensual de compras por proveedor en Excel con totales automáticos y formato de tabla."|


📄 docx


|Cuándo activarla|
|---|
|→  Al generar el documento de lista de compras imprimible (admin lo imprime para ir al mercado).|
|→  Para documentos de manual de usuario por rol (chef, mesero, admin).|
|→  Para el reporte diario/semanal en Word si el cliente lo pide para contabilidad.|


📑 pdf


|Cuándo activarla|
|---|
|→  Al generar el comprobante de pago / boleta en PDF para el cliente.|
|→  Para la lista de compras descargable desde el dashboard admin.|
|→  Para reportes de cierre de caja en PDF.|


🗂️ file-reading


|Cuándo activarla|
|---|
|→  Al procesar el archivo Excel que sube el admin con el inventario inicial.|
|→  Al leer el archivo de recetas que sube en masa desde Excel.|
|→  Cuando el cliente tenga archivos existentes de su negocio para migrar datos.|


Tabla de Referencia Rápida


|Tarea | Skill | Detalle|
|---|---|---|
|KitchenCard, pantallas, UI | frontend-design | Componentes React, layouts, animaciones|
|Plantilla carga de recetas | xlsx | Excel para importación masiva|
|Reporte de compras | xlsx | Descarga Excel del panel admin|
|Lista de compras imprimible | pdf | PDF generado desde el dashboard|
|Boleta/comprobante de pago | pdf | Documento al confirmar pago|
|Manual de usuario (chef/mesero) | docx | Documentación Word para el cliente|
|Leer inventario existente del cliente | file-reading | Migración de datos iniciales|
|Reporte mensual para contabilidad | docx + xlsx | Word narrative + Excel datos|


Tips para Usar Skills con Claude Code

Menciona la skill en el prompt cuando la tarea lo requiera: "usando la skill de frontend-design, construye..."

Para la skill frontend-design, siempre incluir el contexto de la interfaz: "es para la pantalla de cocina en dark mode" o "es para el admin en desktop".

Para xlsx y pdf, especificar si es para el mesero/cocinero (UX simple) o para el admin (puede ser más técnico).

Claude Code lee el CLAUDE.md al inicio; las skills son adicionales que activas por tarea específica.


## 5. Quick Reference — Prompts de Contexto

Estos fragmentos se añaden al inicio de los prompts en Claude Code cuando se necesita recordar contexto específico sin repetir todo el CLAUDE.md.

Al trabajar en la Interfaz Cocina


|Contexto: interfaz de cocina del sistema SAS Restaurantes.|
|---|
|Dark mode forzado (bg: #0F1A24). Pantalla grande (TV o tablet 10"+).|
|Operada por cocineros con manos sucias — botones grandes, mínima escritura.|
|Los pedidos llegan por WebSocket (room:kitchen). Tarjetas ordenadas por created_at ASC.|
|Estados de tarjeta: pending (borde gris), in_prep (borde #2563A8), ready (borde #1A6B3C),|
|additional (borde #A05A2C), delivery (tag rojo #C8410A).|


Al trabajar en la Interfaz Mesero


|Contexto: interfaz de mesero, tableta 10-12", orientación landscape preferida.|
|---|
|PWA instalable. El mesero está de pie y en movimiento — UI táctil prioritaria.|
|Paleta light mode: primary #1B2B3A, accent #C8410A, surface #FAFAF8.|
|Flujo crítico: platos → bebidas → resumen → pago (Culqi) → envío a cocina.|
|Una factura por pedido. Los adicionales generan nueva factura (nunca editar la pagada).|


Al trabajar en el Panel Admin


|Contexto: panel admin desktop-first. Tabs: Inicio, Insumos, Recetario, Reportes, Compras, Config.|
|---|
|Gráficos con Recharts. Tablas paginadas con filtros.|
|El admin no está bajo presión de tiempo — puede ser más denso en información.|
|Cálculos de costo = suma(recipe.quantity_needed * ingredient.unit_cost) por plato.|
|Los alertas de stock se emiten via WebSocket evento stock:alert a room:admin.|


Al crear un nuevo módulo de API


|Estructura obligatoria: nombre.routes.ts, nombre.service.ts,|
|---|
|nombre.repository.ts, nombre.schema.ts, nombre.types.ts|
|Validación con Zod en routes. Lógica de negocio en service. Queries en repository.|
|Tests: nombre.service.test.ts (unit) + nombre.routes.test.ts (integration con Supertest).|
|Usar request.log.info/error para logging, nunca console.log.|


Orden de Implementación Recomendado por Sesión

Lee el CLAUDE.md (Claude Code lo hace automáticamente).

Describe el módulo a implementar con su criterio de éxito.

Si hay componente visual: menciona "usando frontend-design skill".

Si hay archivo Excel/PDF: menciona la skill correspondiente.

Al final de cada sesión: pedir a Claude Code que escriba los tests del módulo.

Verificar que los tests pasan antes de hacer commit.
