-- ============================================================
-- Migration: Inventory and Service Order Parts V1
-- Schema in English (ADR 0006). Spanish UI labels live only in Angular.
-- Strict multi-tenant with business_id and RLS.
-- Immutable inventory audit trail and atomic transactional operations.
-- ============================================================

-- ============================================================
-- Table: products (Hardware catalog & stock items)
-- ============================================================
create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  category text not null,
  brand text,
  model text,
  sku text,
  barcode text,
  compatibility text,
  location text,
  supplier text,
  cost_price numeric(10,2) not null default 0 check (cost_price >= 0),
  sale_price numeric(10,2) not null default 0 check (sale_price >= 0),
  current_stock int not null default 0 check (current_stock >= 0),
  min_stock int not null default 0 check (min_stock >= 0),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, sku)
);

create index idx_products_business_id on public.products(business_id);
create index idx_products_category on public.products(business_id, category);
create index idx_products_sku on public.products(business_id, sku);
create index idx_products_active on public.products(business_id, active);

create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ============================================================
-- Table: inventory_movements (Immutable audit trail / Kardex)
-- ============================================================
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  movement_type text not null check (movement_type in ('in', 'out', 'adjustment')),
  quantity int not null check (quantity != 0),
  previous_stock int not null check (previous_stock >= 0),
  new_stock int not null check (new_stock >= 0),
  reason text not null check (
    reason in (
      'initial_stock',
      'purchase',
      'sale',
      'service_order',
      'service_return',
      'damaged',
      'internal_use',
      'adjustment',
      'other'
    )
  ),
  reference_doc text,
  service_order_id uuid references public.service_orders(id) on delete set null,
  performed_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_inventory_movements_business on public.inventory_movements(business_id, created_at desc);
create index idx_inventory_movements_product on public.inventory_movements(product_id, created_at desc);
create index idx_inventory_movements_order on public.inventory_movements(service_order_id);

-- ============================================================
-- Table: service_order_parts (Assigned parts to an active OS)
-- ============================================================
create table public.service_order_parts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity int not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  unit_cost numeric(10,2) not null default 0 check (unit_cost >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_order_id, product_id)
);

create index idx_service_order_parts_business on public.service_order_parts(business_id);
create index idx_service_order_parts_order on public.service_order_parts(service_order_id);
create index idx_service_order_parts_product on public.service_order_parts(product_id);

create trigger trg_service_order_parts_updated_at
  before update on public.service_order_parts
  for each row execute function public.set_updated_at();

-- ============================================================
-- RPC: create_product_with_initial_stock
-- Creates a product and optionally records initial_stock in Kardex
-- ============================================================
create or replace function public.create_product_with_initial_stock(
  p_name text,
  p_category text,
  p_cost_price numeric,
  p_sale_price numeric,
  p_initial_stock int default 0,
  p_min_stock int default 0,
  p_brand text default null,
  p_model text default null,
  p_sku text default null,
  p_barcode text default null,
  p_compatibility text default null,
  p_location text default null,
  p_supplier text default null,
  p_notes text default null
)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid := public.auth_business_id();
  v_product public.products;
  v_initial int := coalesce(p_initial_stock, 0);
