---
name: supabase-migration
description: Escribe migraciones de Supabase/Postgres para PCMYM con RLS multi-tenant por negocio_id. Úsalo siempre que crees o modifiques una tabla o política en supabase/migrations/.
---

# Skill: supabase-migration (RLS multi-tenant PCMYM)

Toda migración va en `supabase/migrations/<timestamp>_<nombre_en_ingles>.sql` (genera el archivo con
`npx supabase migration new <nombre>`). **Nunca** cambies el esquema en el dashboard sin migración.

## Reglas duras (ver AGENTS.md)
1. **Toda tabla de dominio** lleva:
   - `id uuid primary key default gen_random_uuid()`
   - `negocio_id uuid not null references public.negocios(id)`
   - `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`
2. **RLS-first**: en la MISMA migración que crea la tabla → `enable row level security` + políticas
   por `negocio_id = public.auth_negocio_id()`. Ninguna tabla queda sin políticas.
3. El trigger `set_updated_at` se aplica a cada tabla con `updated_at`.
4. Evita **recursión de RLS**: si una política necesita leer otra fila de la misma tabla (rol, etc.),
   hazlo vía función `security definer` (`auth_negocio_id()`, `auth_rol()`), nunca con un subquery
   directo a la propia tabla dentro de su política.

## Plantilla para una nueva tabla de dominio
```sql
create table public.<tabla> (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  -- ... columnas del dominio ...
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_<tabla>_negocio_id on public.<tabla>(negocio_id);

create trigger trg_<tabla>_updated_at
  before update on public.<tabla>
  for each row execute function public.set_updated_at();

-- Privilegios: el default de Supabase NO auto-expone tablas al Data API.
-- GRANT explícito ADEMÁS de RLS (sin grant, authenticated no puede ni leer).
grant select, insert, update, delete on public.<tabla> to authenticated;

alter table public.<tabla> enable row level security;

-- Lectura: solo filas del negocio del usuario.
create policy "<tabla>_select" on public.<tabla>
  for select to authenticated
  using (negocio_id = public.auth_negocio_id());

-- Escritura: solo dentro del propio negocio.
create policy "<tabla>_insert" on public.<tabla>
  for insert to authenticated
  with check (negocio_id = public.auth_negocio_id());

create policy "<tabla>_update" on public.<tabla>
  for update to authenticated
  using (negocio_id = public.auth_negocio_id())
  with check (negocio_id = public.auth_negocio_id());

create policy "<tabla>_delete" on public.<tabla>
  for delete to authenticated
  using (negocio_id = public.auth_negocio_id());
```

## Verificación
- `npx supabase db reset` (local) aplica migraciones + seed desde cero. Debe correr sin error.
- Comprueba que la tabla NO sea accesible sin el `negocio_id` correcto (prueba con dos tenants).
- Helpers ya disponibles (migración base): `public.auth_negocio_id()`, `public.auth_rol()`,
  `public.set_updated_at()`.
