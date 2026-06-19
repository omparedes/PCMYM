# 04 — Convenciones, MCP y skills

Resumen duro en `AGENTS.md`. Aquí va el detalle.

## Idioma
- **Documentación, comentarios de docs y `ESTADO.md`:** español.
- **Código, identificadores, commits, mensajes de PR:** inglés.
- **Esquema de base de datos (tablas, columnas, funciones, triggers, RLS, enums):** **inglés**,
  sin excepción. Decisión registrada en [`decisiones/0006-idioma-esquema.md`](decisiones/0006-idioma-esquema.md).
  Los valores de enum son claves en inglés (`pending`, `repairing`...); su traducción a español
  vive **solo en la capa de presentación de Angular**, nunca en la BD.

## Git
- **Conventional Commits:** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `perf:`,
  `build:`, `ci:`. Opcional scope: `feat(ordenes): ...`. Ver skill `commit`.
- **Ramas:** `main` estable. Trabajo en `feat/<nombre>` (o `fix/`, `chore/`). PR hacia `main`.
- **Nunca** commitear secretos ni datos reales (ver Seguridad).

## Higiene de secretos (NO NEGOCIABLE)
- `.env*` nunca se commitea (excepto `.env.example`). Cubierto por `.gitignore`.
- Dumps/backups (`*.sql.gz`, `*.dump`, `*.bak`) y datos reales de seed
  (`supabase/seed/*-real.*`) están gitignored.
- `service_role`, `SUPABASE_DB_PASSWORD`, `ANTHROPIC_API_KEY` y tokens: **solo server-side**.
  Nunca con prefijo `NG_APP_` ni en el bundle del cliente.
- El cliente Angular solo usa `NG_APP_SUPABASE_URL` y `NG_APP_SUPABASE_ANON_KEY` (públicas).
- Verifica `.gitignore` activo **antes** de cada `git add`. Una filtración de datos de clientes es
  fatal para un producto vendible.

## Base de datos
- **RLS-first:** toda tabla nace con `enable row level security` y políticas por `business_id` en la
  misma migración que la crea. Ninguna tabla queda con RLS abierto.
- **Multi-tenant:** toda tabla de dominio lleva `business_id uuid not null references businesses(id)`.
- **GRANT explícito:** Supabase no auto-expone tablas nuevas al Data API; cada tabla necesita
  `grant select/insert/update/delete ... to authenticated` además de sus políticas RLS.
- **Migraciones versionadas:** todo cambio de esquema en `supabase/migrations/`. Prohibido editar
  el esquema en el dashboard sin migración. Ver skill `supabase-migration`.
- Cada tabla: `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at timestamptz`.
- Esquema en inglés (tablas/columnas/funciones/enums). Ver "Idioma" arriba y ADR 0006.

## Angular
- **Signal-first:** signals para estado; `@ngrx/signals` solo si se justifica. **NgRx clásico
  prohibido** sin ADR.
- **Signal Forms** (no Reactive Forms clásico sin ADR).
- **Standalone + OnPush** por defecto. **Zoneless** (sin zone.js).
- **Resource API** (`resource`/`httpResource`) para lectura de datos remotos; el acceso a Supabase
  se encapsula en servicios por feature.
- **Convención de nombres de archivos (Angular 20+):** sin sufijo de tipo en clases/archivos
  (`app.ts`, no `app.component.ts`). Seguir lo que genera el CLI.

### Estructura por feature (`apps/crm/src/app/`)
- `core/` — singletons transversales: cliente Supabase, auth, guards, interceptores, modelos base.
- `shared/` — componentes/pipes/utilidades reutilizables sin estado de dominio.
- `features/<dominio>/` — una carpeta por dominio (`clientes`, `ordenes`, `finanzas`), cada una con
  sus componentes standalone, su servicio de datos (Supabase) y su signal store si aplica.
- Patrón para crear una feature CRUD: ver skill `angular-feature`.

## Definition of Done (por fase)
Una fase no se cierra sin: tests verdes (`npm test`), migraciones aplicadas y `ESTADO.md`
actualizado. Detalle por fase en `03-ROADMAP-FASES.md`.

---

## MCP (Model Context Protocol)
Estado verificado en Fase 1: **Google Drive, Supabase y Context7 conectados.**

| MCP | Para qué | Estado | Notas |
|-----|----------|--------|-------|
| **Supabase MCP** | Inspeccionar esquema, consultar BD sin copy/paste | ✅ Conectado (`--read-only`, scoped a `project-ref=lhbgseamumyvtatmjnjx`) | Token vía `-e SUPABASE_ACCESS_TOKEN=...`. Modo read-only por seguridad; quitar el flag si se necesita que aplique migraciones directamente (no recomendado, usar `supabase db push` desde CLI). |
| **Context7** | Docs en vivo de Angular 22 / PrimeNG / Supabase (APIs post-corte) | ✅ Conectado (tier gratis, sin API key) | Sin key hay rate-limit más bajo. Añadir API key después si se vuelve cuello de botella. |
| **GitHub MCP** | Issues, PRs, estado del repo | No configurado | Requiere PAT de GitHub (`repo`). |
| Vercel MCP | Deploys, logs | No configurado | Fase posterior. |
| n8n MCP | Flujos de automatización | No configurado | Fase posterior. |

Filesystem es nativo en Claude Code → **no** añadir MCP de filesystem.

### Comandos usados (Supabase y Context7, ya conectados)
```bash
# Supabase MCP (read-only, scoped a este proyecto)
claude mcp add supabase -e SUPABASE_ACCESS_TOKEN=<token> -- npx -y @supabase/mcp-server-supabase@latest --read-only --project-ref=lhbgseamumyvtatmjnjx

# Context7 (docs en vivo; funciona sin key con rate-limit más bajo)
claude mcp add context7 -- npx -y @upstash/context7-mcp@latest
```

### Pendiente (cuando haya credenciales)
```bash
# GitHub MCP
claude mcp add github -- npx -y @modelcontextprotocol/server-github
#   requiere GITHUB_PERSONAL_ACCESS_TOKEN en el entorno
```
> Verifica el nombre exacto del paquete/flags al instalar; estos comandos pueden cambiar de versión.

---

## Skills del proyecto (`.claude/skills/`)
- **`supabase-migration`** — escribir migraciones con RLS multi-tenant por `negocio_id`.
- **`angular-feature`** — patrón signal-first para una feature CRUD (componente standalone +
  servicio Supabase + Signal Form + signal store).
- **`commit`** — formato Conventional Commits del proyecto.

Estas skills viven en `.claude/skills/<nombre>/SKILL.md` y se invocan con `/<nombre>` en Claude Code.
