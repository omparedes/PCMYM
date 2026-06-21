# ESTADO DEL PROYECTO
Última actualización: 2026-06-20 por Claude Code — estación Oscar/Windows

> Protocolo de handoff: **todo agente actualiza este archivo al cerrar sesión.** Es lo que permite
> cambiar de estación o de agente sin perder el hilo. Mantén el formato de abajo.

## Fase actual
**Fase 4 — Base de conocimiento.** En curso.
Fase 3 (Cliente y notificaciones) se ejecutó con éxito (arquitectura por Claude, infraestructura por Antigravity).

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
- **Fase 3 — Cliente y notificaciones** (`docs/03-ROADMAP-FASES.md`): seguimiento público por token
  (`/seguimiento/{uuid}`, sin login) y notificaciones automáticas vía n8n + WhatsApp Cloud API +
  email con Resend.
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
