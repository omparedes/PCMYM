# AGENTS.md — PCMYM

> Fuente única de verdad para todos los agentes (Claude Code, Antigravity/Gemini, humanos).
> Mantener LEAN (< 150 líneas). El contexto pesado vive en `/docs` y se lee bajo demanda.
> `CLAUDE.md` y `GEMINI.md` NUNCA contienen reglas que no estén aquí.

## Qué es (3 líneas)
PCMYM es una plataforma SaaS **multi-tenant** de gestión para negocios de venta y servicio
técnico de computadoras. La entidad corazón es la **Orden de Servicio (OS)**: recepción,
diagnóstico, reparación y entrega son fases del ciclo de vida de la MISMA OS, no módulos.
El objetivo es que sea replicable y vendible a otros talleres.

## Stack (versiones fijadas)
- **Frontend:** Angular 22 — signal-first, standalone, **zoneless**, **Signal Forms** (no Reactive Forms), OnPush por defecto, **Resource API** (`resource`/`httpResource`) para datos. Tests con **Vitest**.
- **UI:** Tailwind CSS + PrimeNG.
- **Estado:** signals nativos. Store compartido solo si hace falta → `@ngrx/signals` (signalStore). **NO** NgRx clásico.
- **Backend:** Supabase (Postgres + Auth + Storage + Realtime + Edge Functions + pg_cron).
- **Deploy:** Vercel (SPA estática, sin SSR).
- **Repos/CI:** GitHub. **Automatización:** n8n (fases posteriores). **IA:** API de Claude en Edge Functions (key server-side).
- Runtime local: Node 24, npm 11. Package manager del proyecto: **npm**.

## Comandos exactos
> App Angular vive en `apps/crm/`. Ejecutar comandos `npm` desde ahí.
- Dev:        `cd apps/crm && npm start`              (ng serve, http://localhost:4200)
- Build:      `cd apps/crm && npm run build`
- Test:       `cd apps/crm && npm test`               (Vitest)
- Lint:       `cd apps/crm && npm run lint`
- Migración nueva:  `npx supabase migration new <nombre_en_ingles>`
- Aplicar migr. (local): `npx supabase db reset`      (recrea BD local desde migraciones + seed)
- Push a remoto:    `npx supabase db push`
- Supabase local:   `npx supabase start` / `npx supabase stop`

## Convenciones duras (no negociables)
- **Idioma:** docs y `ESTADO.md` en **español**. Código, tablas, columnas, identificadores y commits en **inglés** (esquema de BD sin excepción — ver ADR 0006; etiquetas de UI en español).
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`...). Ver skill `commit`.
- **Ramas:** `main` estable; trabajo en `feat/<nombre>`.
- **Multi-tenant:** TODA tabla de dominio lleva `business_id uuid not null` con FK a `businesses`.
- **RLS-first:** TODA tabla nace con Row Level Security **activado** y políticas por tenant desde su primera migración. Ninguna tabla queda con RLS abierto.
- **Migraciones:** TODO cambio de esquema pasa por un archivo en `supabase/migrations/`. **Prohibido** cambiar el esquema a mano en el dashboard sin migración.
- **Angular signal-first:** Signal Forms, signals, OnPush, standalone. **Prohibido** NgRx clásico o Reactive Forms sin un ADR que lo justifique.
- **Resource API** para lectura de datos remotos; no `HttpClient` suelto en componentes.

## Límites de seguridad (primer orden — una filtración es fatal en un producto vendible)
- **NUNCA** commitear `.env*` (excepto `.env.example`), dumps/backups de BD (`*.sql.gz`, `*.dump`, `*.bak`), credenciales ni datos reales de clientes.
- Datos reales de seed: `supabase/seed/*-real.*` están gitignored. Solo datos sintéticos se versionan.
- Claves de servicio (Supabase `service_role`, API de Claude, tokens) **solo server-side** (Edge Functions / variables de entorno). NUNCA en el cliente Angular.
- El cliente Angular solo usa la `anon key` pública; la seguridad real la imponen las políticas RLS.

## Protocolo de handoff
- Antes de empezar: lee `docs/ESTADO.md` para saber en qué fase y tarea estamos.
- Al cerrar sesión: **actualiza `docs/ESTADO.md`** (formato definido en ese archivo). Obligatorio para todo agente.

## Definition of Done (por fase)
Una fase no se cierra sin: tests verdes + migraciones aplicadas + `ESTADO.md` actualizado. Detalle por fase en `docs/03-ROADMAP-FASES.md`.

## Mapa de /docs (leer bajo demanda)
- `docs/00-VISION.md` — visión y alcance.
- `docs/01-ARQUITECTURA.md` — arquitectura técnica y decisiones.
- `docs/02-MODELO-DATOS.md` — **leer antes de tocar la BD.**
- `docs/03-ROADMAP-FASES.md` — fases, entregables, Definition of Done.
- `docs/04-CONVENCIONES.md` — convenciones detalladas, MCP y skills.
- `docs/ESTADO.md` — estado actual y handoff.
- `docs/decisiones/` — ADRs (Architecture Decision Records).
