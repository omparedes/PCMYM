-- Phase 1.5 Stage 2: payments against a service_order + a basic financial log.
-- Schema in English (ADR 0006). Spanish UI labels live only in Angular.

-- ============================================================
-- Table: payments
-- ============================================================
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash', 'transfer', 'card')),
  created_at timestamptz not null default now(),
  recorded_by uuid references public.profiles(id) on delete set null
);

create index idx_payments_business_id on public.payments(business_id);
create index idx_payments_service_order_id on public.payments(service_order_id, created_at);

-- ============================================================
-- Tenant-consistency validation, same pattern as
-- validate_service_order_photo(): service_order_id must belong to the same
-- business_id as the payment row.
-- ============================================================
create or replace function public.validate_payment()
returns trigger
language plpgsql
as $$
declare
  v_order_business_id uuid;
begin
  select business_id into v_order_business_id
    from public.service_orders where id = new.service_order_id;
  if v_order_business_id is null or v_order_business_id <> new.business_id then
    raise exception 'service_order_id does not belong to this business';
  end if;
  return new;
end;
$$;

create trigger trg_payments_validate
  before insert on public.payments
  for each row execute function public.validate_payment();

-- ============================================================
-- Table: financial_entries (the cash log — immutable from the client's POV)
-- ============================================================
create table public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  entry_type text not null check (entry_type in ('income', 'expense')),
  amount numeric(10,2) not null check (amount > 0),
  description text not null,
  created_at timestamptz not null default now()
);

create index idx_financial_entries_business_id on public.financial_entries(business_id, created_at);

-- ============================================================
-- Immutable bridge (AFTER, security definer — same pattern as
-- log_service_order_status_history): every payment automatically books an
-- income entry, so the cash log can never drift from recorded payments.
-- `authenticated` has NO insert grant on financial_entries at all; only this
-- trigger can ever write to it.
-- ============================================================
create or replace function public.log_payment_to_financial_entries()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_folio int;
begin
  select folio into v_folio from public.service_orders where id = new.service_order_id;

  insert into public.financial_entries (business_id, entry_type, amount, description)
  values (
    new.business_id,
    'income',
    new.amount,
    'Pago de Orden #' || coalesce(v_folio::text, new.service_order_id::text)
  );

  return new;
end;
$$;

create trigger trg_payments_log_financial_entry
  after insert on public.payments
  for each row execute function public.log_payment_to_financial_entries();

-- ============================================================
-- Grants: Supabase's default does NOT auto-expose tables to the Data API.
-- payments: select+insert only (a recorded payment is never edited/removed —
-- same immutability principle as order_status_history).
-- financial_entries: select ONLY — no INSERT/UPDATE/DELETE grant for
-- `authenticated`, so the cash log can only ever grow through the
-- SECURITY DEFINER trigger above and can never desync or be tampered with.
-- ============================================================
grant select, insert on public.payments to authenticated;
grant select on public.financial_entries to authenticated;

-- ============================================================
-- RLS
-- ============================================================
alter table public.payments enable row level security;
alter table public.financial_entries enable row level security;

create policy "payments_select" on public.payments
  for select to authenticated
  using (business_id = public.auth_business_id());

create policy "payments_insert" on public.payments
  for insert to authenticated
  with check (business_id = public.auth_business_id());

create policy "financial_entries_select" on public.financial_entries
  for select to authenticated
  using (business_id = public.auth_business_id());
