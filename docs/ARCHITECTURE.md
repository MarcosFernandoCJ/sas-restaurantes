🍗

SAS RESTAURANTES

Sistema de Gestión para Pollerías

DOCUMENTO DE ARQUITECTURA Y PLANIFICACIÓN MVP

Versión 1.0  ·  2025


|INTERFACES DEL SISTEMA|
|---|
|• 🍳  Interfaz Cocina — Control de pedidos en tiempo real|
|• 🧑‍💼  Interfaz Mesero — Toma de pedidos y pagos en tableta|
|• 📊  Interfaz Administrador — Panel de gestión y analítica|


Confidencial · Uso interno


## 1. RESUMEN EJECUTIVO

Este documento describe la arquitectura, estructura de datos, flujos de negocio y decisiones técnicas para el MVP del Sistema de Gestión SAS Restaurantes, orientado a pollerías y restaurantes de formato similar.

El sistema está compuesto por tres interfaces independientes pero conectadas en tiempo real: Cocina, Mesero y Administrador. El objetivo del MVP es cubrir el ciclo completo de un pedido: toma → preparación → entrega → pago → analítica.


### Objetivos del MVP

Digitalizar el ciclo completo de pedido sin papel.

Reducir errores de comunicación cocina-sala.

Proveer datos en tiempo real al administrador.

Soportar delivery y mesa desde el mismo flujo.

Ser extensible a múltiples sucursales en versiones futuras.


### Principios de Diseño


|Principio | Descripción|
|---|---|
|Responsabilidad Única (SOLID) | Cada módulo hace una sola cosa; fallos fáciles de ubicar.|
|Offline-first en mesero | Pedidos en cola local si pierde red, sync al reconectar.|
|Accesibilidad (WCAG 2.1 AA) | Contraste, tamaños touch, navegación por teclado.|
|Docker desde el día 1 | Dev, staging y prod con el mismo entorno.|
|Paleta de colores centralizada | Variables CSS / tokens de diseño reutilizables.|
|Responsive por breakpoint | Mobile 375 px, tableta 768 px, desktop 1280 px.|



## 2. STACK TECNOLÓGICO RECOMENDADO

Todo el stack es 100 % gratuito / open-source en sus niveles de uso para MVP. Se indican opciones de pago solo donde escalen en producción.

Frontend — Web App Progresiva (PWA)

La elección de PWA permite usarse como app nativa en tableta (mesero/cocina) y como web en desktop (admin), sin publicar en tiendas. Instalable en Android e iOS desde el navegador.


|Librería / Herramienta | Justificación|
|---|---|
|React 18 + Vite | UI declarativa, ecosistema maduro, HMR rápido.|
|TypeScript | Tipado estático, reduce bugs en runtime.|
|TailwindCSS 3 | Utilidades CSS, paleta centralizada en tailwind.config.|
|Zustand | Estado global ligero (sin boilerplate de Redux).|
|React Query (TanStack) | Cache, refetch automático, sincronización server-state.|
|React Hook Form + Zod | Formularios performantes + validación de esquemas.|
|Vite PWA Plugin | Service Worker, manifest, offline support.|
|Recharts | Gráficos para panel admin (MIT, sin costo).|
|date-fns | Manejo de fechas / tiempos de pedido.|


Backend


|Tecnología | Justificación|
|---|---|
|Node.js 20 LTS + Fastify | APIs REST + WebSocket; más rápido que Express.|
|TypeScript | Consistencia con frontend, tipos compartidos.|
|Prisma ORM | Migraciones, type-safety en queries, soporte multi-DB.|
|PostgreSQL 16 | Relacional robusto, soporte JSON, gratis.|
|Redis 7 | Cola de pedidos en tiempo real, sesiones, pub/sub.|
|Socket.io 4 | WebSocket con fallback; notificaciones instantáneas.|
|BullMQ | Cola de trabajos (notificaciones, reportes async).|
|JWT + Refresh Token | Autenticación stateless con rotación de tokens.|
|Zod (server) | Validación de payloads de entrada.|


Infraestructura y DevOps


|Herramienta | Rol|
|---|---|
|Docker + Docker Compose | Contenedores: api, frontend, db, redis, nginx.|
|Nginx (reverse proxy) | SSL termination, static files, websocket proxy.|
|GitHub Actions | CI/CD: lint, tests, build, deploy automático.|
|Railway / Render (free tier) | Hosting gratuito para MVP; migrar a VPS en producción.|
|Cloudflare (free) | CDN, DDoS, caché de assets estáticos.|
|pgAdmin / Prisma Studio | Exploración de BD en desarrollo.|


