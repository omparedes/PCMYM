-- Supplier catalog imports and standalone sales quotes.
-- Supplier data is kept separate from owned inventory: importing a Deltron list
-- never changes products.current_stock.

create table public.supplier_catalog_imports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier text not null default 'deltron',
  source_file_name text not null,
  source_hash text,
  exchange_rate numeric(10,4) not null default 1,
  tax_included boolean not null default false,
  status text not null default 'preview' check (status in ('preview', 'applied', 'failed')),
  total_rows integer not null default 0 check (total_rows >= 0),
  accepted_rows integer not null default 0 check (accepted_rows >= 0),
  skipped_rows integer not null default 0 check (skipped_rows >= 0),
  error_rows integer not null default 0 check (error_rows >= 0),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier text not null default 'deltron',
  supplier_code text not null,
  supplier_mini_code text,
  category text not null,
  name text not null,
  technical_description text,
  stock_text text,
  stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  stock_is_at_least boolean not null default false,
  distribution_price_usd numeric(12,2) check (distribution_price_usd is null or distribution_price_usd >= 0),
  pge_price_usd numeric(12,2) check (pge_price_usd is null or pge_price_usd >= 0),
  freight_text text,
  igv_exempt boolean not null default false,
  warranty_code text,
  brand text,
  technical_comment text,
  source_url text,
  product_type text not null default 'other' check (product_type in ('component', 'laptop', 'desktop', 'monitor', 'peripheral', 'other')),
  is_quote_candidate boolean not null default false,
  active boolean not null default true,
  last_import_id uuid references public.supplier_catalog_imports(id) on delete set null,
  last_seen_at timestamptz not null default now(),
  technical_attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, supplier, supplier_code)
);

create table public.sales_quote_folio_counters (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  next_folio integer not null default 1 check (next_folio > 0)
);

create table public.sales_quotes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  folio integer not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'approved', 'rejected', 'expired')),
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text,
  customer_phone text,
  currency text not null default 'PEN' check (currency = 'PEN'),
  exchange_rate numeric(10,4) not null default 1 check (exchange_rate > 0),
  margin_rate numeric(6,4) not null default 0.20 check (margin_rate >= 0 and margin_rate <= 5),
  tax_rate numeric(6,4) not null default 0.18 check (tax_rate >= 0 and tax_rate <= 1),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  valid_until date,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, folio)
);

create table public.sales_quote_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sales_quote_id uuid not null references public.sales_quotes(id) on delete cascade,
  supplier_product_id uuid references public.supplier_products(id) on delete restrict,
  description text not null,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_cost_usd numeric(12,2) check (unit_cost_usd is null or unit_cost_usd >= 0),
  unit_cost_pen numeric(12,2) not null default 0 check (unit_cost_pen >= 0),
  unit_price_pen numeric(12,2) not null default 0 check (unit_price_pen >= 0),
  compatibility_status text not null default 'unchecked' check (compatibility_status in ('unchecked', 'compatible', 'incompatible', 'review')),
  compatibility_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_supplier_catalog_imports_business on public.supplier_catalog_imports(business_id, created_at desc);
create index idx_supplier_products_business_category on public.supplier_products(business_id, product_type, is_quote_candidate, active);
create index idx_supplier_products_search on public.supplier_products using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(category, '')));
create index idx_sales_quotes_business on public.sales_quotes(business_id, created_at desc);
create index idx_sales_quote_items_quote on public.sales_quote_items(sales_quote_id, created_at);

create trigger trg_supplier_products_updated_at
  before update on public.supplier_products
  for each row execute function public.set_updated_at();

create trigger trg_sales_quotes_updated_at
  before update on public.sales_quotes
  for each row execute function public.set_updated_at();

create trigger trg_sales_quote_items_updated_at
  before update on public.sales_quote_items
  for each row execute function public.set_updated_at();

create or replace function public.next_sales_quote_folio()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid := public.auth_business_id();
  v_folio integer;
begin
  if v_business_id is null then
    raise exception 'No business associated with the current user';
  end if;

  insert into public.sales_quote_folio_counters (business_id, next_folio)
  values (v_business_id, 2)
  on conflict (business_id) do update set next_folio = sales_quote_folio_counters.next_folio + 1
  returning next_folio - 1 into v_folio;

  return v_folio;
end;
$$;

create or replace function public.validate_sales_quote_item()
returns trigger
language plpgsql
as $$
declare
  v_quote public.sales_quotes;
  v_product_business_id uuid;
