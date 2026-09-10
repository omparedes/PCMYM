-- Refine supplier catalog discovery for fast quote building.
-- Search metadata is normalized at import time and queried server-side so each
-- tenant can search the complete catalog without loading arbitrary row limits.

alter table public.supplier_products
  add column if not exists catalog_group text not null default 'other'
    check (catalog_group in ('pc_parts', 'laptops', 'monitors', 'peripherals', 'other')),
  add column if not exists component_category text not null default 'other'
    check (component_category in ('processor', 'motherboard', 'memory', 'storage', 'graphics', 'power_supply', 'case', 'cooling', 'other')),
  add column if not exists search_document text not null default '',
  add column if not exists search_terms text[] not null default '{}'::text[];

create or replace function public.normalize_supplier_catalog_text(p_value text)
returns text
language sql
immutable
parallel safe
as $$
  select trim(regexp_replace(
    lower(translate(coalesce(p_value, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')),
    '[^a-z0-9]+', ' ', 'g'
  ));
$$;

-- Backfill products imported by the first catalog version. New imports provide
-- richer aliases from the Angular parser, but existing rows must remain useful.
update public.supplier_products
set catalog_group = case product_type
      when 'laptop' then 'laptops'
      when 'monitor' then 'monitors'
      when 'peripheral' then 'peripherals'
      when 'component' then 'pc_parts'
      when 'desktop' then 'pc_parts'
      else 'other'
    end,
    component_category = case
      when product_type <> 'component' then 'other'
      when normalize_supplier_catalog_text(category || ' ' || name || ' ' || coalesce(technical_description, '')) ~ '(cpu|proc|procesador|processor|ryzen|intel|core i|xeon|celeron|pentium)' then 'processor'
      when normalize_supplier_catalog_text(category || ' ' || name || ' ' || coalesce(technical_description, '')) ~ '(motherboard|mainboard|mobo|placa|mb )' then 'motherboard'
      when normalize_supplier_catalog_text(category || ' ' || name || ' ' || coalesce(technical_description, '')) ~ '(ram|memoria|memory|ddr[345])' then 'memory'
      when normalize_supplier_catalog_text(category || ' ' || name || ' ' || coalesce(technical_description, '')) ~ '(ssd|hdd|disco|nvme|m 2)' then 'storage'
      when normalize_supplier_catalog_text(category || ' ' || name || ' ' || coalesce(technical_description, '')) ~ '(gpu|vga|video|grafica|rtx|gtx|radeon|rx )' then 'graphics'
      when normalize_supplier_catalog_text(category || ' ' || name || ' ' || coalesce(technical_description, '')) ~ '(psu|fuente|power supply)' then 'power_supply'
      when normalize_supplier_catalog_text(category || ' ' || name || ' ' || coalesce(technical_description, '')) ~ '(case|cases|gabinete|chasis|tower)' then 'case'
      when normalize_supplier_catalog_text(category || ' ' || name || ' ' || coalesce(technical_description, '')) ~ '(cooler|cooling|refriger|disipador|ventilador|fan)' then 'cooling'
      else 'other'
    end,
    search_document = normalize_supplier_catalog_text(
      category || ' ' || name || ' ' || coalesce(technical_description, '') || ' ' ||
      coalesce(brand, '') || ' ' || supplier_code || ' ' ||
      coalesce(technical_comment, '') || ' ' || coalesce(technical_attributes::text, '') || ' ' ||
      case
        when product_type = 'laptop' then 'laptop notebook portatil'
        when product_type = 'monitor' then 'monitor pantalla'
        when product_type = 'peripheral' then 'periferico accesorio'
        when product_type in ('component', 'desktop') then 'pc computadora partes'
        else ''
      end || ' ' ||
      case
        when product_type = 'component' and normalize_supplier_catalog_text(category || ' ' || name || ' ' || coalesce(technical_description, '')) ~ '(ram|memoria|memory|ddr[345])' then 'ram memoria memoria ram'
        when product_type = 'component' and normalize_supplier_catalog_text(category || ' ' || name || ' ' || coalesce(technical_description, '')) ~ '(motherboard|mainboard|mobo|placa|mb )' then 'motherboard placa placa madre mobo mb'
        when product_type = 'component' and normalize_supplier_catalog_text(category || ' ' || name || ' ' || coalesce(technical_description, '')) ~ '(case|cases|gabinete|chasis|tower)' then 'case gabinete chasis'
        when product_type = 'component' and normalize_supplier_catalog_text(category || ' ' || name || ' ' || coalesce(technical_description, '')) ~ '(fuente|psu|power supply)' then 'fuente fuente de poder psu'
        when product_type = 'component' and normalize_supplier_catalog_text(category || ' ' || name || ' ' || coalesce(technical_description, '')) ~ '(ssd|hdd|disco|nvme|m 2)' then 'ssd disco almacenamiento nvme'
        when product_type = 'component' and normalize_supplier_catalog_text(category || ' ' || name || ' ' || coalesce(technical_description, '')) ~ '(gpu|vga|video|grafica|rtx|gtx|radeon)' then 'gpu video tarjeta grafica'
        else ''
      end
    ),
    search_terms = string_to_array(normalize_supplier_catalog_text(
      category || ' ' || name || ' ' || coalesce(technical_description, '') || ' ' ||
      coalesce(brand, '') || ' ' || supplier_code || ' ' ||
      coalesce(technical_comment, '') || ' ' || coalesce(technical_attributes::text, '') || ' ' ||
      case
        when product_type = 'laptop' then 'laptop notebook portatil'
        when product_type = 'monitor' then 'monitor pantalla'
        when product_type = 'peripheral' then 'periferico accesorio'
        when product_type in ('component', 'desktop') then 'pc computadora partes'
        else ''
      end
    ), ' ')
where search_document = '' or search_terms = '{}'::text[];

create index if not exists idx_supplier_products_catalog_filter
  on public.supplier_products (business_id, active, catalog_group, component_category, distribution_price_usd);

create index if not exists idx_supplier_products_search_document
  on public.supplier_products using gin (to_tsvector('simple', search_document));

create or replace function public.search_supplier_products(
  p_search text default null,
  p_quote_only boolean default true,
  p_catalog_group text default null,
  p_component_category text default null,
  p_include_out_of_stock boolean default false,
  p_limit integer default 80,
  p_offset integer default 0
)
returns setof public.supplier_products
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_business_id uuid := public.auth_business_id();
  v_tokens text[] := array(
    select token
    from regexp_split_to_table(public.normalize_supplier_catalog_text(p_search), ' +') as token
    where token <> ''
  );
begin
  if v_business_id is null then
    raise exception 'No business associated with the current user';
  end if;

  p_limit := least(greatest(coalesce(p_limit, 80), 1), 200);
  p_offset := greatest(coalesce(p_offset, 0), 0);

  return query
  select product.*
  from public.supplier_products product
  where product.business_id = v_business_id
    and product.active
    and (not p_quote_only or product.is_quote_candidate)
    and (p_include_out_of_stock or coalesce(product.stock_quantity, 0) > 0)
    and (p_catalog_group is null or product.catalog_group = p_catalog_group)
    and (p_component_category is null or product.component_category = p_component_category)
    and (
      coalesce(array_length(v_tokens, 1), 0) = 0
      or not exists (
        select 1
        from unnest(v_tokens) as token
        where position(token in product.search_document) = 0
      )
    )
  order by product.distribution_price_usd asc nulls last, product.name asc
  limit p_limit offset p_offset;
end;
$$;

revoke all on function public.normalize_supplier_catalog_text(text) from public, anon, authenticated;
grant execute on function public.search_supplier_products(text, boolean, text, text, boolean, integer, integer) to authenticated;
