# ESTADO DEL PROYECTO
Última actualización: 2026-09-07 por Codex — estación Oscar/Windows

> Protocolo de handoff: **todo agente actualiza este archivo al cerrar sesión.** Es lo que permite
> cambiar de estación o de agente sin perder el hilo. Mantén el formato de abajo.

## Fase actual
**Sincronización de presupuestos con inventario y repuestos de OS.** Implementada, migrada al
Supabase remoto y verificada con pruebas, lint, build y lint de esquema.

## Carga inicial de inventario (Supabase remoto)
- Se cargaron 19 productos en el negocio `Mi Taller PCMYM` (`taller-1`) mediante el RPC
  `create_product_with_initial_stock`, con SKU internos, precios de venta redondeados y kardex
  de inventario inicial.
- Verificación remota: 19 productos, 58 unidades, valorización al costo S/ 700.00 y valorización
  a precio de venta S/ 1,445.00; se registraron 19 movimientos iniciales.
- El Logitech M90 quedó con precio de venta S/ 25.00, tal como se solicitó.
- **Pendiente de confirmación:** las cantidades detalladas suman 58 unidades (la primera tabla
  suma 19 aunque indica 18; la segunda suma 39). No se corrigió la diferencia para preservar
  exactamente las cantidades por fila entregadas.

## Mejora de alta rápida de productos (SKU y autocompletado)
- Migraciones remotas aplicadas:
  - `20260906120000_auto_product_sku_and_defaults.sql` añade generación de SKU por familia,
    marca, modelo y variante, con sufijo automático ante colisiones; también deja los defaults
    del RPC en stock inicial 1 y stock mínimo 1.
  - `20260906122000_align_product_sku_tokens_and_backfill.sql` alinea el token de modelo entre
    backend y frontend y completa SKU nulos existentes.
- El formulario de `/inventory` genera una previsualización de SKU en tiempo real, permite edición
  manual excepcional y usa el RPC como autoridad final de unicidad.
- Nombre, marca y modelo ofrecen sugerencias tenant-scoped a partir del catálogo actual. Al elegir
  un producto como referencia se copian categoría, marca, modelo, compatibilidad, proveedor,
  notas, costo y precio de venta; stock y SKU permanecen editables/automáticos según corresponda.
- Los defaults de nuevos productos en la UI son stock inicial 1 y stock mínimo 1. Los productos
  existentes no cambian; solo se completó el SKU nulo del `Mouse blanco Genius DX-110` como
  `PCMYM-MOU-GEN-DX110-WHT`.
- Verificación local: 11 pruebas Vitest, lint y build Angular en verde. Build inicial: 742.92 kB.

## Impresión de recepción y entrega de órdenes de servicio
- Migración remota aplicada: `20260906140000_add_service_order_delivery.sql`.
- Nueva tabla multi-tenant `service_order_deliveries` con RLS de solo lectura para el cliente y
  registro auditable de receptor, documento, trabajo realizado, observaciones y garantía.
- Nuevo RPC atómico `deliver_service_order`: valida que la OS esté `ready`, registra la entrega y
  cambia el estado a `delivered`. La BD bloquea el cambio directo a `delivered` sin comprobante.
- En el detalle de la OS se añadieron la hoja de recepción, el modal de cierre de entrega y el
  comprobante reimprimible. Los documentos muestran QR local de seguimiento, equipo, cliente,
  repuestos, presupuesto aprobado, pagos, saldo y garantía.
- Se añadió la ruta protegida `/service-orders/:id/print/:kind` y la dependencia local `qrcode`.
- Verificación local: 13 pruebas Vitest, lint y build Angular en verde. Bundle inicial: 745.90 kB.
- Verificación del esquema remoto: `supabase db lint --linked` sin errores.
- Validación funcional realizada por el usuario; queda como mejora operativa opcional revisar
  impresión física/PDF en formato A4 y ajustar el texto de garantía del taller.

## Tipo de trabajo Garantía
- La migración `20260906150000_add_warranty_work_type.sql` amplía la restricción de
  `service_orders.work_types` con el valor `warranty`, sin modificar órdenes existentes.
- El alta de OS, el detalle y los filtros del tablero muestran ahora la opción **Garantía**.

