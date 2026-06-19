# 03 — Roadmap por fases

Cada fase tiene **objetivo**, **entregables** y **Definition of Done (DoD)**.
Regla global de DoD: una fase **no se cierra** sin (1) tests verdes, (2) migraciones aplicadas y
(3) `ESTADO.md` actualizado.

---

## Fase 0 — Bootstrap *(sesión actual)*
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

## Fase 1 — Núcleo operativo (MVP real)
**Objetivo:** resolver el 80% del dolor y permitir registrar información desde el día uno.
**Entregables:**
- Módulo **Clientes** (CRUD).
- **Orden de Servicio (OS)** con máquina de estados:
  `pendiente → en_diagnostico → en_reparacion → esperando_repuesto → listo → entregado`.
- **Historial de transiciones** de la OS (`os_historial`).
- **Fotos del equipo** en Supabase Storage, ligadas a la OS.
- **Registro de pago mínimo** contra la OS.
- **Log financiero** simple (ingreso/gasto).

**DoD:** migraciones de dominio con RLS por `negocio_id`; CRUD de clientes y OS funcionando con
Signal Forms + Resource API; cambios de estado registrados en historial; subida de fotos a Storage;
tests verdes; `ESTADO.md` actualizado.

---

## Fase 2 — Presupuestos y finanzas
**Objetivo:** formalizar presupuestos y dar visibilidad financiera.
**Entregables:** presupuestos (aprobado/rechazado/historial); reportes vía **vistas SQL** en
Postgres (por día/mes/año, top clientes, servicios más solicitados); cuentas por cobrar.
**DoD:** vistas SQL versionadas; reportes consultables desde la app; tests verdes; `ESTADO.md` actualizado.

---

## Fase 3 — Cliente y notificaciones
**Objetivo:** comunicación con el cliente final.
**Entregables:** seguimiento público por token (`/seguimiento/{uuid}`, sin login); notificaciones
automáticas vía **n8n + WhatsApp Cloud API**; email con **Resend**.
**DoD:** ruta pública segura (token, sin fuga de datos de otros negocios); flujos n8n documentados;
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