Pagos


|Recomendación: Stripe|
|---|
|• Stripe Terminal SDK: soporta POS físico (lector de tarjetas) conectado a la tableta del mesero.|
|• Stripe Payment Intents: pagos con tarjeta digital, QR, Link.|
|• Stripe Checkout (hosted): fallback si el terminal falla — cliente escanea QR.|
|• Sin costo mensual. Tarifa por transacción: ~2.9% + 0.30 USD (o equivalente local).|
|• Alternativa local LATAM: Culqi (Perú) — integración REST, sin hardware propio.|
|• Recomendación MVP: Culqi para el mercado peruano + Stripe Terminal si se expande.|


IA / Analítica (capa gratuita)


|Herramienta | Uso|
|---|---|
|Claude API (Anthropic) | Análisis de recetas por imagen, sugerencias admin, contexto externo.|
|OpenAI Embeddings (free tier) | Búsqueda semántica de insumos / recetas (alternativa).|
|Python + scikit-learn | Modelos de estimación de clientes (regresión simple, sin costo).|
|Node-cron | Jobs nocturnos de cálculo de predicciones.|



## 3. MODELO DE BASE DE DATOS

Diseño relacional normalizado (3NF) con PostgreSQL. Se usan UUIDs como PKs para evitar colisiones en entornos distribuidos futuros. Las relaciones están documentadas con cardinalidad.


## 3.1 Entidades Principales y Relaciones

users — Usuarios del sistema


|Campo | Tipo | Descripción|
|---|---|---|
|id | UUID PK | Identificador único|
|name | VARCHAR(100) | Nombre completo|
|email | VARCHAR(150) UNIQUE | Correo de acceso|
|password_hash | TEXT | bcrypt hash|
|role | ENUM('admin','waiter','chef') | Rol en el sistema|
|is_active | BOOLEAN DEFAULT true | Habilitado/deshabilitado|
|created_at | TIMESTAMPTZ | Fecha de creación|


tables — Mesas del restaurante


|Campo | Tipo | Descripción|
|---|---|---|
|id | UUID PK | |
|number | INT UNIQUE | Número visible de mesa|
|capacity | INT | Personas máximo|
|status | ENUM('free','occupied','reserved') | Estado actual|
|section | VARCHAR(50) | Salón, terraza, etc.|


waiter_sessions — Sesiones de turno del mesero


|Campo | Tipo | Descripción|
|---|---|---|
|id | UUID PK | |
|waiter_id | UUID FK → users | Mesero asignado|
|mode | ENUM('free','assigned') | Modo de trabajo|
|started_at | TIMESTAMPTZ | |
|ended_at | TIMESTAMPTZ NULL | |


waiter_session_tables — Mesas asignadas a una sesión (N:M)


|Campo | Tipo | Descripción|
|---|---|---|
|session_id | UUID FK → waiter_sessions | |
|table_id | UUID FK → tables | |
|assigned_at | TIMESTAMPTZ | |


menu_categories — Categorías del menú


|Campo | Tipo | Descripción|
|---|---|---|
|id | UUID PK | |
|name | VARCHAR(80) | Ej: Platos, Bebidas, Postres|
|type | ENUM('food','drink','other') | |
|sort_order | INT | Orden de visualización|
|is_active | BOOLEAN | |


menu_items — Platos y bebidas del menú


|Campo | Tipo | Descripción|
|---|---|---|
|id | UUID PK | |
|category_id | UUID FK → menu_categories | |
|name | VARCHAR(120) | |
|description | TEXT NULL | |
|base_price | DECIMAL(10,2) | Precio de venta|
|prep_time_minutes | INT | Tiempo estimado de prep.|
|image_url | TEXT NULL | |
|is_available | BOOLEAN DEFAULT true | Activo hoy|
|is_featured | BOOLEAN DEFAULT false | Plato estrella|
|created_at | TIMESTAMPTZ | |


ingredients — Insumos / Inventario


|Campo | Tipo | Descripción|
|---|---|---|
|id | UUID PK | |
|name | VARCHAR(120) | Nombre del insumo|
|unit | VARCHAR(30) | kg, lt, unidad, etc.|
|stock_qty | DECIMAL(10,3) | Stock actual|
|min_stock_qty | DECIMAL(10,3) | Umbral alerta crítico|
|unit_cost | DECIMAL(10,4) | Costo unitario promedio|
|supplier_id | UUID FK → suppliers NULL | |
|status | ENUM('ok','low','critical','out') | Auto-calculado|
|updated_at | TIMESTAMPTZ | |


recipes — Recetas: qué insumos usa cada ítem del menú