## Sincronización de presupuestos con inventario y repuestos
- Migración remota aplicada: `20260907100000_link_budget_items_to_inventory.sql`.
- `budget_items` ahora clasifica cada línea como `part`, `labor` u `other`; los repuestos (`part`)
  enlazan obligatoriamente un `products.id` y usan cantidades enteras. El precio queda congelado
  en la cotización y las líneas de mano de obra/otros nunca descuentan stock.
- `service_order_parts.budget_id` conserva la trazabilidad del presupuesto que originó una reserva.
- Nuevo RPC atómico `apply_budget_parts_to_service_order`: solo opera presupuestos aprobados,
  valida todo el stock antes de mutar, registra entradas/salidas en el kardex, reserva o devuelve
  únicamente el delta y es idempotente al repetirlo. Los repuestos añadidos manualmente a la OS se
  conservan.
- En `/budgets` y en el detalle del presupuesto se añadieron selectores de productos activos,
  autocompletado de descripción/precio y visualización de stock. Tras aprobar un presupuesto,
  aparece **Aplicar repuestos a la OS** con resumen de unidades reservadas/devueltas y errores
  legibles.
- Tipos Supabase regenerados desde el proyecto enlazado. Verificación remota: `supabase migration
  list` muestra la migración aplicada y `supabase db lint --linked` no reporta errores.
- Verificación local: 14 pruebas Vitest, `npm run lint` y `npm run build` en verde.

## Hecho en esta sesión (Inventario + Repuestos V1)
- **Base de datos & Supabase:**
  - Migración aplicada en remoto: `20260906080000_create_inventory_and_parts.sql`.
  - Tablas multi-tenant con RLS estricto e integridad contra stock negativo (`CHECK (current_stock >= 0)`):
    - `products`: Catálogo completo de hardware, repuestos e insumos con SKU único por tenant, precios y stock mínimo.
    - `inventory_movements`: Kardex inmutable para auditoría de cada movimiento (`in`, `out`, `adjustment`).
    - `service_order_parts`: Repuestos asignados a una orden con congelación histórica de precio de venta y costo.
  - Funciones Postgres atómicas (`SECURITY DEFINER` con bloqueo de filas `FOR UPDATE`):
    - `create_product_with_initial_stock`: Creación e inicialización en Kardex.
    - `adjust_product_stock`: Ajuste manual con delta y registro inmutable.
    - `add_part_to_service_order`: Descuento atómico de stock y congelación de precio en la OS.
    - `modify_service_order_part_qty`: Modificación de cantidad con devolución/descuento proporcional de stock.
    - `remove_part_from_service_order`: Retorno íntegro e inmediato del stock a inventario.
  - Tipos TypeScript regenerados y sincronizados con la BD remota (`database.types.ts`).
- **Servicios y Modelos (Angular 22 - Signal First):**
  - `inventory.models.ts`: Tipos, utilidades de margen/ganancia y diccionarios de categorías y motivos.
  - `inventory.service.ts`: Consultas reactivas con Resource API, KPIs agregados y métodos de ajuste.
  - `order-parts.service.ts`: Servicios para gestión de repuestos en órdenes de servicio.
- **UI Módulo de Inventario (`/inventory`):**
  - `inventory-shell.ts/html`: Contenedor principal con sub-navegación por pestañas (Resumen, Productos, Movimientos, Stock bajo) y orquestación de drawers/modales.
  - `inventory-summary.ts/html`: Bento grid con métricas operativas (SKUs activos, unidades, valoración económica, alertas) y tabla de atención inmediata.
  - `product-list.ts/html`: Buscador reactivo, filtros por categoría y stock, acciones rápidas (+/-) y apertura de drawer.
  - `product-drawer.ts/html`: Panel lateral responsivo con soporte para creación, edición (con stock actual protegido contra edición directa arbitraria) y ficha detallada con Kardex.
  - `stock-adjustment-modal.ts/html`: Modal de ajuste rápido con proyección de stock en tiempo real y prevención de stock insuficiente.
  - `inventory-movements.ts/html`: Historial y auditoría de Kardex con chips de filtrado.
  - `low-stock-list.ts/html`: Vista especializada para reposición de productos agotados y críticos con cálculo de costo estimado.
