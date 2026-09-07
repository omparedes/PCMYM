-- Service order delivery record and atomic close-out flow.
-- Schema in English (ADR 0006). UI labels remain in Spanish.

create table public.service_order_deliveries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  receiver_name text not null check (length(trim(receiver_name)) > 0),
  receiver_document text,
  work_summary text,
  delivery_notes text,
  warranty_days int not null default 0 check (warranty_days >= 0),
  warranty_terms text,
  delivered_at timestamptz not null default now(),
  warranty_until date,
  delivered_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (service_order_id)
);

create index idx_service_order_deliveries_business_id
  on public.service_order_deliveries(business_id);
create index idx_service_order_deliveries_service_order_id
  on public.service_order_deliveries(service_order_id);

create or replace function public.validate_service_order_delivery()
returns trigger
language plpgsql
as $$
declare
  v_order_business_id uuid;
begin
  select business_id into v_order_business_id
    from public.service_orders
   where id = new.service_order_id;

  if v_order_business_id is null or v_order_business_id <> new.business_id then
    raise exception 'service_order_id does not belong to this business';
  end if;

  if new.receiver_name is null or length(trim(new.receiver_name)) = 0 then
    raise exception 'Receiver name is required';
  end if;

  return new;
end;
$$;

create trigger trg_service_order_deliveries_validate
  before insert on public.service_order_deliveries
  for each row execute function public.validate_service_order_delivery();

-- A delivered order must have an auditable delivery record. The delivery RPC
-- inserts that record before changing the order status, so this check remains
-- atomic while blocking direct status updates that would bypass the receipt.
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

    if new.status = 'delivered' and not exists (
      select 1 from public.service_order_deliveries d
       where d.service_order_id = new.id
         and d.business_id = new.business_id
    ) then
      raise exception 'Use deliver_service_order to close an order and record its delivery';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.deliver_service_order(
  p_service_order_id uuid,
  p_receiver_name text,
  p_receiver_document text default null,
  p_work_summary text default null,
  p_delivery_notes text default null,
  p_warranty_days int default 0,
  p_warranty_terms text default null
)
returns public.service_order_deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid := public.auth_business_id();
  v_order public.service_orders;
  v_delivery public.service_order_deliveries;
  v_delivered_at timestamptz := now();
begin
  if v_business_id is null then
    raise exception 'No business associated with the current user';
  end if;

  if p_receiver_name is null or length(trim(p_receiver_name)) = 0 then
    raise exception 'Receiver name is required';
  end if;
  if p_warranty_days is null or p_warranty_days < 0 then
    raise exception 'Warranty days cannot be negative';
  end if;

  select * into v_order
    from public.service_orders
   where id = p_service_order_id
     and business_id = v_business_id
   for update;

  if v_order.id is null then
    raise exception 'Service order not found or not accessible';
  end if;
  if v_order.status <> 'ready' then
    raise exception 'Only orders ready for delivery can be closed';
  end if;
  if exists (select 1 from public.service_order_deliveries where service_order_id = v_order.id) then
    raise exception 'This service order already has a delivery record';
  end if;

  insert into public.service_order_deliveries (
    business_id,
    service_order_id,
    receiver_name,
    receiver_document,
    work_summary,
    delivery_notes,
    warranty_days,
    warranty_terms,
    delivered_at,
    warranty_until,
    delivered_by
  )
  values (
    v_business_id,
    v_order.id,
    trim(p_receiver_name),
    nullif(trim(p_receiver_document), ''),
    nullif(trim(p_work_summary), ''),
    nullif(trim(p_delivery_notes), ''),
    p_warranty_days,
    nullif(trim(p_warranty_terms), ''),
    v_delivered_at,
    case when p_warranty_days > 0
      then (v_delivered_at::date + p_warranty_days)
      else null
    end,
    auth.uid()
  )
  returning * into v_delivery;

  update public.service_orders
     set status = 'delivered'
   where id = v_order.id
     and business_id = v_business_id;

  return v_delivery;
end;
$$;

grant execute on function public.deliver_service_order(uuid, text, text, text, text, int, text) to authenticated;
grant select on public.service_order_deliveries to authenticated;

alter table public.service_order_deliveries enable row level security;

create policy "service_order_deliveries_select" on public.service_order_deliveries
  for select to authenticated
  using (business_id = public.auth_business_id());

