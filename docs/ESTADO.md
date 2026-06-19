# ESTADO DEL PROYECTO
Última actualización: 2026-06-19 por Claude Code (Opus 4.8) — estación Oscar/Windows

> Protocolo de handoff: **todo agente actualiza este archivo al cerrar sesión.** Es lo que permite
> cambiar de estación o de agente sin perder el hilo. Mantén el formato de abajo.

## Fase actual
**Fase 0 — Bootstrap. Progreso: 100% (a la espera de aprobación de Oscar para cerrar).**

## Hecho en la última sesión
- Estructura del workspace: `apps/crm`, `supabase/`, `automation/n8n/`, `docs/`, `.claude/skills/`.
- Sistema de contexto cross-agente: `AGENTS.md` (canónico, lean), `CLAUDE.md` (shim), `GEMINI.md`
  (puntero), y base de conocimiento `/docs` (00–04 + ADRs + este ESTADO).
- Convenciones y guardrails (seguridad/secretos, RLS-first, multi-tenant, commits, migraciones).
- `.gitignore` con higiene de secretos y `.env.example` (sin valores reales).
- Scaffolding Angular 22 (`ng new`, zoneless, Vitest por defecto) + Tailwind v4 + PrimeNG 21
  (preset Aura, integración por capas CSS) + cliente Supabase + estructura por feature
  (`core/`, `shared/`, `features/{auth,clientes,ordenes,finanzas}`) + **login placeholder** con
  Signal Forms + Supabase Auth.
- Supabase: `supabase init` (config.toml, seed path ajustado) + **primera migración**
  (`20260619120000_init_tenant_base.sql`): tablas `negocios` y `perfiles`, helpers
  `auth_negocio_id()` / `auth_rol()` (security definer), GRANTs y **RLS multi-tenant** por
  `negocio_id`. Seed sintético con negocio demo.
- Skills del proyecto: `commit`, `supabase-migration`, `angular-feature`.
- ADRs: 0001 multi-tenant, 0002 stack, 0003 OS entidad central, 0004 Nx (diferida),
  0005 PrimeNG+Angular22 legacy-peer-deps.
- **Verificado:** `npm run build` ✓, `npm test` (Vitest, 2 passed) ✓, `npm run lint` ✓.

## En progreso / a medio hacer
- Nada a medias. El bootstrap está completo y verificado. Pendiente solo la aprobación de Oscar.

## Siguiente paso concreto
- **Esperar aprobación de Oscar para cerrar Fase 0 y comenzar Fase 1.**
- Primer paso de Fase 1 (cuando se apruebe): definir el detalle de columnas de `clientes` y crear su
  migración con RLS (skill `supabase-migration`), luego la feature `clientes` (skill
  `angular-feature`). Antes de tocar la BD, leer `docs/02-MODELO-DATOS.md`.

## Decisiones tomadas (resumen, detalle en docs/decisiones/)
- Multi-tenant desde el día uno; modelo **1 usuario → 1 negocio** (`perfiles`), N:N diferido. [0001]
- Stack Angular 22 + Supabase + Vercel; npm como package manager. [0002]
- La Orden de Servicio es la entidad central (fases del ciclo de vida, no módulos). [0003]
- Sin Nx por ahora (reevaluar en Fase 7). [0004]
- PrimeNG 21 sobre Angular 22 con `legacy-peer-deps` + cdk 22, temporal. [0005]
- MCP: solo documentados (Supabase/GitHub/Context7), pendientes de credenciales de Oscar.

## Bloqueos / dudas para Oscar
1. **Idioma de identificadores de BD.** Regla general "código en inglés", pero las tablas base se
   crearon en español siguiendo tus nombres literales (`negocios`, `perfiles`, `negocio_id`). Hay
   que confirmar UNA convención y registrarla en ADR antes de crear las tablas de dominio de Fase 1
   (cambiar después = migración de rename). Ver `docs/02-MODELO-DATOS.md` → "Dudas abiertas".
2. **Credenciales para MCP.** Cuando quieras, provee tokens para activar Supabase MCP (alto valor),
   GitHub MCP y Context7 (docs en vivo de Angular 22). Comandos en `docs/04-CONVENCIONES.md`.
3. **Inyección de env en Vercel.** Hoy las claves públicas de Supabase viven en
   `src/environments/*`. Para producción habría que decidir si se commitea la anon key (es pública)
   o se inyecta en build desde Vercel. Pulir en Fase 1.
4. **Migración base no aplicada a un Postgres real todavía** (requiere Docker para
   `supabase db reset` o un proyecto remoto). El SQL está escrito y revisado; falta ejecutarlo.
