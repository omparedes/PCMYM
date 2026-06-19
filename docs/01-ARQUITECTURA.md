# 01 — Arquitectura técnica

## Visión general
SPA Angular 22 (estática, sin SSR) servida por Vercel, hablando directamente con Supabase
(Postgres + Auth + Storage + Realtime) mediante `@supabase/supabase-js`. La lógica sensible y las
integraciones con terceros viven en Edge Functions de Supabase. La seguridad de datos se impone en
la base de datos con **Row Level Security (RLS)**, no en el cliente.

```
[ Navegador ]
   │  Angular 22 SPA (anon key pública)
   ▼
[ Supabase ]  Postgres + RLS · Auth · Storage · Realtime · Edge Functions · pg_cron
   │  (service_role solo server-side)
   ▼
[ Terceros ]  n8n · WhatsApp Cloud API · Resend · API de Claude   (fases posteriores)
```

## Frontend (Angular 22)
- **Signal-first:** estado con signals nativos. Store compartido solo si se justifica → `@ngrx/signals`.
- **Zoneless:** sin zone.js. Cambio de detección dirigido por signals.
- **Standalone + OnPush:** sin NgModules; componentes standalone, `ChangeDetectionStrategy.OnPush`.
- **Signal Forms:** formularios con la API de Signal Forms (no Reactive Forms clásico).
- **Resource API:** lectura de datos remotos con `resource()` / `httpResource()`, no `HttpClient` suelto en componentes.
- **Tests:** Vitest (integrado nativamente en el builder de Angular 22).
- **UI:** PrimeNG (tablas, formularios, overlays) + Tailwind CSS (layout y utilidades). Integración por capas CSS (`tailwind, primeng`).
- **Organización:** por *feature* (`core`, `shared`, `features/*`). Ver `04-CONVENCIONES.md`.

## Backend (Supabase)
- **Postgres** es la fuente de verdad. Todo el esquema vive en migraciones versionadas.
- **Auth:** Supabase Auth (email/password al inicio). El `auth.users.id` se enlaza con `perfiles`.
- **RLS:** activado en toda tabla. Las políticas filtran por el `negocio_id` (tenant) del usuario.
- **Storage:** fotos de equipos (buckets con políticas por tenant). Fase 1.
- **Realtime:** tablero de órdenes en vivo. Fase 1+.
- **Edge Functions:** integraciones server-side (notificaciones, IA). Usan `service_role` / claves privadas. Fases posteriores.
- **pg_cron:** recordatorios programados. Fases posteriores.

## Multi-tenancy
- Estrategia: **fila compartida con `negocio_id`** (shared database, shared schema, tenant column).
- Toda tabla de dominio lleva `negocio_id uuid not null references negocios(id)`.
- El tenant del usuario se resuelve desde su `perfiles.negocio_id` mediante una función
  `auth_negocio_id()` usada por las políticas RLS.
- Modelo de usuario: **1 usuario → 1 negocio** (tabla `perfiles`). La opción N:N
  (`usuarios_negocio`) queda registrada como decisión futura. Ver
  [`decisiones/0001-multitenant.md`](decisiones/0001-multitenant.md).

## Despliegue
- **Vercel:** build estático de Angular (`apps/crm`), sin SSR. Variables `NG_APP_*` inyectadas en build.
- **CI:** GitHub. Lint + test + build en cada PR (se define en fase posterior).
- **Migraciones:** se aplican al proyecto Supabase con `supabase db push` (manual/CI controlado).

## Seguridad (resumen; detalle en 04-CONVENCIONES.md)
- El cliente solo conoce la `anon key`. La autorización real es RLS.
- `service_role` y API keys de terceros: solo en Edge Functions / entorno server. Nunca en el bundle.
- Datos reales de clientes y secretos nunca se commitean.
