-- Migración base de PCMYM (Fase 0): tablas multi-tenant `negocios` y `perfiles` + RLS.
-- Las tablas de dominio (clientes, ordenes_servicio, ...) llegan en Fase 1.
-- Convención: ver docs/02-MODELO-DATOS.md y skill `supabase-migration`.

-- ============================================================
-- Utilidad: mantener updated_at en cada UPDATE
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- Tabla: negocios (tenants)
-- ============================================================
create table public.negocios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text not null unique,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_negocios_updated_at
  before update on public.negocios
  for each row execute function public.set_updated_at();

-- ============================================================
-- Tabla: perfiles (usuario <-> negocio, 1:1 con auth.users)
-- ============================================================
create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  negocio_id uuid not null references public.negocios(id) on delete restrict,
  nombre text not null default '',
  rol text not null default 'recepcion' check (rol in ('owner', 'tecnico', 'recepcion')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_perfiles_negocio_id on public.perfiles(negocio_id);

create trigger trg_perfiles_updated_at
  before update on public.perfiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- Helpers de tenant (security definer para NO disparar RLS de perfiles
-- de forma recursiva dentro de las propias políticas).
-- ============================================================
create or replace function public.auth_negocio_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select negocio_id from public.perfiles where id = auth.uid();
$$;

create or replace function public.auth_rol()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.perfiles where id = auth.uid();
$$;

-- ============================================================
-- Privilegios: el default nuevo de Supabase NO auto-expone tablas a los
-- roles del Data API. Hay que conceder GRANT explícito (además de RLS).
-- ============================================================
grant select, update on public.negocios to authenticated;
grant select, insert, update, delete on public.perfiles to authenticated;
grant execute on function public.auth_negocio_id() to authenticated;
grant execute on function public.auth_rol() to authenticated;

-- ============================================================
-- RLS
-- ============================================================
alter table public.negocios enable row level security;
alter table public.perfiles enable row level security;

-- negocios: el usuario solo ve y edita su propio negocio.
create policy "negocios_select_own" on public.negocios
  for select to authenticated
  using (id = public.auth_negocio_id());

create policy "negocios_update_own" on public.negocios
  for update to authenticated
  using (id = public.auth_negocio_id())
  with check (id = public.auth_negocio_id());

-- perfiles: el usuario ve los perfiles de su mismo negocio.
create policy "perfiles_select_same_negocio" on public.perfiles
  for select to authenticated
  using (negocio_id = public.auth_negocio_id());

-- perfiles: solo el 'owner' del negocio gestiona perfiles (sin recursión via auth_rol()).
create policy "perfiles_insert_owner" on public.perfiles
  for insert to authenticated
  with check (negocio_id = public.auth_negocio_id() and public.auth_rol() = 'owner');

create policy "perfiles_update_owner" on public.perfiles
  for update to authenticated
  using (negocio_id = public.auth_negocio_id() and public.auth_rol() = 'owner')
  with check (negocio_id = public.auth_negocio_id());

create policy "perfiles_delete_owner" on public.perfiles
  for delete to authenticated
  using (negocio_id = public.auth_negocio_id() and public.auth_rol() = 'owner');

-- Nota: el PRIMER perfil 'owner' de un negocio se crea con service_role (onboarding,
-- Fase 7) o vía seed, ya que RLS exige un owner preexistente para insertar perfiles.