|Campo | Tipo | Descripción|
|---|---|---|
|id | UUID PK | |
|menu_item_id | UUID FK → menu_items | |
|ingredient_id | UUID FK → ingredients | |
|quantity_needed | DECIMAL(10,4) | Por porción|
|notes | TEXT NULL | Ej: "al gusto"|



* → Relación: menu_items 1—N recipes N—1 ingredients
daily_menus — Menú del día confirmado por el admin


|Campo | Tipo | Descripción|
|---|---|---|
|id | UUID PK | |
|date | DATE | Día del menú|
|menu_item_id | UUID FK → menu_items | |
|override_price | DECIMAL(10,2) NULL | Si difiere del precio base|
|confirmed_by | UUID FK → users | Admin que confirmó|
|confirmed_at | TIMESTAMPTZ NULL | |


orders — Pedidos


|Campo | Tipo | Descripción|
|---|---|---|
|id | UUID PK | |
|order_number | SERIAL | Número secuencial visible|
|table_id | UUID FK → tables NULL | NULL si es delivery|
|waiter_id | UUID FK → users | |
|type | ENUM('dine_in','delivery') | |
|status | ENUM('pending','in_prep','ready','delivered','cancelled') | |
|notes | TEXT NULL | Notas generales|
|is_additional | BOOLEAN DEFAULT false | Si es pedido adicional de una mesa|
|parent_order_id | UUID FK → orders NULL | Ref al pedido original|
|created_at | TIMESTAMPTZ | |
|updated_at | TIMESTAMPTZ | |


order_items — Ítems de cada pedido


|Campo | Tipo | Descripción|
|---|---|---|
|id | UUID PK | |
|order_id | UUID FK → orders | |
|menu_item_id | UUID FK → menu_items | |
|quantity | INT | |
|unit_price | DECIMAL(10,2) | Precio al momento del pedido|
|notes | TEXT NULL | Ej: "sin cebolla"|
|status | ENUM('pending','in_prep','ready','served') | |
|assigned_chef_id | UUID FK → users NULL | Cocinero asignado|
|prep_started_at | TIMESTAMPTZ NULL | |
|prep_finished_at | TIMESTAMPTZ NULL | |


invoices — Facturas / Boletas


|Campo | Tipo | Descripción|
|---|---|---|
|id | UUID PK | |
|order_id | UUID FK → orders | |
|invoice_number | VARCHAR(30) | Correlativo|
|subtotal | DECIMAL(10,2) | |
|tax | DECIMAL(10,2) | IGV u otro impuesto|
|total | DECIMAL(10,2) | |
|status | ENUM('pending','paid','voided') | |
|payment_method | ENUM('cash','card','yape','plin','other') | |
|paid_at | TIMESTAMPTZ NULL | |
|stripe_payment_intent_id | TEXT NULL | O culqi_charge_id|


suppliers — Proveedores


|Campo | Tipo | Descripción|
|---|---|---|
|id | UUID PK | |
|name | VARCHAR(120) | |
|contact_name | VARCHAR(100) NULL | |
|phone | VARCHAR(20) NULL | |
|email | VARCHAR(150) NULL | |
|address | TEXT NULL | |
|notes | TEXT NULL | |


purchases — Compras de insumos


|Campo | Tipo | Descripción|
|---|---|---|
|id | UUID PK | |
|supplier_id | UUID FK → suppliers NULL | |
|registered_by | UUID FK → users | Admin que registró|
|purchased_at | TIMESTAMPTZ | |
|total_cost | DECIMAL(10,2) | |
|receipt_image_url | TEXT NULL | Foto de boleta/factura|


purchase_items — Detalle de compra


|Campo | Tipo | Descripción|
|---|---|---|
|id | UUID PK | |
|purchase_id | UUID FK → purchases | |
|ingredient_id | UUID FK → ingredients | |
|quantity | DECIMAL(10,3) | |
|unit_cost | DECIMAL(10,4) | |
|subtotal | DECIMAL(10,2) | |


notifications — Notificaciones del sistema


|Campo | Tipo | Descripción|
|---|---|---|
|id | UUID PK | |
|type | VARCHAR(50) | order_ready, stock_low, etc.|
|target_role | ENUM('admin','waiter','chef') | |
|target_user_id | UUID NULL | Si es para uno específico|
|payload | JSONB | Datos contextuales|
|is_read | BOOLEAN DEFAULT false | |
|created_at | TIMESTAMPTZ | |


calendar_events — Eventos y días festivos


