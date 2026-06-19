---
name: supabase-migration
description: Escribe migraciones de Supabase/Postgres para PCMYM con RLS multi-tenant por business_id. Úsalo siempre que crees o modifiques una tabla o política en supabase/migrations/.
---

# Skill: supabase-migration (RLS multi-tenant PCMYM)

Toda migración va en `supabase/migrations/<timestamp>_<nombre_en_ingles>.sql` (genera el archivo con
`npx supabase migration new <nombre>`). **Nunca** cambies el esquema en el dashboard sin migración.

**Esquema en inglés, sin excepción** (tablas, columnas, funciones, enums) — ver
`docs/decisiones/0006-idioma-esquema.md`. Las etiquetas en español van solo en la UI de Angular.

## Reglas duras (ver AGENTS.md)
1. **Toda tabla de dominio** lleva:
   - `id uuid primary key default gen_random_uuid()`
   - `business_id uuid not null references public.businesses(id)`
   - `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`
2. **RLS-first**: en la MISMA migración que crea la tabla → `enable row level security` + políticas
   por `business_id = public.auth_business_id()`. Ninguna tabla queda sin políticas.
3. **GRANT explícito**: Supabase no auto-expone tablas nuevas al Data API. Sin `grant ... to
   authenticated`, ni siquiera RLS permite acceso — hace falta GRANT **y** política.
4. El trigger `set_updated_at` (ya existe, migración base) se aplica a cada tabla con `updated_at`.
5. Evita **recursión de RLS**: si una política necesita leer otra fila de la misma tabla (rol, etc.),
   hazlo vía función `security definer` (`auth_business_id()`, `auth_role()`), nunca con un subquery
   directo a la propia tabla dentro de su política.

## Plantilla para una nueva tabla de dominio
```sql
create table public.<table> (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  -- ... domain columns ...
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_<table>_business_id on public.<table>(business_id);

create trigger trg_<table>_updated_at
  before update on public.<table>
  for each row execute function public.set_updated_at();

-- Grants: Supabase's default does NOT auto-expose tables to the Data API.
-- Explicit GRANT IN ADDITION to RLS (without grant, authenticated can't even read).
grant select, insert, update, delete on public.<table> to authenticated;

alter table public.<table> enable row level security;

-- Read: only rows from the user's business.
create policy "<table>_select" on public.<table>
  for select to authenticated
  using (business_id = public.auth_business_id());

-- Write: only within the user's own business.
create policy "<table>_insert" on public.<table>
  for insert to authenticated
  with check (business_id = public.auth_business_id());

create policy "<table>_update" on public.<table>
  for update to authenticated
  using (business_id = public.auth_business_id())
  with check (business_id = public.auth_business_id());

create policy "<table>_delete" on public.<table>
  for delete to authenticated
  using (business_id = public.auth_business_id());
```

## Verificación
- `npx supabase db reset` (local) aplica migraciones + seed desde cero. Debe correr sin error.
- `npx supabase db push` aplica al proyecto remoto vinculado (`supabase link`).
- Comprueba que la tabla NO sea accesible sin el `business_id` correcto (prueba con dos tenants).
- Helpers ya disponibles (migración base): `public.auth_business_id()`, `public.auth_role()`,
  `public.set_updated_at()`.
