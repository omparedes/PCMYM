-- Phase 2 Stage 1: budgets (quotes) against a service_order, with line items,
-- an immutable status-change history, and a manual-expense RPC.
-- Schema in English (ADR 0006). Spanish UI labels live only in Angular.

-- ============================================================
-- Status transition map for budgets, same approach as
-- is_valid_service_order_transition(): draft -> sent -> approved|rejected.
-- approved/rejected are terminal; a rejected/approved budget is superseded by
-- creating a new one, never reopened (keeps the quote history honest).
-- ============================================================
create or replace function public.is_valid_budget_transition(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select case p_from
    when 'draft' then p_to in ('sent', 'rejected')
    when 'sent' then p_to in ('approved', 'rejected')
    else false
  end;
$$;

-- ============================================================
-- Table: budgets (header)
-- ============================================================
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  folio int,
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'sent', 'approved', 'rejected')),
  total_amount numeric(10,2) not null default 0 check (total_amount >= 0),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, folio)
);

create index idx_budgets_business_id on public.budgets(business_id);
create index idx_budgets_service_order_id on public.budgets(service_order_id, created_at);

create trigger trg_budgets_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

-- ============================================================
-- Table: budget_items (lines — parts/labor). Editable only while the parent
-- budget is still a 'draft'; once sent, the quote is frozen so what the
-- customer saw can never silently change underneath an approval/rejection.
-- ============================================================
create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  budget_id uuid not null references public.budgets(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);

create index idx_budget_items_business_id on public.budget_items(business_id);
create index idx_budget_items_budget_id on public.budget_items(budget_id);

-- ============================================================
-- Folio counter (internal — not exposed to the Data API), same pattern as
-- service_order_folio_counters.
-- ============================================================
create table public.budget_folio_counters (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  last_folio int not null default 0
);

create or replace function public.assign_budget_folio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.folio is null then
    insert into public.budget_folio_counters (business_id, last_folio)
    values (new.business_id, 1)
    on conflict (business_id)
      do update set last_folio = public.budget_folio_counters.last_folio + 1
    returning last_folio into new.folio;
  end if;
  return new;
end;
$$;

create trigger trg_budgets_assign_folio
  before insert on public.budgets
  for each row execute function public.assign_budget_folio();

-- ============================================================
-- Tenant-consistency + state-machine validation on budgets (BEFORE, invoker —
-- same pattern as validate_service_order: the underlying select is already
-- permitted by service_orders' own RLS for the caller's own business).
-- ============================================================
create or replace function public.validate_budget()
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

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if not public.is_valid_budget_transition(old.status, new.status) then
      raise exception 'Invalid budget status transition: % -> %', old.status, new.status;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_budgets_validate
  before insert or update on public.budgets
  for each row execute function public.validate_budget();

-- ============================================================
-- Tenant-consistency + frozen-quote validation on budget_items: the item's
-- business_id must match its budget, and items can only be inserted/edited/
-- removed while the parent budget is still 'draft'.
-- ============================================================
create or replace function public.validate_budget_item()
returns trigger
language plpgsql
as $$
declare
  v_budget public.budgets;
begin
  select * into v_budget from public.budgets where id = new.budget_id;
  if v_budget.id is null or v_budget.business_id <> new.business_id then
    raise exception 'budget_id does not belong to this business';
  end if;
  if v_budget.status <> 'draft' then
    raise exception 'Cannot modify items of a budget that is not in draft status';
  end if;
  return new;
end;
$$;

create or replace function public.validate_budget_item_delete()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status from public.budgets where id = old.budget_id;
  if v_status is distinct from 'draft' then
    raise exception 'Cannot modify items of a budget that is not in draft status';
  end if;
  return old;
end;
$$;

create trigger trg_budget_items_validate
  before insert or update on public.budget_items
  for each row execute function public.validate_budget_item();

create trigger trg_budget_items_validate_delete
  before delete on public.budget_items
  for each row execute function public.validate_budget_item_delete();

-- ============================================================
-- Keep budgets.total_amount in sync with the sum of its items (denormalized
-- for fast list/report queries). SECURITY DEFINER + AFTER so it always runs
-- regardless of which RLS-restricted role touched budget_items.
-- ============================================================
create or replace function public.recalculate_budget_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_budget_id uuid := coalesce(new.budget_id, old.budget_id);
begin
  update public.budgets
    set total_amount = (
      select coalesce(sum(quantity * unit_price), 0)
      from public.budget_items
      where budget_id = v_budget_id
    )
    where id = v_budget_id;
  return null;
end;
$$;

