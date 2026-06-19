@AGENTS.md

# Notas específicas de Claude Code

- `AGENTS.md` es canónico. Si algo de aquí contradice a `AGENTS.md`, gana `AGENTS.md`.
- **Antes de tocar la BD**, lee `docs/02-MODELO-DATOS.md`.
- **Al terminar la sesión**, actualiza `docs/ESTADO.md` siguiendo el formato definido en ese archivo (protocolo de handoff).
- Filesystem es nativo en Claude Code: no añadir MCP de filesystem.
- Para migraciones Supabase con RLS multi-tenant, usa la skill `supabase-migration`.
- Para crear una feature CRUD signal-first, usa la skill `angular-feature`.
- Para commits, usa la skill `commit` (Conventional Commits).
- Angular 22 salió el 2026-06-03 (posterior a varios cortes de conocimiento). Para APIs nuevas
  (Signal Forms, Resource API, selectorless components) verifica con docs en vivo o el CLI real
  antes de asumir patrones viejos.