|Campo | Tipo | Descripción|
|---|---|---|
|id | UUID PK | |
|name | VARCHAR(120) | Ej: Día de la Madre|
|event_date | DATE | |
|expected_extra_customers | INT NULL | Estimación extra|
|notes | TEXT NULL | |
|is_holiday | BOOLEAN DEFAULT false | |



## 3.2 Diagrama de Relaciones (Resumen)


|Relaciones Clave|
|---|
|• users (1) ──< waiter_sessions (1) ──< waiter_session_tables >── tables|
|• tables (1) ──< orders (1) ──< order_items >── menu_items|
|• orders (1) ──< invoices|
|• menu_items (1) ──< recipes >── ingredients (1)|
|• ingredients (1) ──< purchase_items >── purchases (1) ── suppliers|
|• orders (1) ── is_additional → parent_order_id → orders (self-ref)|
|• daily_menus >── menu_items (confirma qué está disponible hoy)|



## 4. INTERFAZ COCINA

Dispositivo objetivo: pantalla grande fija (TV/monitor 40"–55" o tablet 10") · Operación táctil y/o mouse · Sin login propio inicialmente (acceso por PIN de turno)


## 4.1 Flujo Principal

Los pedidos confirmados y pagados llegan automáticamente a la cola de cocina vía WebSocket.

Los pedidos se muestran como tarjetas ordenadas por hora de creación (FIFO).

Cada cocinero toma (reclama) uno o varios pedidos; el ítem queda marcado como "En preparación" para todos.

El cocinero marca los ítems como listos → se notifica al mesero asignado.

La tarjeta sale de la cola activa (o se minimiza) al estar todos sus ítems entregados.


## 4.2 Tarjeta de Pedido — Estructura


|Anatomía de la Tarjeta|
|---|
|• HEADER: #Nro Pedido · Tipo (mesa / delivery) · Hora de llegada · Timer running|
|• BODY: Lista de ítems con cantidad y notas especiales|
|• FOOTER: Estado actual · Botón acción principal · Nombre del cocinero asignado|
|• TAG LATERAL: Estado visual coloreado (ver estados abajo)|



## 4.3 Estados de Tarjeta y Colores


|Estado | Visual|
|---|---|
|🕐 Sin empezar | Borde gris · Timer rojo si supera umbral · Sin fondo de color perturbador|
|🔵 En preparación | Borde azul sutil · Timer azul desde inicio de prep · Chip "En prep" visible|
|✅ Listo para llevar | Borde verde · Notificación push al mesero · Timer muestra espera de recojo|
|➕ Adicional | Borde naranja / tag "ADICIONAL" destacado · Aparece al final de la cola|
|📦 Delivery | Tag "DELIVERY" en rojo/naranja · Diferenciado visualmente de mesa|



## 4.4 Reglas de Negocio Importantes

Los pedidos adicionales de una mesa (segunda factura) aparecen al final de la cola con tag "ADICIONAL" en color diferente y tamaño pequeño una vez entregados.

Si el mesero edita un pedido ya tomado por un cocinero, la tarjeta muestra badge parpadeante "ACTUALIZADO" para que el cocinero lo revise.

El tiempo estimado de preparación se calcula sumando el prep_time_minutes de los ítems del pedido (ítem más largo define el tiempo total, ya que se preparan en paralelo).

Notificación a mesero: inmediata al marcar "listo" + recordatorio cada 3 min si no recoge (configurable en admin).

Bebidas pueden marcarse listas independientemente de los platos (cada order_item tiene su propio status).


## 4.5 Decisiones de Diseño UI


|Recomendaciones UI Cocina|
|---|
|• Fondo oscuro (dark mode) para reducir fatiga visual en cocinas con vapor/calor.|
|• Fuente grande mínimo 16px, ítems al menos 24px para lectura a distancia.|
|• Sin animaciones distractoras; solo indicadores de estado sutiles.|
|• Colores de estado: usar borde coloreado + ícono, NO fondo completo (evita distracciones).|
|• Pantalla siempre activa (wake lock API); no hay timeout de sesión en la vista cocina.|
|• Botón de acción principal grande (al menos 48x48px táctil).|



## 5. INTERFAZ MESERO

Dispositivo objetivo: tableta 10"–12" (iPad o Android) · Operación táctil · Login con cuenta propia · Modo landscape recomendado


## 5.1 Autenticación y Asignación de Turno

Login con email + PIN (6 dígitos) para agilizar en turno. JWT con refresh cada 8h.

Al ingresar, el mesero escoge entre dos modos de trabajo:

Modo Asignado: selecciona las mesas de su turno. Las mesas ya tomadas por otro mesero aparecen deshabilitadas con nombre del asignado.

Modo Libre: no hay mesas fijas; se identifica por "Mesa + número" al crear el pedido. Recomendado para turnos con pocos meseros o bares.

La asignación puede ser auto-gestionada (el mesero elige sus mesas) o delegada (el admin asigna desde el panel). Recomendación MVP: el mesero elige, el admin puede reasignar.


## 5.2 Tablero de Mesas

Vista de grid con las mesas asignadas como tarjetas.

Cada tarjeta de mesa muestra: número, capacidad, estado del pedido activo (en preparación / listo / sin pedido).

Tap en mesa libre → flujo de toma de pedido.

Tap en mesa con pedido → detalle del pedido activo con opción de agregar más ítems (genera nuevo pedido adicional + nueva factura).

Botón flotante "+ Delivery" para crear pedido tipo delivery (no asociado a mesa).


## 5.3 Flujo de Toma de Pedido


|Paso | Descripción|
|---|---|
|Paso 1 — Selección de platos | Grid de ítems del menú del día filtrado por categoría "Platos". Cantidad con +/–. Campo de notas por ítem.|
|Paso 2 — Selección de bebidas | Mismo grid filtrado por categoría "Bebidas". Permite agregar sin platos (solo bebidas).|
|Paso 3 — Resumen y confirmación | Subtotal separado platos / bebidas. Total unificado. Campo de nota general.|
|Paso 4 — Pago | Selección de método: Efectivo, Tarjeta (Stripe Terminal / Culqi), Yape/Plin QR. Una factura por confirmación.|
|Paso 5 — Envío a cocina | Al confirmar pago, el pedido entra a la cola de cocina. La tarjeta de mesa cambia estado.|



## 5.4 Pedidos Adicionales


|Lógica de Pedido Adicional|
|---|
|• Si la mesa ya tiene un pedido activo, el botón "Agregar más" genera un nuevo Order con is_additional=true y parent_order_id apuntando al original.|
|• Se genera una nueva Invoice independiente (la original ya está pagada y no puede modificarse).|
|• En cocina, este pedido llega con tag ADICIONAL al final de la cola.|
|• El mesero puede ver todos los pedidos de la mesa en el detalle: activos (en prep) + entregados (historial comprimido).|
|• Los ítems ya entregados se muestran pequeños y en color gris para no confundir al cocinero.|



## 5.5 Delivery

Al seleccionar "+ Delivery", se pide nombre/alias del cliente y mesa de referencia (o campo libre).

El pedido sigue el mismo flujo de pago pero en cocina aparece con tag "DELIVERY" y sin número de mesa.

El mesero ve el pedido delivery en un carril aparte en su tablero (no en el grid de mesas).


## 5.6 Notificaciones al Mesero

Push notification en tableta cuando un pedido está "listo para recoger" (vía WebSocket + browser notification API).

Badge numérico en el ícono de notificaciones mostrando pedidos listos pendientes de recoger.

Recordatorio cada 3 minutos si no se recoge (configurable por admin).

Al confirmar recojo, el status del order_item cambia a "served".


## 5.7 Lógica Platos vs Bebidas


|Separación de Tiempos de Preparación|
|---|
|• Bebidas simples (gaseosas, agua): pueden marcarse "listas" inmediatamente o con timer corto (configurable por el admin por categoría).|
|• Bebidas elaboradas (cócteles, jugos): tienen prep_time_minutes configurado individualmente.|
|• La cocina puede marcar lista una bebida independientemente del plato del mismo pedido.|
|• El mesero ve en la tarjeta de mesa: "2 bebidas listas · 1 plato en preparación" de forma granular.|
|• Recomendación: separar la preparación en dos "estaciones" virtuales: Barra (bebidas) y Cocina (platos). Fase 2.|



## 6. INTERFAZ ADMINISTRADOR

Dispositivo objetivo: desktop / laptop · También accesible en tableta · Login con rol admin · Interfaz de tabs / secciones


## 6.1 Tabs del Panel Admin


|Tab | Descripción|
|---|---|
|🏠 Inicio (Dashboard) | Vista del día: menú, estimaciones, insumos críticos, ventas live.|
|📦 Insumos | Inventario, alertas, registro de insumos con IA.|
|📋 Recetario | Gestión de platos y bebidas, recetas, costos.|
|📊 Reportes | Ventas, costos, márgenes, rendimiento de personal.|
|🛒 Compras | Registro de compras, proveedores, historial.|
|⚙️ Configuración | Usuarios, roles, parámetros del sistema.|



## 6.2 Tab Inicio — Dashboard del Día

Sección: Menú de Hoy — checklist de platos disponibles con opción de desactivar los sin insumos. Botón de confirmación.

Tag de popularidad en cada plato: "Se vende mucho los lunes", "Plato estrella", basados en historial.

Sección: ¿Qué esperar hoy? — Estimación de clientes (modelo simple: promedio histórico por día de semana + factor eventos festivos). Hora pico estimada. Personal sugerido por turno.

Sección: Insumos críticos del día — Tabla con columnas: Insumo · Necesario hoy · Stock actual · A comprar · Unidad · Estado. Alertas visuales para críticos.

Botón: Descargar/Imprimir lista de compras (solo ítems en estado low/critical/out).

Sección: Seguimiento de hoy — Ventas del día (vs ayer en %), platos servidos, órdenes. Gráfico de métodos de pago. Ganancias por plato (precio venta – costo insumos).

Recomendaciones IA: 2–3 insights accionables generados por el modelo según la data del día.


## 6.3 Tab Insumos

Alertas al ingresar: insumos agotados/críticos que se usan en el menú de hoy (modal dismissible).

Tarjetas resumen: Insumo más crítico · Costo estimado de reposición · Insumo más usado hoy.

Tabla principal: todos los insumos con filtros de búsqueda y por estado. Paginada.

Agregar insumo: formulario manual O subir imagen de ticket/boleta → IA extrae datos → admin confirma.

Configurar alertas: umbral de stock por insumo, frecuencia de notificación.


## 6.4 Tab Recetario

Grid de tarjetas de platos con imagen, nombre, tags (estrella, eficiencia de costo).

Ver más: lista de insumos con cantidades, instrucciones de preparación, costo total de receta.

Crear receta: manual, por Excel (plantilla descargable), o por imagen con IA.

Filtros: Platos / Bebidas / Todos. Las bebidas sin preparación (agua, gaseosa) se marcan como "insumo directo" y no generan receta.

Editar / Eliminar con confirmación. Al editar, se recalculan costos automáticamente.

Recomendación IA: platos con mayor margen, platos con insumos en baja de precio.


## 6.5 Tab Reportes

Tarjetas KPI con filtro temporal (Hoy / Semana / Mes / Año): Ingresos · Costos · Ganancias · Margen %.

Gráfico de métodos de pago (pie chart).

Top 3 platos más vendidos + opción "Ver todos" con tabla completa.

Tabla de rentabilidad de platos: precio de venta, costo de preparación, margen, sugerencia de acción (mantener / subir / bajar precio).

Desglose de costos: Insumos · Mermas · Planilla · Operaciones. Comparación con mes anterior.

Rendimiento de personal: meseros con platos servidos, ventas totales, ticket promedio.

Notificaciones de oportunidades de mejora (IA): badge con número de insights nuevos.


## 6.6 Tab Compras

Tarjetas resumen: Gasto hoy · Gasto semana · Insumos repuestos.

Botón "Registrar compra": seleccionar proveedor (o crear nuevo), lista de insumos con check, cantidades y costos. Al confirmar, actualiza stock automáticamente.

Tabla de compras por proveedor: desplegable con detalle de ítems. Vista comprimida por defecto.

Sección Top Proveedores: ranking por frecuencia/volumen, opción de agregar/editar proveedor.

Tabla comparativa de precios de insumos (este mes vs anterior).

Sugerencia IA: alertas de baja de precios en insumos según contexto externo (requiere búsqueda web).


## 6.7 Tab Configuración

Gestión de usuarios: crear, editar, desactivar. Asignar rol (admin / mesero / chef).

Configuración de mesas: agregar, editar capacidad, secciones.

Parámetros de notificaciones: intervalos de recordatorio, umbrales de stock.

Configuración de impuestos (IGV u otro).

Preferencias de pasarela de pago (keys de Culqi/Stripe, modo test/producción).


## 7. FLUJOS EN TIEMPO REAL Y COMUNICACIÓN


## 7.1 WebSocket Rooms (Socket.io)


|Room | Descripción|
|---|---|
|room:kitchen | Cocina recibe todos los nuevos pedidos y actualizaciones.|
|room:waiter:{id} | Mesero recibe notificaciones de sus pedidos listos.|
|room:admin | Admin recibe ventas en vivo y alertas de insumos.|
|room:table:{id} | Estado de mesa en tiempo real (futuro: pantalla de cliente).|



## 7.2 Eventos WebSocket Principales


|Evento | Dirección | Descripción|
|---|---|---|
|order:created | Servidor → cocina | Nuevo pedido entra a la cola|
|order:item:claimed | Servidor → cocina | Ítem tomado por cocinero X|
|order:item:ready | Servidor → waiter:{id} | Ítem listo, recoger|
|order:item:updated | Servidor → cocina | Mesero editó un ítem en prep|
|order:additional | Servidor → cocina | Pedido adicional de mesa X|
|stock:alert | Servidor → admin | Insumo bajó de umbral mínimo|



## 7.3 Flujo Completo de un Pedido

Mesero selecciona platos → bebidas → confirma → pasarela de pago.

Pago exitoso → POST /api/orders → BD crea Order + OrderItems + Invoice.

Backend emite evento order:created a room:kitchen con payload de la tarjeta.

Cocinero toca tarjeta → PATCH /api/order-items/:id/claim → emite order:item:claimed.

Cocinero toca "Listo" → PATCH /api/order-items/:id/ready → emite order:item:ready a room:waiter:{id}.

Mesero recibe notificación → recoge plato → PATCH /api/order-items/:id/served.

Cuando todos los ítems = served → Order.status = delivered automáticamente.


## 8. ARQUITECTURA DOCKER Y ESTRUCTURA DE PROYECTO


## 8.1 Servicios Docker Compose


|Servicio | Rol|
|---|---|
|nginx | Reverse proxy, SSL, sirve el frontend build, proxy WS.|
|frontend | Vite build estático (o servidor de desarrollo en dev).|
|api | Fastify Node.js, puerto 3001.|
|db | PostgreSQL 16, volumen persistente.|
|redis | Redis 7, para BullMQ y Socket.io adapter.|
|pgadmin | Solo en dev/staging. Administrador visual de BD.|



## 8.2 Estructura de Carpetas del Proyecto


|Monorepo (recomendado con pnpm workspaces)|
|---|
|• /apps|
|•   /web        ← React PWA (mesero, cocina, admin)|
|•   /api        ← Fastify + Prisma|
|• /packages|
|•   /shared     ← Tipos TypeScript compartidos (DTOs, enums)|
|•   /ui         ← Componentes React reutilizables (design system)|
|• /infra|
|•   /docker     ← Dockerfiles por servicio|
|•   /nginx      ← nginx.conf|
|•   docker-compose.yml|
|•   docker-compose.dev.yml|
|• /scripts      ← Seeds, migraciones, utilitarios|



## 8.3 Variables de Entorno por Servicio


|Archivos .env requeridos|
|---|
|• .env.api: DATABASE_URL, REDIS_URL, JWT_SECRET, CULQI_KEY, STRIPE_KEY, ANTHROPIC_API_KEY|
|• .env.frontend: VITE_API_URL, VITE_WS_URL, VITE_CULQI_PUBLIC_KEY|
|• Nunca commitear .env; usar .env.example en el repo.|
|• En producción: usar Docker Secrets o Railway/Render environment variables.|



## 9. ALCANCE DEL MVP — PRIORIZACIÓN

El MVP debe cubrir el ciclo completo de un pedido de principio a fin. Las funcionalidades se dividen en tres fases.

Fase 1 — MVP Core (incluir desde el inicio)


|✅ Fase 1 — Core|
|---|
|• Autenticación y roles (admin, mesero, chef)|
|• Gestión de mesas y asignación a mesero|
|• Toma de pedidos (platos + bebidas) y confirmación|
|• Pago con Culqi (tarjeta y Yape/Plin) + efectivo manual|
|• Cola de cocina en tiempo real con WebSocket|
|• Estados de tarjeta cocina: sin empezar, en prep, listo|
|• Notificaciones de pedido listo al mesero|
|• Pedidos adicionales con segunda factura|
|• Tag Delivery en cocina|
|• Dashboard admin: menú del día, ventas básicas, insumos críticos|
|• CRUD de insumos, recetas y proveedores|
|• Registro de compras y actualización de stock|


Fase 2 — Mejoras Importantes


|🔵 Fase 2|
|---|
|• Estimación de clientes por día (modelo histórico)|
|• Reportes avanzados: rentabilidad por plato, desglose de costos|
|• Carga de recetas por imagen con IA (Claude API)|
|• Carga de compras por imagen de ticket con IA|
|• Separación de estaciones: barra vs cocina|
|• Modo libre mejorado con historial de mesero|
|• Configuración de alertas de stock personalizable|


Fase 3 — Funcionalidades Avanzadas


|🟡 Fase 3|
|---|
|• IA de recomendaciones con contexto externo (precios de mercado)|
|• Predicción de demanda con ML (Python microservicio)|
|• Multi-sucursal|
|• App móvil nativa (React Native si se requiere)|
|• Integración con impresora de tickets (Epson ESC/POS)|
|• Pantalla de estado para el cliente en mesa (QR)|



## 10. SISTEMA DE DISEÑO Y PALETA DE COLORES


## 10.1 Paleta Principal


|Token CSS | Uso|
|---|---|
|--color-primary: #1A3C5E | Azul oscuro — headers, títulos, acciones primarias|
|--color-accent: #E07B39 | Naranja — branding, CTA, tags importantes|
|--color-success: #1A7F4B | Verde — listo, confirmado, ok|
|--color-warning: #F5A623 | Amarillo — advertencia, por agotarse|
|--color-danger: #B02020 | Rojo — crítico, error, cancelado|
|--color-bg: #F8F9FA | Fondo general claro|
|--color-surface: #FFFFFF | Tarjetas, modales|
|--color-text: #2C2C2C | Texto principal|
|--color-muted: #666666 | Texto secundario, placeholders|



## 10.2 Colores de Estado de Pedido


|Estado | Especificación|
|---|---|
|Sin empezar | Borde: #CCCCCC · Fondo: #FFFFFF · Timer: rojo si tardío|
|En preparación | Borde: #1A3C5E · Fondo: #EAF2FB · Timer: azul|
|Listo para llevar | Borde: #1A7F4B · Fondo: #EAF7EF · Pulso suave|
|Adicional | Borde: #E07B39 · Fondo: #FDF3EB · Tag naranja|
|Delivery | Tag: #B02020 sobre #FDEAEA|



## 10.3 Breakpoints Responsivos


|Breakpoint | Uso principal|
|---|---|
|Mobile (sm) | ≤ 640px — Mesero en celular, notificaciones|
|Tablet (md) | 641–1024px — Mesero en tableta, cocina en tablet|
|Desktop (lg) | 1025–1440px — Admin en laptop|
|Wide (xl) | > 1440px — Cocina en pantalla grande|



## 10.4 Accesibilidad

Contraste mínimo 4.5:1 para texto normal (WCAG 2.1 AA).

Todos los botones con área táctil mínima 48×48px.

aria-labels en iconos sin texto visible.

Navegación por teclado completa en panel admin.

No usar solo color para comunicar estado (siempre incluir ícono o texto).


## 11. ESTRATEGIA DE TESTING Y CALIDAD


## 11.1 Stack de Testing


|Herramienta | Uso|
|---|---|
|Vitest | Unit tests frontend (rápido, compatible con Vite)|
|React Testing Library | Tests de componentes con user-event|
|Playwright | E2E: flujo completo mesero → cocina → admin|
|Supertest + Fastify inject | Tests de API (rutas, validaciones, auth)|
|k6 | Stress testing: simular 50 pedidos simultáneos|
|Prisma seed | BD de test con datos realistas|



## 11.2 Coverage Mínimo por Módulo


|Módulo | Coverage objetivo|
|---|---|
|Lógica de pedidos (órdenes, estados) | 90%|
|Cálculo de costos y márgenes | 90%|
|Autenticación y roles | 85%|
|Componentes UI críticos (checkout) | 80%|
|Rutas API (happy path + errores) | 85%|



## 11.3 CI/CD con GitHub Actions

PR abierto → lint (ESLint + Prettier) + type-check (tsc).

PR abierto → unit tests + API tests.

Merge a main → build Docker + push a registry.

Deploy automático a staging (Railway/Render).

Smoke test E2E en staging antes de aprobar deploy a producción.


## 12. DECISIONES PENDIENTES Y PREGUNTAS AL CLIENTE


|Pregunta | Impacto técnico|
|---|---|
|¿Hardware de POS disponible? | Define si usar Stripe Terminal físico o solo QR/link.|
|¿Necesitan factura electrónica SUNAT? | Si sí, integrar con OSE/PSE (ej. Nubefact). Cambia la estructura de invoice.|
|¿Cuántos cocineros simultáneos? | Afecta la UI de cocina (1 pantalla compartida vs 1 por cocinero).|
|¿Cuántas sucursales en el MVP? | Si es 1, simplificar. Si son N, tenant_id en todas las tablas.|
|¿Impresora de tickets? | Requiere integración ESC/POS (Epson, Star). Fase 2 recomendado.|
|¿App nativa o PWA? | PWA cubre el 90% del caso de uso. Nativa solo si se requiere acceso a hardware específico.|
|¿Módulo de reservas? | No está en el scope actual. ¿Se considera para el futuro?|
|¿Modelo de negocio SaaS o instalación única? | Afecta arquitectura de multitenancy y modelo de precios.|

