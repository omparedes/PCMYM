-- Phase 1: customers table (multi-tenant, RLS by business_id).
-- Soft delete only: there is no DELETE grant/policy on this table by design —
-- "archiving" sets archived_at via UPDATE. Physical deletion is intentionally
-- unavailable through the Data API to enforce the no-hard-delete rule at the DB level.

create extension if not exists pg_trgm;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  document_type text,
  document_number text,
  phone text,
  email text,
  address text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_customers_business_id on public.customers(business_id);
create index idx_customers_name_trgm on public.customers using gin (name gin_trgm_ops);
create index idx_customers_phone_trgm on public.customers using gin (phone gin_trgm_ops);
create index idx_customers_document_number_trgm on public.customers using gin (document_number gin_trgm_ops);

create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- Grants: Supabase's default does NOT auto-expose tables to the Data API.
-- No DELETE grant on purpose (soft delete only, see header comment).
grant select, insert, update on public.customers to authenticated;

alter table public.customers enable row level security;

-- Read: only customers from the user's business (archived included; the app
-- decides whether to show them, archived_at is not a security boundary).
create policy "customers_select" on public.customers
  for select to authenticated
  using (business_id = public.auth_business_id());

create policy "customers_insert" on public.customers
  for insert to authenticated
  with check (business_id = public.auth_business_id());

create policy "customers_update" on public.customers
  for update to authenticated
  using (business_id = public.auth_business_id())
  with check (business_id = public.auth_business_id());