- **Integración con Órdenes de Servicio:**
  - `service-order-detail.ts/html`: Nueva tarjeta de **Repuestos Asignados** con conteo, listado, precios congelados, subtotales y suma económica.
  - `add-order-part-modal.ts/html`: Modal de búsqueda en inventario con proyección de stock y selector de cantidad validado.
  - `edit-order-part-modal.ts/html`: Modales para ajuste de cantidad o retiro con retorno inmediato al inventario.
- **Navegación Global:**
  - Ruta `/inventory` registrada en `app.routes.ts`.
  - Acceso directo a "Inventario" añadido tanto al sidebar de escritorio como al menú inferior móvil (`shell.html`).
- **Verificación:**
  - `npm run build`: Bundle generado exitosamente sin errores en 3.8s.
  - `npm run lint`: 0 errores, 0 advertencias en todo el workspace.
  - `npm test`: 8 pruebas unitarias pasando (incluyendo vitest suite en `inventory.spec.ts`).

## Hecho en esta sesión (Tablero operativo y alta rápida)
- **Migración:** `20260819090000_add_service_order_work_types.sql` añade `service_orders.work_types`
  como arreglo validado con tres categorías combinables: formateo, reparación y cambio de repuesto.
  Las órdenes existentes quedan sin clasificar y no se alteran sus datos.
- **Tablero:** etiquetas por tipo de trabajo, borde y orden prioritaria para urgentes, antigüedad de
  recepción, alertas de entrega, filtro por tipo y filtro de atención (urgentes, vencidas o listas
  para entrega desde hace tres días). La lista conserva todos los estados para no ocultar órdenes
  que necesitan cierre manual.
- **Nueva orden:** buscador de clientes por nombre o celular, confirmación del teléfono al elegir un
  cliente, alta inline cuando no existe, chips de accesorios, sugerencias de equipo/marca y técnico
  actual asignado por defecto. Los tipos de trabajo también se pueden ajustar desde el detalle de
  una OS tras el diagnóstico.
- **Verificación local:** `npm run build`, `npm run lint` y `npm test -- --watch=false` pasaron con
  Node 24.19.0. Bundle inicial: 728.71 kB.
- **Pendiente inmediato:** aplicar la migración al proyecto Supabase y regenerar `database.types.ts`
  desde el proyecto enlazado antes de publicar esta rama.

## Hecho en esta sesión (Seguimiento público — ampliación solicitada)
- **Migración:** `20260818170000_expand_public_tracking_summary.sql` amplía el RPC público
  `get_public_tracking_info()`. El enlace ahora devuelve el comprobante de recepción del equipo
  (marca, modelo, serie, accesorios, observaciones y falla reportada), los ítems del último
  presupuesto enviado/aprobado/rechazado y, solo ante presupuesto aprobado, total pagado y saldo
  pendiente. Mantiene ocultos método de pago, personal del taller, prioridad y notas internas.
- **Angular:** el seguimiento móvil prioriza una tarjeta visual de estado actual con un mensaje
  contextual y fecha estimada. Las etapas quedan como tarjetas legibles debajo; luego se muestran
  presupuesto/pagos, equipo recibido y falla reportada.
- **Verificación local:** `npm run build`, `npm run lint` y `npm test -- --watch=false` pasaron
  con Node 24.19.0. Bundle inicial: 728.71 kB (presupuesto de advertencia: 800 kB).
- **Pendiente inmediato:** aplicar la nueva migración al proyecto Supabase remoto y verificar con
  un enlace de una OS real o de prueba que tenga presupuesto aprobado y pagos.

## Hecho en esta sesión (Fase 3)
- **Migraciones:** 
  - `public_tracking.sql` (Añadido `tracking_token` a `service_orders` y RPC `get_public_tracking_info` para lectura segura pública).
  - `n8n_webhooks.sql` (Habilitado `pg_net` y trigger `AFTER UPDATE` en OS para hacer POST a URL dinámica leída desde los settings del proyecto Supabase).
