-- Phase 1: service_orders (the central entity) + order_status_history (immutable trail).
-- Schema in English (ADR 0006). Spanish UI labels live only in Angular.

-- ============================================================
-- Status transition map (the OS state machine).
-- `cancelled` is reachable from any non-terminal state; `delivered` and
-- `cancelled` are terminal. Kept as its own function so both the validation
-- trigger and any future tooling/tests can reuse the same source of truth.
-- ============================================================
create or replace function public.is_valid_service_order_transition(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select case p_from
    when 'pending' then p_to in ('diagnosing', 'cancelled')
    when 'diagnosing' then p_to in ('repairing', 'waiting_parts', 'cancelled')
    when 'repairing' then p_to in ('waiting_parts', 'ready', 'cancelled')
    when 'waiting_parts' then p_to in ('repairing', 'ready', 'cancelled')
    when 'ready' then p_to in ('delivered', 'cancelled')
    else false
  end;
$$;

-- ============================================================
-- Table: service_orders
-- ============================================================
create table public.service_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  folio int,
  customer_id uuid not null references public.customers(id) on delete restrict,
  equipment_type text,
  brand text,
  model text,
  serial_number text,
  accessories text,
  reported_issue text,
  initial_diagnosis text,
  status text not null default 'pending' check (
    status in ('pending', 'diagnosing', 'repairing', 'waiting_parts', 'ready', 'delivered', 'cancelled')
  ),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid references public.profiles(id) on delete set null,
  received_at timestamptz not null default now(),
  estimated_delivery date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, folio)
);

create index idx_service_orders_business_id on public.service_orders(business_id);
create index idx_service_orders_status on public.service_orders(business_id, status);
create index idx_service_orders_customer_id on public.service_orders(customer_id);

create trigger trg_service_orders_updated_at
  before update on public.service_orders
  for each row execute function public.set_updated_at();

-- ============================================================
-- Table: order_status_history (immutable audit trail)
-- ============================================================
create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index idx_order_status_history_business_id on public.order_status_history(business_id);
create index idx_order_status_history_service_order_id on public.order_status_history(service_order_id, changed_at);

-- ============================================================
-- Folio counter (internal — not exposed to the Data API at all; see grants).
-- Atomic per-business sequence via upsert + returning (race-safe: the upsert's
-- row lock serializes concurrent inserts for the same business_id).
-- ============================================================
create table public.service_order_folio_counters (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  last_folio int not null default 0
);

create or replace function public.assign_service_order_folio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.folio is null then
    insert into public.service_order_folio_counters (business_id, last_folio)
    values (new.business_id, 1)
    on conflict (business_id)
      do update set last_folio = public.service_order_folio_counters.last_folio + 1
    returning last_folio into new.folio;
  end if;
  return new;
end;
$$;

create trigger trg_service_orders_assign_folio
  before insert on public.service_orders
  for each row execute function public.assign_service_order_folio();

-- ============================================================
-- Tenant-consistency + state-machine validation (BEFORE, runs as invoker —
-- the underlying selects are already permitted by each table's own RLS for
-- the caller's own business, so no elevated privilege is needed here).
-- ============================================================
create or replace function public.validate_service_order()
returns trigger
language plpgsql
as $$
declare
  v_customer_business_id uuid;
  v_assignee_business_id uuid;
begin
  select business_id into v_customer_business_id
    from public.customers where id = new.customer_id;
  if v_customer_business_id is null or v_customer_business_id <> new.business_id then
    raise exception 'customer_id does not belong to this business';
  end if;

  if new.assigned_to is not null then
    select business_id into v_assignee_business_id
      from public.profiles where id = new.assigned_to;
    if v_assignee_business_id is null or v_assignee_business_id <> new.business_id then
      raise exception 'assigned_to does not belong to this business';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if not public.is_valid_service_order_transition(old.status, new.status) then
      raise exception 'Invalid status transition: % -> %', old.status, new.status;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_service_orders_validate
  before insert or update on public.service_orders
  for each row execute function public.validate_service_order();

-- ============================================================
-- Immutable history trail (AFTER, security definer — `authenticated` has NO
-- grant on order_status_history; only this trigger can ever write to it, so
-- history cannot be fabricated or edited by any client, web or otherwise).
-- ============================================================
create or replace function public.log_service_order_status_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (business_id, service_order_id, from_status, to_status, changed_by)
    values (new.business_id, new.id, null, new.status, auth.uid());
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.order_status_history (business_id, service_order_id, from_status, to_status, changed_by)
    values (new.business_id, new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger trg_service_orders_log_history
  after insert or update on public.service_orders
  for each row execute function public.log_service_order_status_history();

-- ============================================================
-- RPC: change status + attach a note to the history row in one call.
-- SECURITY DEFINER, so it must replicate the tenant check RLS would have done
-- (auth_business_id()) before mutating; the validation/history triggers above
-- still fire regardless, since triggers always run on the underlying table.
-- ============================================================
create or replace function public.change_service_order_status(
  p_service_order_id uuid,
  p_new_status text,
  p_note text default null
)
returns public.service_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.service_orders;
begin
  update public.service_orders
    set status = p_new_status
    where id = p_service_order_id
      and business_id = public.auth_business_id()
    returning * into v_order;

  if v_order.id is null then
    raise exception 'Service order not found or not accessible';
  end if;

  if p_note is not null then
    update public.order_status_history
      set note = p_note
      where id = (
        select id from public.order_status_history
        where service_order_id = p_service_order_id
        order by changed_at desc
        limit 1
      );
  end if;

  return v_order;
end;
$$;

grant execute on function public.change_service_order_status(uuid, text, text) to authenticated;

-- ============================================================
-- Grants: Supabase's default does NOT auto-expose tables to the Data API.
-- No DELETE on service_orders (cancel via status, not deletion).
-- order_status_history has NO write grants at all — see trigger comment above.
-- service_order_folio_counters has NO grants — internal only, touched solely
-- by the security-definer folio trigger.
-- ============================================================
grant select, insert, update on public.service_orders to authenticated;
grant select on public.order_status_history to authenticated;

-- ============================================================
-- RLS
-- ============================================================
alter table public.service_orders enable row level security;
alter table public.order_status_history enable row level security;
alter table public.service_order_folio_counters enable row level security;
-- (no policies on service_order_folio_counters: RLS enabled with zero policies
-- means it is totally inaccessible via the Data API, even with a future grant.)

create policy "service_orders_select" on public.service_orders
  for select to authenticated
  using (business_id = public.auth_business_id());

create policy "service_orders_insert" on public.service_orders
  for insert to authenticated
  with check (business_id = public.auth_business_id());

create policy "service_orders_update" on public.service_orders
  for update to authenticated
  using (business_id = public.auth_business_id())
  with check (business_id = public.auth_business_id());

create policy "order_status_history_select" on public.order_status_history
  for select to authenticated
  using (business_id = public.auth_business_id());
