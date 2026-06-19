# ESTADO DEL PROYECTO
Última actualización: 2026-06-19 por Claude Code (Sonnet 4.6) — estación Oscar/Windows

> Protocolo de handoff: **todo agente actualiza este archivo al cerrar sesión.** Es lo que permite
> cambiar de estación o de agente sin perder el hilo. Mantén el formato de abajo.

## Fase actual
**Fase 1 y Fase 1.5 — completadas y aprobadas.** El núcleo operativo (clientes, OS con máquina de
estados e historial, fotos del equipo, pagos y log financiero) está cerrado.
**Próximo paso: Fase 2 — Presupuestos y finanzas** (ver `docs/03-ROADMAP-FASES.md`).

## Hecho en la última sesión (Fase 1.5)

### Checkpoint A — Fotos del equipo en Storage
- Migración `service_order_photos` (`20260619200406_create_service_order_photos.sql`), aplicada al
  Supabase real (`db push`):
  - Bucket `service_photos` **privado** (no público). Decisión deliberada: el prompt original pedía
    a la vez "solo lectura/subida si está autenticado" y "URL pública del bucket" — son
    contradictorios en Supabase (un bucket público se sirve sin pasar por RLS). Se priorizó
    seguridad: bucket privado + políticas RLS en `storage.objects` + **signed URLs** de corta
    duración en la UI (nunca una URL pública sin autenticar). Oscar aprobó esta decisión
    explícitamente.
  - Rutas con el patrón `{business_id}/{service_order_id}/{uuid}-{filename}`; la política RLS de
    Storage exige que el primer segmento coincida con `auth_business_id()` — aislamiento por tenant
    **a nivel de Storage**, no solo en la tabla.
  - Trigger `validate_service_order_photo`: mismo patrón de validación cruzada que
    `validate_service_order` (el `service_order_id` debe pertenecer al `business_id` de la fila).
  - Tabla inmutable desde el cliente (solo `select, insert`, sin `update`/`delete`).
- UI: sección "Galería / Fotos del equipo" en `service-order-detail.ts/html`, nuevo
  `service-order-photos.service.ts` (subida + listado con signed URLs).
- **Bug preexistente encontrado y corregido** (por el agente orquestador de Oscar, ya commiteado):
  `core/auth/auth.guard.ts` tenía una condición de carrera — en una recarga completa de página el
  guard podía correr antes de que `supabase.auth.getSession()` resolviera y redirigía a `/login`
  pese a haber sesión válida. Se corrigió haciendo el guard `async` y esperando `getSession()`
  directamente.
- **Verificado en navegador real** (Playwright headless contra el Supabase real, datos de prueba
  limpiados después): login → detalle de OS → galería vacía → subida de imagen → foto renderizada
  vía signed URL, cero errores de consola. **Aislamiento cross-tenant verificado**: un usuario de
  otro negocio no puede leer la fila de la foto (`select` → `[]`) ni generar una signed URL del
  mismo objeto (`Object not found`, sin filtrar ni la existencia del archivo).

### Checkpoint B — Pagos y log financiero
- Migración `payments` + `financial_entries`
  (`20260619222736_create_payments_and_financial_entries.sql`), aplicada al Supabase real:
  - `payments`: validación cruzada `service_order_id` ↔ `business_id` (trigger `validate_payment`,
    mismo patrón). Inmutable desde el cliente (`select, insert` únicamente).
  - `financial_entries`: **sin GRANT de INSERT para `authenticated` en absoluto** — verificado
    empíricamente que un insert directo desde un cliente autenticado es rechazado por RLS (código
    `42501`). La única vía de escritura es el trigger `trg_payments_log_financial_entry` (`AFTER
    INSERT` en `payments`, `SECURITY DEFINER`, mismo patrón que el historial de OS), que genera
    automáticamente una entrada `income` con descripción `"Pago de Orden #<folio>"`.
  - Por ahora `financial_entries` solo recibe `income` desde pagos; no hay alta manual de `expense`
    en esta fase (no se pidió; evaluar en Fase 2 si hace falta).
- UI:
  - Detalle de OS: sección "Pagos" (Signal Form: monto + método vía `payments.service.ts`), "Total
    pagado" recalculado tras cada pago, lista de pagos.
  - Nuevo módulo **Finanzas** (`features/finance/`, ruta `/finance`, enlace en el shell): tarjeta de
    "Balance total" (`computed()` sobre incomes − expenses) y lista de movimientos desde
    `financial_entries` vía Resource API. Solo lectura, como se pidió.
- **Verificado en navegador real** (Playwright headless, datos de prueba limpiados después): login
  → detalle de OS → "Total pagado: S/ 0.00" → registrar pago S/150.50 efectivo → "Total pagado: S/
  150.50" → módulo Finanzas muestra "Pago de Orden #1" y balance "S/ 150.50". Cero errores de
  consola.