- **Angular:** Módulo de tracking público (`/seguimiento/:token`) implementado con diseño premium. Tipos regenerados (`database.types.ts`).
- **UI:** Se agregó el botón "Link para el cliente" en el detalle de la OS (`service-order-detail.html`) para copiar al portapapeles.
- **Branding:** Se integró el logotipo propio (`PCMYM_isotipo.svg`), corrigiendo el `viewBox` para eliminar márgenes vacíos y aplicándolo al favicon y a la barra de navegación.
- **Despliegue a Vercel:** Proyecto publicado exitosamente en Vercel. Se resolvió el error 404 configurando el `outputDirectory` a `dist/crm/browser` y los rewrites de SPA a través del archivo `vercel.json`. Se inyectaron las credenciales reales (`supabaseUrl` y `supabaseAnonKey`) en `environment.ts`.

## Tareas pendientes para Oscar (Infraestructura / n8n)
- Configurar en el editor SQL de Supabase (o CLI): `ALTER DATABASE postgres SET "app.settings.n8n_webhook_url" TO 'https://tu-n8n.url/webhook';` y luego `SELECT pg_reload_conf();` para activar el webhook real.
- Asegurarse de que la extensión `pg_net` esté activa en el dashboard de Supabase (Settings > Database > Extensions).


## Hecho en esta sesión (Fase 2)