begin
  if v_business_id is null then
    raise exception 'No business associated with the current user';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Product name is required';
  end if;
  if p_category is null or length(trim(p_category)) = 0 then
    raise exception 'Product category is required';
  end if;
  if v_initial < 0 then
    raise exception 'Initial stock cannot be negative';
  end if;

  insert into public.products (
    business_id,
    name,
    category,
    brand,
    model,
    sku,
    barcode,
    compatibility,
    location,
    supplier,
    cost_price,
    sale_price,
    current_stock,
    min_stock,
    notes,
    active
  )
  values (
    v_business_id,
    trim(p_name),
    trim(p_category),
    nullif(trim(p_brand), ''),
    nullif(trim(p_model), ''),
    nullif(trim(p_sku), ''),
    nullif(trim(p_barcode), ''),
    nullif(trim(p_compatibility), ''),
    nullif(trim(p_location), ''),
    nullif(trim(p_supplier), ''),
    coalesce(p_cost_price, 0),
    coalesce(p_sale_price, 0),
    v_initial,
    coalesce(p_min_stock, 0),
    nullif(trim(p_notes), ''),
    true
  )
  returning * into v_product;

  if v_initial > 0 then
    insert into public.inventory_movements (
      business_id,
      product_id,
      movement_type,
      quantity,
      previous_stock,
      new_stock,
      reason,
      performed_by,
      notes
    )
    values (
      v_business_id,
      v_product.id,
      'in',
      v_initial,
      0,
      v_initial,
      'initial_stock',
      auth.uid(),
      'Inventario inicial registrado al crear producto'
    );
  end if;

  return v_product;
end;
$$;

grant execute on function public.create_product_with_initial_stock(
  text, text, numeric, numeric, int, int, text, text, text, text, text, text, text, text
) to authenticated;

-- ============================================================
-- RPC: adjust_product_stock (Manual Entry or Exit)
-- Atomics with SELECT ... FOR UPDATE
-- ============================================================
create or replace function public.adjust_product_stock(
  p_product_id uuid,
  p_quantity int,
  p_reason text,
  p_reference_doc text default null,
  p_notes text default null
)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid := public.auth_business_id();
  v_product public.products;
  v_new_stock int;
  v_type text;
begin
  if v_business_id is null then
    raise exception 'No business associated with the current user';
  end if;
  if p_quantity = 0 or p_quantity is null then
    raise exception 'Quantity cannot be zero';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id
    and business_id = v_business_id
  for update;

  if v_product.id is null then
    raise exception 'Product not found or not accessible';
  end if;

  v_new_stock := v_product.current_stock + p_quantity;
  if v_new_stock < 0 then
    raise exception 'Stock insuficiente: la operación causaría stock negativo (disponible: %, solicitado: %)',
      v_product.current_stock, abs(p_quantity);
  end if;

  if p_quantity > 0 then
    v_type := 'in';
  else
    v_type := 'out';
  end if;

  update public.products
  set current_stock = v_new_stock
  where id = p_product_id;

  insert into public.inventory_movements (
    business_id,
    product_id,
    movement_type,
    quantity,
    previous_stock,
    new_stock,
    reason,
    reference_doc,
    performed_by,
    notes
  )
  values (
    v_business_id,
    p_product_id,
    v_type,
    p_quantity,
    v_product.current_stock,
    v_new_stock,
    p_reason,
    nullif(trim(p_reference_doc), ''),
    auth.uid(),
    nullif(trim(p_notes), '')
  );

  select * into v_product
  from public.products
  where id = p_product_id;

  return v_product;
end;
$$;

grant execute on function public.adjust_product_stock(uuid, int, text, text, text) to authenticated;

-- ============================================================
-- RPC: add_part_to_service_order
-- Assigns a spare part to an OS, freezes historic sale & cost prices,
-- atomically deducts stock and records movement.
-- ============================================================
create or replace function public.add_part_to_service_order(
  p_service_order_id uuid,
  p_product_id uuid,
  p_quantity int,
  p_notes text default null
)
returns public.service_order_parts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid := public.auth_business_id();
  v_order public.service_orders;
  v_product public.products;
  v_part public.service_order_parts;
