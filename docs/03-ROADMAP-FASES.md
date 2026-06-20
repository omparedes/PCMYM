# 03 — Roadmap por fases

Cada fase tiene **objetivo**, **entregables** y **Definition of Done (DoD)**.
Regla global de DoD: una fase **no se cierra** sin (1) tests verdes, (2) migraciones aplicadas y
(3) `ESTADO.md` actualizado.

---

## Fase 0 — Bootstrap *(completada)*
**Objetivo:** cimientos del proyecto, sin funcionalidades.
**Entregables:**
- Estructura del workspace (`apps/`, `supabase/`, `automation/`, `docs/`).
- Sistema de contexto cross-agente (AGENTS/CLAUDE/GEMINI + `/docs` + protocolo `ESTADO.md`).
- Convenciones y guardrails (seguridad, RLS-first, multi-tenant, commits, migraciones).
- Scaffolding Angular 22 (Tailwind + PrimeNG + cliente Supabase + estructura por feature + login placeholder).
- Estructura `supabase/` + primera migración: tablas base multi-tenant (`negocios`, `perfiles`) + RLS.
- Roadmap (este archivo) y ADRs iniciales.
- Git inicializado con higiene de secretos.

**DoD:** workspace versionado sin secretos; `npm run build` y `npm test` corren en `apps/crm`;
migración base aplica en Supabase local; `ESTADO.md` actualizado; Oscar aprueba.

---

## Fase 1 — Núcleo operativo (MVP real) *(núcleo completado)*
**Objetivo:** resolver el 80% del dolor y permitir registrar información desde el día uno.
**Entregables (completados):**
- Módulo **Clientes** (CRUD + búsqueda + archivado/soft-delete; sin borrado físico).
- **Orden de Servicio (OS)** con máquina de estados:
  `pending → diagnosing → repairing → waiting_parts → ready → delivered`, con `cancelled`
  alcanzable desde cualquier estado no terminal. Validada **en Postgres** (trigger), no solo en el cliente.
- **Historial de transiciones** de la OS (`order_status_history`), escrito únicamente por un
  trigger `SECURITY DEFINER` — inmutable e independiente del cliente que escriba.
- Tablero por estado, alta de OS (con creación inline de cliente) y detalle con línea de tiempo.

**DoD (cumplido):** migraciones de dominio con RLS por `business_id`; CRUD de clientes y OS
funcionando con Signal Forms + Resource API; cambios de estado registrados en historial mediante
trigger de BD; tests/build/lint verdes; `ESTADO.md` actualizado; Oscar aprobó Checkpoints A, B y C.

**Quedó fuera de esta tanda → ver Fase 1.5 abajo.**

---

## Fase 1.5 — Fase 1 restante *(completada)*
**Objetivo:** completar el núcleo operativo con lo que se dejó explícitamente fuera de la Etapa 1/2
de Fase 1 (fotos, pagos, log financiero), antes de pasar a presupuestos formales (Fase 2).
**Entregables:**
- **Fotos del equipo** en Supabase Storage (bucket con políticas por `business_id`), ligadas a la
  OS (probablemente una tabla `service_order_photos` con referencia al objeto de Storage).
- **Registro de pago mínimo** contra una OS (tabla `payments`: monto, método, fecha, OS asociada).
- **Log financiero** simple de ingreso/gasto (tabla `financial_entries`, no ligada necesariamente a
  una OS — gastos generales del negocio).

**DoD (cumplido):** migraciones con RLS por `business_id`; subida de fotos a Storage funcionando
desde la UI de detalle de OS; registro de pago visible en el detalle de la OS; tests/build/lint
verdes; `ESTADO.md` actualizado. Oscar aprobó Checkpoints A y B.

---

## Fase 2 — Presupuestos y finanzas *(completada)*
**Objetivo:** formalizar presupuestos y dar visibilidad financiera.
**Entregables:**
- **Presupuestos** (`budgets` + `budget_items`): máquina de estados `draft → sent → approved |
  rejected`, ítems congelados tras enviarse, folio correlativo por negocio, historial inmutable
  (`budget_status_history`).
- **Gastos manuales**: RPC `record_expense()` (`SECURITY DEFINER`) como única vía de escritura de
  `entry_type = 'expense'` en `financial_entries` — sigue sin GRANT de INSERT directo.
- **Reportes vía vistas SQL** (`security_invoker`): ingresos/gastos por día y mes, top clientes,
  equipos más atendidos, cuentas por cobrar (presupuesto aprobado − pagos).
- **UI premium**: módulo de presupuestos integrado en el detalle de la OS (crear, ver ítems,
  cambiar estado) y Dashboard Financiero (`/finance`) con tarjetas de resumen, gráfico de
  ingresos vs. gastos, top clientes, equipos más atendidos, cuentas por cobrar y registro de gasto.

**DoD (cumplido):** vistas SQL versionadas y consultables desde la app; migraciones con RLS por
`business_id`; `npm run build`/`npm test`/`npm run lint` verdes; verificación E2E del backend
(22/22 checks) contra el Supabase real con tenants sintéticos creados con `service_role` y
limpiados al terminar (incluye aislamiento cross-tenant); `ESTADO.md` actualizado.

---

## Fase 3 — Cliente y notificaciones *(completada)*
**Objetivo:** comunicación con el cliente final.
**Entregables:** seguimiento público por token (`/seguimiento/{uuid}`, sin login); notificaciones
automáticas vía **n8n + WhatsApp Cloud API**; email con **Resend**.
**DoD (cumplido):** ruta pública segura desarrollada y probada, webhook a n8n configurado en Supabase;
tests verdes; `ESTADO.md` actualizado.

---

## Fase 4 — Base de conocimiento
**Objetivo:** reducir consultas repetidas.
**Entregables:** FAQ, guías paso a paso con imágenes.
**DoD:** contenido gestionable por tenant; tests verdes; `ESTADO.md` actualizado.

---

## Fase 5 — IA aplicada
**Objetivo:** asistencia inteligente.
**Entregables:** clasificación automática de incidencias, sugerencia de soluciones, generación de
FAQ, chat de ayuda. **API de Claude en Edge Functions** (key server-side, nunca en cliente).
**DoD:** Edge Functions con key server-side; sin exposición de claves; tests verdes; `ESTADO.md` actualizado.

---

## Fase 6 — Inventario y catálogo (ERP)
**Objetivo:** gestión de repuestos y productos.
**Entregables:** repuestos, stock mínimo, alertas, catálogo de productos/componentes.
**DoD:** migraciones con RLS; alertas de stock; tests verdes; `ESTADO.md` actualizado.

---

## Fase 7 — Producto vendible
**Objetivo:** convertir la plataforma en producto SaaS comercializable.
**Entregables:** onboarding de nuevos negocios (tenants), planes, branding por tenant.
Evaluar aquí migración a **monorepo Nx** (ver [`decisiones/0004-monorepo-nx-pendiente.md`](decisiones/0004-monorepo-nx-pendiente.md)).
**DoD:** alta de tenant self-service; aislamiento verificado; tests verdes; `ESTADO.md` actualizado.