### Paso 1 — Base de datos: presupuestos y gasto manual
- Migración `budgets`/`budget_items` (`20260620054644_create_budgets.sql`), aplicada al Supabase
  real (`db push`):
  - `budgets`: máquina de estados propia `draft → sent → approved | rejected` (validada en
    Postgres, `is_valid_budget_transition`/`validate_budget`, mismo patrón que la OS). `approved`/
    `rejected` son terminales — un presupuesto rechazado/aprobado nunca se reabre, se crea uno
    nuevo. Folio correlativo por negocio (mismo patrón que `service_orders.folio`).
  - `budget_items`: ítems congelados una vez el presupuesto deja `draft` (trigger
    `validate_budget_item`/`validate_budget_item_delete`) — lo que vio el cliente no puede cambiar
    bajo una aprobación/rechazo. `recalculate_budget_total` (`AFTER`, `SECURITY DEFINER`) mantiene
    `budgets.total_amount` sincronizado con la suma de ítems.
  - `budget_status_history`: inmutable, mismo patrón que `order_status_history` (sin GRANT de
    escritura para `authenticated`).
  - RPC `change_budget_status()` (mismo shape que `change_service_order_status`).
  - RPC `record_expense()`: única vía de escritura de `entry_type = 'expense'` en
    `financial_entries` (que sigue sin GRANT de INSERT directo) — resuelve el `business_id`
    internamente, nunca confía en el del cliente. Esto cierra el punto que había quedado abierto en
    Fase 1.5 ("Bloqueos / dudas para Oscar" #5 de la sesión anterior).
- **Bug encontrado y corregido en la misma sesión** (migración
  `20260620060050_fix_budget_item_delete_cascade.sql`): `validate_budget_item_delete()` leía el
  `status` del presupuesto padre para decidir si bloquear el delete, pero en un delete en cascada
  (`businesses` → `service_orders` → `budgets` → `budget_items`) el padre ya está borrado cuando el
  trigger del hijo corre, así que la lectura siempre daba `null` y `null is distinct from 'draft'`
  bloqueaba **todo** delete en cascada, incluso con `service_role`. Se detectó al preparar la
  limpieza de datos de prueba E2E. Corregido para solo bloquear si el padre **todavía existe** y no
  está en `draft`.

### Paso 2 — Base de datos: vistas SQL de reportes
- Migración `20260620054853_create_financial_report_views.sql`, aplicada al Supabase real:
  `v_income_expense_daily`, `v_income_expense_monthly`, `v_top_customers`, `v_top_equipment_types`,
  `v_accounts_receivable`. Todas `with (security_invoker = true)` (Postgres 17 en este proyecto) —
  corren con los privilegios/RLS de quien consulta, así que quedan acotadas por tenant
  automáticamente vía el RLS de las tablas base, sin filtro adicional necesario.
  `v_accounts_receivable` cruza el último presupuesto `approved` de cada OS contra `payments` para
  el saldo pendiente.

### Paso 3 — UI: módulo de presupuestos
- `features/budgets/`: `budgets.models.ts`, `budgets.service.ts`, `budget-form.ts/html` (crear
  presupuesto con ítems dinámicos), `budget-detail.ts/html` (ver/agregar/quitar ítems mientras está
  en `draft`, botones de transición de estado, historial).
- Tarjeta "Presupuestos" en `service-order-detail.html` (lista + botón "Nuevo").
- Rutas anidadas bajo `service-orders`: `:id/budgets/new`, `:id/budgets/:budgetId`.
- `database.types.ts` regenerado con `npx supabase gen types typescript --linked` (no se editó a
  mano) para recoger `budgets`/`budget_items`/`budget_status_history` y las vistas nuevas.

### Paso 4 — UI: dashboard financiero y gasto manual
- `finance.service.ts`: `recordExpense()` (vía RPC) + lectura de las 4 vistas de reportes.
- `finance-dashboard.html/ts` rediseñado por completo (antes era solo balance + lista): tarjetas de
  resumen (balance total, ingresos del mes, gastos del mes, cuentas por cobrar), gráfico de barras
  CSS ingresos-vs-gastos de los últimos 6 meses (sin librería de charts, para no sumar peso al
  bundle), top clientes, equipos más atendidos, cuentas por cobrar, formulario de alta de gasto
  manual, y la lista de movimientos que ya existía.

### Verificación
- `npm run build` ✓ (726.76 kB inicial, dentro del presupuesto de 800kB), `npm test` (Vitest) ✓,
  `npm run lint` ✓ (incluye 4 errores de `label-has-associated-control` que ya existían en
  `service-order-detail.html` desde Fase 1.5 — se corrigieron en esta sesión de paso, junto con 2
  nuevos del dashboard financiero).
- **Verificación E2E del backend contra el Supabase real** (script Node temporal con
  `@supabase/supabase-js`, no commiteado): dos negocios sintéticos + usuarios `auth` reales creados
  con `service_role`, firmados con `signInWithPassword` para probar exactamente el camino RLS que
  usa la app (no solo `service_role`, que se salta RLS). 22/22 checks pasaron: folio/estado inicial
  del presupuesto, recálculo de `total_amount`, transición `draft→sent` y bloqueo de ítems tras
  enviarse, transición inválida `sent→draft` rechazada, `sent→approved`, pago registrado y su
  entrada de ingreso automática, `v_accounts_receivable` con el saldo correcto, `record_expense()`,
  bloqueo de INSERT directo en `financial_entries`, las 3 vistas de reportes restantes, y
  aislamiento cross-tenant (un segundo negocio no ve ni puede insertar en los datos del primero).
  Datos de prueba y usuarios `auth` limpiados al terminar, verificado explícitamente con una
  segunda consulta que confirmó cero negocios/usuarios `e2e-fase2-*` remanentes.
- **No se hizo verificación interactiva en navegador real** (Playwright u otra herramienta de
  automatización de navegador no estaban disponibles en esta sesión). Se confirmó que `ng serve`
  sirve la SPA correctamente (`curl` a `localhost:4200` devuelve el HTML esperado), pero no se hizo
  click-through real de los flujos nuevos (crear presupuesto, cambiar estado, registrar gasto,
  revisar el dashboard). **Recomendado para Oscar antes de considerar esto 100% production-ready
  desde la UI**: abrir `/service-orders/:id`, crear un presupuesto con un par de ítems, enviarlo,
  aprobarlo, y revisar `/finance` con el gasto manual y los datos resultantes.

### Cierre de sesión
- `docs/02-MODELO-DATOS.md`: documentadas `budgets`, `budget_items`, `budget_status_history`, los
  dos RPCs nuevos, y las 5 vistas de reportes.
- `docs/03-ROADMAP-FASES.md`: Fase 2 marcada `(completada)`.

## En progreso / a medio hacer
- Nada a medias en el código. El único pendiente es la verificación visual en navegador real
  mencionada arriba (no es un bloqueo de código, es una verificación manual recomendada).

## Siguiente paso concreto
- **Fase 4 — Base de conocimiento** (`docs/03-ROADMAP-FASES.md`): FAQ y guías paso a paso
  gestionables por tenant, con imágenes y búsqueda para reducir consultas repetitivas.
- Antes de tocar la BD: leer `docs/02-MODELO-DATOS.md` actualizado (ya incluye `budgets` como base
  para mostrarle al cliente final si su presupuesto fue aprobado).
- Posible punto de partida para el token público: una columna `tracking_token uuid default
  gen_random_uuid()` en `service_orders` (o una tabla aparte si se prefiere poder revocar/rotar el
  token sin tocar la OS), y una vista/RPC de solo lectura que expomga lo mínimo necesario (estado,
  folio, fechas) sin requerir `auth.uid()` — cuidado: cualquier ruta pública sin sesión necesita su
  propio diseño de RLS/política, no puede reusar `auth_business_id()` (que depende de
  `auth.uid()`). Evaluar si conviene una Edge Function en vez de exponer una tabla/vista pública.

## Decisiones tomadas (resumen, detalle en docs/decisiones/)
- Multi-tenant desde el día uno; modelo **1 usuario → 1 negocio** (`profiles`), N:N diferido. [0001]
- Stack Angular 22 + Supabase + Vercel; npm como package manager. [0002]
- La Orden de Servicio es la entidad central (fases del ciclo de vida, no módulos). [0003]
- Sin Nx por ahora (reevaluar en Fase 7). [0004]
- PrimeNG 21 sobre Angular 22 con `legacy-peer-deps` + cdk 22, temporal. [0005]
- **Esquema de BD en inglés sin excepción**, UI en español. [0006]
- Soft-delete reforzado a nivel de BD (sin GRANT de DELETE) en `customers`; mismo principio en
  `service_orders`, `service_order_photos`, `payments` y ahora **`budgets`** (se rechaza vía
  estado, nunca se borra).
- Historial de OS, log financiero y ahora **historial de presupuestos** escritos únicamente por
  triggers `SECURITY DEFINER`, nunca por el cliente.
- **`financial_entries` sigue sin GRANT de INSERT para `authenticated`** — ahora con dos vías de
  escritura, ambas `SECURITY DEFINER`: el trigger de `payments` (Fase 1.5, ingresos) y el nuevo RPC
  `record_expense()` (Fase 2, gastos manuales).
- **Presupuestos congelados tras `sent`**: los ítems de un presupuesto solo se editan mientras está
  en `draft`; una vez enviado, ni el negocio puede alterar lo que el cliente ya vio sin pasar por
  aprobación/rechazo. Decisión propia de esta sesión (no especificada explícitamente en el prompt),
  elegida por integridad de la cotización frente al cliente.
- **Reportes financieros vía vistas SQL `security_invoker`**, no RPCs ni tablas materializadas: se
  apoyan en el RLS de las tablas base para el aislamiento por tenant, sin lógica de filtrado
  duplicada en cada vista.
- **`equipment_type` como proxy de "servicio más solicitado"** en `v_top_equipment_types`: no existe
  todavía un catálogo de servicios separado del equipo recibido. Si se necesita uno real, evaluar en
  Fase 6 (Inventario y catálogo).
- MCP: Supabase y Context7 mencionados como conectados en sesiones previas, pero **no estaban
  disponibles en esta sesión** (se verificó contra el Supabase real vía la CLI `supabase` enlazada
  y un script Node con `@supabase/supabase-js`, no vía MCP). GitHub MCP sigue pendiente de
  credenciales si se necesita.

## Bloqueos / dudas para Oscar
1. **Verificación visual en navegador real pendiente** (ver sección de Verificación arriba) — no
   bloqueante para el código, pero recomendado antes de dar por 100% cerrado el aspecto de UI de
   esta fase.
2. **Inyección de env en Vercel.** Sigue pendiente de pulir antes de un primer deploy real (mismo
   punto que Fase 1.5).
3. **Bundle initial ~727kB** (presupuesto en 800kB en `angular.json`). Subió ~25kB con el módulo de
   presupuestos + dashboard financiero; sigue con margen pero vale la pena vigilarlo en Fase 3.
4. **Dato real/demo en el Supabase remoto**: el negocio `Mi Taller PCMYM` (slug `taller-1`)
   mencionado en el handoff de Fase 1.5 no se tocó en esta sesión. Sigue pendiente decidir si es
   demo (limpiar) o real (ignorar).
5. **`v_top_equipment_types` como proxy de servicios**: si Oscar quiere un catálogo de servicios
   real y no solo el tipo de equipo, hay que definir el modelo (probablemente en Fase 6).