begin
  if v_business_id is null then
    raise exception 'No business associated with the current user';
  end if;
  if p_quantity <= 0 or p_quantity is null then
    raise exception 'Part quantity must be greater than zero';
  end if;

  -- Verify order ownership
  select * into v_order
  from public.service_orders
  where id = p_service_order_id
    and business_id = v_business_id;

  if v_order.id is null then
    raise exception 'Service order not found or not accessible';
  end if;

  -- Lock product
  select * into v_product
  from public.products
  where id = p_product_id
    and business_id = v_business_id
  for update;

  if v_product.id is null then
    raise exception 'Product not found or not accessible';
  end if;

  if v_product.current_stock < p_quantity then
    raise exception 'Stock insuficiente: solo quedan % unidades de % en almacén',
      v_product.current_stock, v_product.name;
  end if;

  -- Deduct product stock
  update public.products
  set current_stock = current_stock - p_quantity
  where id = p_product_id;

  -- Record audit movement
  insert into public.inventory_movements (
    business_id,
    product_id,
    movement_type,
    quantity,
    previous_stock,
    new_stock,
    reason,
    service_order_id,
    performed_by,
    notes
  )
  values (
    v_business_id,
    p_product_id,
    'out',
    -p_quantity,
    v_product.current_stock,
    v_product.current_stock - p_quantity,
    'service_order',
    p_service_order_id,
    auth.uid(),
    coalesce(nullif(trim(p_notes), ''), 'Asignado a Orden #' || v_order.folio)
  );

  -- Upsert part row with current catalog prices
  insert into public.service_order_parts (
    business_id,
    service_order_id,
    product_id,
    quantity,
    unit_price,
    unit_cost,
    notes
  )
  values (
    v_business_id,
    p_service_order_id,
    p_product_id,
    p_quantity,
    v_product.sale_price,
    v_product.cost_price,
    nullif(trim(p_notes), '')
  )
  on conflict (service_order_id, product_id)
    do update set
      quantity = public.service_order_parts.quantity + p_quantity,
      updated_at = now()
  returning * into v_part;

  return v_part;
end;
$$;

grant execute on function public.add_part_to_service_order(uuid, uuid, int, text) to authenticated;

-- ============================================================
-- RPC: modify_service_order_part_qty
-- Modifies quantity of an assigned part with delta tracking:
-- delta > 0: deducts additional stock (reason: service_order)
-- delta < 0: returns stock to inventory (reason: service_return)
-- ============================================================
create or replace function public.modify_service_order_part_qty(
  p_service_order_id uuid,
  p_product_id uuid,
  p_new_quantity int
)
returns public.service_order_parts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid := public.auth_business_id();
  v_order public.service_orders;
  v_product public.products;
  v_part public.service_order_parts;
  v_delta int;
begin
  if v_business_id is null then
    raise exception 'No business associated with the current user';
  end if;
  if p_new_quantity <= 0 or p_new_quantity is null then
    raise exception 'New quantity must be greater than zero. To remove, use remove_part_from_service_order';
  end if;

  select * into v_order
  from public.service_orders
  where id = p_service_order_id and business_id = v_business_id;

  if v_order.id is null then
    raise exception 'Service order not found';
  end if;

  select * into v_part
  from public.service_order_parts
  where service_order_id = p_service_order_id
    and product_id = p_product_id
    and business_id = v_business_id
  for update;

  if v_part.id is null then
    raise exception 'Part assignment not found in this service order';
  end if;

  v_delta := p_new_quantity - v_part.quantity;

  if v_delta = 0 then
    return v_part;
  end if;

  select * into v_product
  from public.products
  where id = p_product_id and business_id = v_business_id
  for update;

  if v_delta > 0 then
    -- Needs more stock
    if v_product.current_stock < v_delta then
      raise exception 'Stock insuficiente: solo quedan % unidades disponibles (se requerían % adicionales)',
        v_product.current_stock, v_delta;
    end if;

    update public.products
    set current_stock = current_stock - v_delta
    where id = p_product_id;

    insert into public.inventory_movements (
      business_id,
      product_id,
      movement_type,
      quantity,
      previous_stock,
      new_stock,
      reason,
      service_order_id,
      performed_by,
      notes
    )
    values (
      v_business_id,
      p_product_id,
      'out',
      -v_delta,
      v_product.current_stock,
      v_product.current_stock - v_delta,
      'service_order',
      p_service_order_id,
      auth.uid(),
      'Incremento de repuesto en Orden #' || v_order.folio || ' (' || v_part.quantity || ' → ' || p_new_quantity || ')'
    );
  else
    -- Return stock to inventory (delta is negative)
    update public.products
    set current_stock = current_stock + abs(v_delta)
    where id = p_product_id;

    insert into public.inventory_movements (
      business_id,
      product_id,
      movement_type,
      quantity,
      previous_stock,
      new_stock,
      reason,
      service_order_id,
      performed_by,
      notes
    )
    values (
      v_business_id,
      p_product_id,
      'in',
      abs(v_delta),
      v_product.current_stock,
      v_product.current_stock + abs(v_delta),
      'service_return',
      p_service_order_id,
      auth.uid(),
      'Devolución parcial de repuesto de Orden #' || v_order.folio || ' (' || v_part.quantity || ' → ' || p_new_quantity || ')'
    );
  end if;

  update public.service_order_parts
  set quantity = p_new_quantity,
      updated_at = now()
  where id = v_part.id
  returning * into v_part;

  return v_part;
