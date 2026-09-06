-- Automatic product SKUs and small-shop-friendly defaults.
-- Existing products and their SKUs are intentionally left unchanged.

create or replace function public.generate_product_sku(
  p_name text,
  p_category text,
  p_brand text default null,
  p_model text default null,
  p_business_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid := coalesce(p_business_id, public.auth_business_id());
  v_text text := lower(concat_ws(' ', p_name, p_category, p_model));
  v_family text := 'PRD';
  v_brand text;
  v_model text;
  v_variant text := '';
  v_base text;
  v_candidate text;
  v_suffix int := 2;
begin
  if v_text ~ 'mouse|ratón' then
    v_family := 'MOU';
  elsif v_text ~ 'teclado' then
    v_family := 'KBD';
  elsif v_text ~ 'parlante|speaker' then
    v_family := 'SPK';
  elsif v_text ~ 'estabilizador' then
    v_family := 'EST';
  elsif v_text ~ 'wifi|wi-fi' then
    v_family := 'WIFI';
  elsif v_text ~ 'bluetooth' then
    v_family := 'BT';
  elsif v_text ~ 'case|hdd|ssd' then
    v_family := 'CASE';
  elsif v_text ~ 'cable' then
    v_family := 'CBL';
  elsif v_text ~ 'monitor' then
    v_family := 'MON';
  end if;

  v_brand := upper(left(trim(regexp_replace(coalesce(p_brand, ''), '[^A-Za-z0-9]+', '', 'g')), 3));
  if v_brand = '' then v_brand := 'GEN'; end if;

  select upper(regexp_replace(token, '[^A-Za-z0-9]+', '', 'g'))
    into v_model
    from regexp_split_to_table(upper(coalesce(p_model, '')), '\s+') as token
   where token ~ '[0-9]'
   limit 1;

  if coalesce(v_model, '') = '' then
    v_model := upper(left(trim(regexp_replace(coalesce(p_model, ''), '[^A-Za-z0-9]+', '', 'g')), 12));
  end if;

  if coalesce(v_model, '') = '' then
    v_model := upper(left(trim(regexp_replace(coalesce(p_name, ''), '[^A-Za-z0-9]+', '', 'g')), 10));
  end if;
  if v_model = '' then v_model := 'ITEM'; end if;

  if v_text ~ '\m(blanco|white)\M' then v_variant := 'WHT';
  elsif v_text ~ '\m(negro|black)\M' then v_variant := 'BLK';
  elsif v_text ~ '\m(rojo|red)\M' then v_variant := 'RED';
  elsif v_text ~ '\m(celeste|azul|blue)\M' then v_variant := 'BLU';
  elsif v_text ~ '\m(gris|gray|grey)\M' then v_variant := 'GRY';
  elsif v_text ~ '\m(verde|green)\M' then v_variant := 'GRN';
  end if;

  v_base := 'PCMYM-' || v_family || '-' || v_brand || '-' || v_model;
  if v_variant <> '' then v_base := v_base || '-' || v_variant; end if;
  v_candidate := v_base;

  if v_business_id is null then
    raise exception 'No business associated with the current user';
  end if;

  while exists (
    select 1 from public.products
     where business_id = v_business_id
       and upper(sku) = upper(v_candidate)
  ) loop
    v_candidate := v_base || '-' || lpad(v_suffix::text, 2, '0');
    v_suffix := v_suffix + 1;
  end loop;

  return v_candidate;
end;
$$;

revoke all on function public.generate_product_sku(text, text, text, text, uuid) from public;

create or replace function public.create_product_with_initial_stock(
  p_name text,
  p_category text,
  p_cost_price numeric,
  p_sale_price numeric,
  p_initial_stock int default 1,
  p_min_stock int default 1,
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
  v_initial int := coalesce(p_initial_stock, 1);
  v_sku text := nullif(trim(p_sku), '');
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
  if v_sku is null then
    v_sku := public.generate_product_sku(p_name, p_category, p_brand, p_model, v_business_id);
  end if;

  insert into public.products (
    business_id, name, category, brand, model, sku, barcode, compatibility,
    location, supplier, cost_price, sale_price, current_stock, min_stock, notes, active
  )
  values (
    v_business_id,
    trim(p_name),
    trim(p_category),
    nullif(trim(p_brand), ''),
    nullif(trim(p_model), ''),
    v_sku,
    nullif(trim(p_barcode), ''),
    nullif(trim(p_compatibility), ''),
    nullif(trim(p_location), ''),
    nullif(trim(p_supplier), ''),
    coalesce(p_cost_price, 0),
    coalesce(p_sale_price, 0),
    v_initial,
    coalesce(p_min_stock, 1),
    nullif(trim(p_notes), ''),
    true
  )
  returning * into v_product;

  if v_initial > 0 then
    insert into public.inventory_movements (
      business_id, product_id, movement_type, quantity, previous_stock, new_stock,
      reason, performed_by, notes
    )
    values (
      v_business_id, v_product.id, 'in', v_initial, 0, v_initial,
      'initial_stock', auth.uid(), 'Inventario inicial registrado al crear producto'
    );
  end if;

  return v_product;
end;
$$;

grant execute on function public.create_product_with_initial_stock(
  text, text, numeric, numeric, int, int, text, text, text, text, text, text, text, text
) to authenticated;