begin
  select * into v_quote from public.sales_quotes where id = new.sales_quote_id;
  if v_quote.id is null or v_quote.business_id <> new.business_id then
    raise exception 'sales_quote_id does not belong to this business';
  end if;
  if v_quote.status <> 'draft' then
    raise exception 'Cannot modify items of a non-draft sales quote';
  end if;
  if new.supplier_product_id is not null then
    select business_id into v_product_business_id
      from public.supplier_products where id = new.supplier_product_id;
    if v_product_business_id is null or v_product_business_id <> new.business_id then
      raise exception 'supplier_product_id does not belong to this business';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.validate_sales_quote_item_delete()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status from public.sales_quotes where id = old.sales_quote_id;
  if v_status is not null and v_status <> 'draft' then
    raise exception 'Cannot delete items from a non-draft sales quote';
  end if;
  return old;
end;
$$;

create trigger trg_validate_sales_quote_item
  before insert or update on public.sales_quote_items
  for each row execute function public.validate_sales_quote_item();

create trigger trg_validate_sales_quote_item_delete
  before delete on public.sales_quote_items
  for each row execute function public.validate_sales_quote_item_delete();

create or replace function public.recalculate_sales_quote_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote_id uuid := coalesce(new.sales_quote_id, old.sales_quote_id);
begin
  update public.sales_quotes q
     set subtotal = coalesce((select round(sum(i.quantity * i.unit_price_pen), 2) from public.sales_quote_items i where i.sales_quote_id = v_quote_id), 0),
         tax_amount = round(coalesce((select sum(i.quantity * i.unit_price_pen) from public.sales_quote_items i where i.sales_quote_id = v_quote_id), 0) * q.tax_rate, 2),
         total_amount = round(coalesce((select sum(i.quantity * i.unit_price_pen) from public.sales_quote_items i where i.sales_quote_id = v_quote_id), 0) * (1 + q.tax_rate), 2),
         updated_at = now()
   where q.id = v_quote_id;
  return coalesce(new, old);
end;
$$;

create trigger trg_recalculate_sales_quote_total
  after insert or update or delete on public.sales_quote_items
  for each row execute function public.recalculate_sales_quote_total();

alter table public.supplier_catalog_imports enable row level security;
alter table public.supplier_products enable row level security;
alter table public.sales_quote_folio_counters enable row level security;
alter table public.sales_quotes enable row level security;
alter table public.sales_quote_items enable row level security;

create policy "supplier_catalog_imports_select" on public.supplier_catalog_imports
  for select using (business_id = public.auth_business_id());
create policy "supplier_catalog_imports_insert" on public.supplier_catalog_imports
  for insert with check (business_id = public.auth_business_id());
create policy "supplier_catalog_imports_update" on public.supplier_catalog_imports
  for update using (business_id = public.auth_business_id()) with check (business_id = public.auth_business_id());

create policy "supplier_products_select" on public.supplier_products
  for select using (business_id = public.auth_business_id());
create policy "supplier_products_insert" on public.supplier_products
  for insert with check (business_id = public.auth_business_id());
create policy "supplier_products_update" on public.supplier_products
  for update using (business_id = public.auth_business_id()) with check (business_id = public.auth_business_id());

create policy "sales_quotes_select" on public.sales_quotes
  for select using (business_id = public.auth_business_id());
create policy "sales_quotes_insert" on public.sales_quotes
  for insert with check (business_id = public.auth_business_id());
create policy "sales_quotes_update" on public.sales_quotes
  for update using (business_id = public.auth_business_id()) with check (business_id = public.auth_business_id());

create policy "sales_quote_items_select" on public.sales_quote_items
  for select using (business_id = public.auth_business_id());
create policy "sales_quote_items_insert" on public.sales_quote_items
  for insert with check (business_id = public.auth_business_id());
create policy "sales_quote_items_update" on public.sales_quote_items
  for update using (business_id = public.auth_business_id()) with check (business_id = public.auth_business_id());
create policy "sales_quote_items_delete" on public.sales_quote_items
  for delete using (business_id = public.auth_business_id());

grant select, insert, update on public.supplier_catalog_imports to authenticated;
grant select, insert, update on public.supplier_products to authenticated;
grant select, insert, update on public.sales_quotes to authenticated;
grant select, insert, update, delete on public.sales_quote_items to authenticated;
grant execute on function public.next_sales_quote_folio() to authenticated;
