-- PCMYM base migration (Phase 0): multi-tenant tables `businesses` and `profiles` + RLS.
-- Domain tables (customers, service_orders, ...) come in Phase 1.
-- Schema language: English (see docs/decisiones/0006-idioma-esquema.md).
-- Convention: see docs/02-MODELO-DATOS.md and skill `supabase-migration`.

-- ============================================================
-- Utility: keep updated_at current on every UPDATE
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
-- Table: businesses (tenants)
-- ============================================================
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_businesses_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

-- ============================================================
-- Table: profiles (user <-> business, 1:1 with auth.users)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete restrict,
  name text not null default '',
  role text not null default 'reception' check (role in ('owner', 'technician', 'reception')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_business_id on public.profiles(business_id);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- Tenant helpers (security definer so policies do NOT recursively
-- trigger RLS on `profiles` from within their own policies).
-- ============================================================
create or replace function public.auth_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_id from public.profiles where id = auth.uid();
$$;

create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ============================================================
-- Grants: Supabase's new default does NOT auto-expose tables to the
-- Data API roles. Explicit GRANT is required in addition to RLS.
-- ============================================================
grant select, update on public.businesses to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant execute on function public.auth_business_id() to authenticated;
grant execute on function public.auth_role() to authenticated;

-- ============================================================
-- RLS
-- ============================================================
alter table public.businesses enable row level security;
alter table public.profiles enable row level security;

-- businesses: a user only sees and edits their own business.
create policy "businesses_select_own" on public.businesses
  for select to authenticated
  using (id = public.auth_business_id());

create policy "businesses_update_own" on public.businesses
  for update to authenticated
  using (id = public.auth_business_id())
  with check (id = public.auth_business_id());

-- profiles: a user sees profiles within their own business.
create policy "profiles_select_same_business" on public.profiles
  for select to authenticated
  using (business_id = public.auth_business_id());

-- profiles: only the business 'owner' manages profiles (no recursion via auth_role()).
create policy "profiles_insert_owner" on public.profiles
  for insert to authenticated
  with check (business_id = public.auth_business_id() and public.auth_role() = 'owner');

create policy "profiles_update_owner" on public.profiles
  for update to authenticated
  using (business_id = public.auth_business_id() and public.auth_role() = 'owner')
  with check (business_id = public.auth_business_id());

create policy "profiles_delete_owner" on public.profiles
  for delete to authenticated
  using (business_id = public.auth_business_id() and public.auth_role() = 'owner');

-- Note: the FIRST 'owner' profile of a business is created with service_role (onboarding,
-- Phase 7) or via seed, since RLS requires a pre-existing owner to insert profiles.