### Cierre de sesión
- `docs/02-MODELO-DATOS.md`: documentadas `service_order_photos`, `payments`, `financial_entries`
  (antes listadas como "pendientes"); sección eliminada.
- `docs/03-ROADMAP-FASES.md`: Fase 1.5 marcada `(completada)`.
- **Verificado en todo momento:** `npm run build` ✓ (701.94 kB, dentro del presupuesto de 800kB),
  `npm test` (Vitest) ✓, `npm run lint` ✓.
- Datos de prueba E2E (negocios/usuarios/clientes/órdenes/pagos sintéticos) creados con
  `service_role` y limpiados al terminar cada checkpoint, verificado explícitamente.

## En progreso / a medio hacer
- Nada a medias. Fase 1 y Fase 1.5 completas, verificadas y aprobadas por Oscar en los cinco
  checkpoints acumulados (A/B/C de Fase 1, A/B de Fase 1.5).

## Siguiente paso concreto
- **Fase 2 — Presupuestos y finanzas** (`docs/03-ROADMAP-FASES.md`): formalizar presupuestos
  (aprobado/rechazado/historial) y dar visibilidad financiera vía **vistas SQL** en Postgres (por
  día/mes/año, top clientes, servicios más solicitados) + cuentas por cobrar.
- Antes de tocar la BD: leer `docs/02-MODELO-DATOS.md` (ya incluye `payments`/`financial_entries`
  como base para las vistas de reportes). Usar las skills `supabase-migration` y `angular-feature`
  para mantener el patrón ya establecido.
- Posible punto de partida: una tabla `budgets`/`quotes` (presupuesto previo a la OS o ligado a
  ella) con su propio ciclo de estados — definir el modelo exacto al iniciar la fase, igual que se
  hizo con `customers`/`service_orders`/`service_order_photos`/`payments`.
- Si se necesita alta manual de gastos generales (no ligados a una OS) en `financial_entries`,
  decidir el mecanismo en Fase 2 (probablemente un RPC `security definer` dedicado, para no abrir un
  GRANT de INSERT directo y mantener el log a prueba de manipulación).

## Decisiones tomadas (resumen, detalle en docs/decisiones/)
- Multi-tenant desde el día uno; modelo **1 usuario → 1 negocio** (`profiles`), N:N diferido. [0001]
- Stack Angular 22 + Supabase + Vercel; npm como package manager. [0002]
- La Orden de Servicio es la entidad central (fases del ciclo de vida, no módulos). [0003]
- Sin Nx por ahora (reevaluar en Fase 7). [0004]
- PrimeNG 21 sobre Angular 22 con `legacy-peer-deps` + cdk 22, temporal. [0005]
- **Esquema de BD en inglés sin excepción**, UI en español. [0006]
- Soft-delete reforzado a nivel de BD (sin GRANT de DELETE) en `customers`; mismo principio
  aplicado a `service_orders` (se cancela, no se borra), `service_order_photos` y `payments`
  (inmutables: solo `select, insert`).
- Historial de OS y log financiero (`financial_entries`) escritos únicamente por triggers
  `SECURITY DEFINER`, nunca por el cliente — `financial_entries` no tiene ni GRANT de INSERT.
- **Bucket de Storage privado + signed URLs**, no bucket público, para las fotos del equipo
  (`service_photos`). Aislamiento por tenant reforzado también a nivel de Storage (no solo en la
  tabla), vía el primer segmento de la ruta del objeto.
- MCP: Supabase y Context7 conectados; GitHub MCP pendiente de credenciales si se necesita.

## Bloqueos / dudas para Oscar
1. **Credenciales para GitHub MCP** (opcional, no bloqueante). Comandos en
   `docs/04-CONVENCIONES.md` si se quiere activar más adelante.
2. **Inyección de env en Vercel.** Hoy la anon key (pública) vive en `src/environments/
   environment.development.ts`. Para producción, decidir si Vercel la inyecta en build o se deja
   commiteada (es pública, RLS la protege). Pendiente de pulir antes de un primer deploy real.
3. **Bundle initial ~702kB** (presupuesto en 800kB en `angular.json`). Normal por incluir
   `supabase-js` real; revisar margen al avanzar en Fase 2.
4. **Dato real/demo en el Supabase remoto**: existe un negocio `Mi Taller PCMYM` (slug `taller-1`,
   id `00000000-0000-0000-0000-000000000001`) creado fuera de esta sesión (probablemente al
   verificar el fix del authGuard). No se tocó. Si es solo un demo de prueba, considerar limpiarlo
   antes de un primer dato real; si es el negocio real de Oscar, ignorar esta nota.
5. **Alta manual de gastos** (`financial_entries.entry_type = 'expense'`): no implementada en esta
   fase (no se pidió). Si Fase 2 la necesita, definir el mecanismo (ver "Siguiente paso concreto").