end;
$$;

grant execute on function public.modify_service_order_part_qty(uuid, uuid, int) to authenticated;

-- ============================================================
-- RPC: remove_part_from_service_order
-- Completely removes a part from an OS and returns all units to inventory
-- ============================================================
create or replace function public.remove_part_from_service_order(
  p_service_order_id uuid,
  p_product_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid := public.auth_business_id();
  v_order public.service_orders;
  v_product public.products;
  v_part public.service_order_parts;
begin
  if v_business_id is null then
    raise exception 'No business associated with the current user';
  end if;

  select * into v_order
  from public.service_orders
  where id = p_service_order_id and business_id = v_business_id;

  if v_order.id is null then
    raise exception 'Service order not found';
  end if;

  select * into v_part
  from public.service_order_parts
  where service_order_id = p_service_order_id
    and product_id = p_product_id
    and business_id = v_business_id
  for update;

  if v_part.id is null then
    raise exception 'Part not found on service order';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id and business_id = v_business_id
  for update;

  -- Return stock
  update public.products
  set current_stock = current_stock + v_part.quantity
  where id = p_product_id;

  -- Record return movement
  insert into public.inventory_movements (
    business_id,
    product_id,
    movement_type,
    quantity,
    previous_stock,
    new_stock,
    reason,
    service_order_id,
    performed_by,
    notes
  )
  values (
    v_business_id,
    p_product_id,
    'in',
    v_part.quantity,
    v_product.current_stock,
    v_product.current_stock + v_part.quantity,
    'service_return',
    p_service_order_id,
    auth.uid(),
    'Devolución total de repuesto por cancelación en Orden #' || v_order.folio
  );

  delete from public.service_order_parts
  where id = v_part.id;

  return true;
end;
$$;

grant execute on function public.remove_part_from_service_order(uuid, uuid) to authenticated;

-- ============================================================
-- Grants: Supabase Data API
-- ============================================================
grant select, insert, update on public.products to authenticated;
grant select on public.inventory_movements to authenticated;
grant select on public.service_order_parts to authenticated;

-- ============================================================
-- RLS Activation & Tenant Isolation Policies
-- ============================================================
alter table public.products enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.service_order_parts enable row level security;

-- Products Policies
create policy "products_select" on public.products
  for select to authenticated
  using (business_id = public.auth_business_id());

create policy "products_insert" on public.products
  for insert to authenticated
  with check (business_id = public.auth_business_id());

create policy "products_update" on public.products
  for update to authenticated
  using (business_id = public.auth_business_id())
  with check (business_id = public.auth_business_id());

-- Movements Policies (Read-only for users; inserts done through SEC DEFINER RPCs)
create policy "inventory_movements_select" on public.inventory_movements
  for select to authenticated
  using (business_id = public.auth_business_id());

-- Service Order Parts Policies
create policy "service_order_parts_select" on public.service_order_parts
  for select to authenticated
  using (business_id = public.auth_business_id());