create trigger trg_budget_items_recalculate_total
  after insert or update or delete on public.budget_items
  for each row execute function public.recalculate_budget_total();

-- ============================================================
-- Table: budget_status_history (immutable audit trail, same pattern as
-- order_status_history — `authenticated` has NO grant on it at all).
-- ============================================================
create table public.budget_status_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  budget_id uuid not null references public.budgets(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index idx_budget_status_history_business_id on public.budget_status_history(business_id);
create index idx_budget_status_history_budget_id on public.budget_status_history(budget_id, changed_at);

create or replace function public.log_budget_status_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.budget_status_history (business_id, budget_id, from_status, to_status, changed_by)
    values (new.business_id, new.id, null, new.status, auth.uid());
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.budget_status_history (business_id, budget_id, from_status, to_status, changed_by)
    values (new.business_id, new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger trg_budgets_log_history
  after insert or update on public.budgets
  for each row execute function public.log_budget_status_history();

-- ============================================================
-- RPC: change budget status (SECURITY DEFINER, same shape as
-- change_service_order_status) — replicates the tenant check RLS would have
-- done before mutating; the validation/history triggers above still fire.
-- ============================================================
create or replace function public.change_budget_status(
  p_budget_id uuid,
  p_new_status text
)
returns public.budgets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_budget public.budgets;
begin
  update public.budgets
    set status = p_new_status
    where id = p_budget_id
      and business_id = public.auth_business_id()
    returning * into v_budget;

  if v_budget.id is null then
    raise exception 'Budget not found or not accessible';
  end if;

  return v_budget;
end;
$$;

grant execute on function public.change_budget_status(uuid, text) to authenticated;

-- ============================================================
-- RPC: record_expense — the only way to write an `expense` row into
-- financial_entries. financial_entries keeps NO insert grant for
-- `authenticated` at all (see payments/financial_entries migration), so a
-- manual expense can only ever be booked through this SECURITY DEFINER
-- function, which stamps business_id from auth_business_id() itself (never
-- trusts a client-supplied business_id).
-- ============================================================
create or replace function public.record_expense(
  p_amount numeric,
  p_description text
)
returns public.financial_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid := public.auth_business_id();
  v_entry public.financial_entries;
begin
  if v_business_id is null then
    raise exception 'No business associated with the current user';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Expense amount must be greater than 0';
  end if;
  if p_description is null or length(trim(p_description)) = 0 then
    raise exception 'Expense description is required';
  end if;

  insert into public.financial_entries (business_id, entry_type, amount, description)
  values (v_business_id, 'expense', p_amount, trim(p_description))
  returning * into v_entry;

  return v_entry;
end;
$$;

grant execute on function public.record_expense(numeric, text) to authenticated;

-- ============================================================
-- Grants: Supabase's default does NOT auto-expose tables to the Data API.
-- No DELETE on budgets (reject via status, not deletion).
-- budget_items: select/insert/update/delete are all client-reachable, but
-- only while the parent budget is 'draft' (enforced by the triggers above).
-- budget_status_history / budget_folio_counters: no write grants — see
-- trigger/comment above for each.
-- ============================================================
grant select, insert, update on public.budgets to authenticated;
grant select, insert, update, delete on public.budget_items to authenticated;
grant select on public.budget_status_history to authenticated;

-- ============================================================
-- RLS
-- ============================================================
alter table public.budgets enable row level security;
alter table public.budget_items enable row level security;
alter table public.budget_status_history enable row level security;
alter table public.budget_folio_counters enable row level security;
-- (no policies on budget_folio_counters: RLS enabled with zero policies means
-- it is totally inaccessible via the Data API, even with a future grant.)

create policy "budgets_select" on public.budgets
  for select to authenticated
  using (business_id = public.auth_business_id());

create policy "budgets_insert" on public.budgets
  for insert to authenticated
  with check (business_id = public.auth_business_id());

create policy "budgets_update" on public.budgets
  for update to authenticated
  using (business_id = public.auth_business_id())
  with check (business_id = public.auth_business_id());

create policy "budget_items_select" on public.budget_items
  for select to authenticated
  using (business_id = public.auth_business_id());

create policy "budget_items_insert" on public.budget_items
  for insert to authenticated
  with check (business_id = public.auth_business_id());

create policy "budget_items_update" on public.budget_items
  for update to authenticated
  using (business_id = public.auth_business_id())
  with check (business_id = public.auth_business_id());

create policy "budget_items_delete" on public.budget_items
  for delete to authenticated
  using (business_id = public.auth_business_id());

create policy "budget_status_history_select" on public.budget_status_history
  for select to authenticated
  using (business_id = public.auth_business_id());
