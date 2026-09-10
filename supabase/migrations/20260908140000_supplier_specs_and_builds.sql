-- Header-first classification, conservative technical extraction and persistent overrides.
alter table public.supplier_products
  add column inferred_attributes jsonb not null default '{}'::jsonb,
  add column specification_overrides jsonb not null default '{}'::jsonb
    check (jsonb_typeof(specification_overrides) = 'object');
alter table public.sales_quote_items
  add column build_key text,
  add column specification_snapshot jsonb not null default '{}'::jsonb;

create or replace function public.supplier_header_classification(p_category text)
returns jsonb language plpgsql immutable set search_path = public as $$
declare
  c text := public.normalize_supplier_catalog_text(p_category);
  kind text := 'other';
  grp text := 'other';
  typ text := 'other';
begin
  -- Specific exclusions precede their broader families. Never inspect product descriptions.
  if c ~ '^(cases accesorios|disco duro accesorios|ssd accesorios|mem flash|monitores accesorios|monitores rack|monitores pantallas acc|notebook acc|notebook maletin)' then
    grp := 'peripherals'; typ := 'peripheral';
  elsif c ~ '^cases fuente ' then kind := 'power_supply';
  elsif c ~ '^(cooler |fan cooler )' then kind := 'cooling';
  elsif c ~ '^cpu ' then kind := 'processor';
  elsif c ~ '^mb ' then kind := 'motherboard';
  elsif c ~ '^(mem ddr|mem sodimm|memorias ddr)' then kind := 'memory';
  elsif c ~ '^(ssd (2 5|m 2)|disco duro 3 5)' then kind := 'storage';
  elsif c ~ '^(disco duro externo|disco solido externo)' then grp := 'peripherals'; typ := 'peripheral';
  elsif c ~ '^video pci ' then kind := 'graphics';
  elsif c ~ '^cases (atx|micro atx|con fuente|sin fuente)' then kind := 'case';
  elsif c ~ '^notebook ' then grp := 'laptops'; typ := 'laptop';
  elsif c ~ '^monitor(es)? ' then grp := 'monitors'; typ := 'monitor';
  elsif c ~ '^(mouse |teclado|audio |camara webcam)' then grp := 'peripherals'; typ := 'peripheral';
  elsif c ~ '^(computadora |barebone)' then typ := 'desktop';
  end if;
  if kind <> 'other' then grp := 'pc_parts'; typ := 'component'; end if;
  return jsonb_build_object('component_category', kind, 'catalog_group', grp, 'product_type', typ);
end;
$$;

create or replace function public.infer_supplier_specs(p_category text, p_name text, p_description text)
returns jsonb language plpgsql immutable set search_path = public as $$
declare
  c text := upper(coalesce(p_category, ''));
  t text := upper(coalesce(p_name, '') || ' ' || coalesce(p_description, ''));
  k text := public.supplier_header_classification(p_category)->>'component_category';
  a jsonb := '{}'::jsonb;
  v text; f text; formats text[] := '{}';
begin
  if k in ('processor', 'motherboard') then
    v := substring(c from 'S?(AM[45])');
    if v is null then v := substring(c from '(?:LGA|S)\s*(1700|1851|1200|1151|4677)');
      if v is not null then v := 'LGA' || v; end if;
    end if;
    if v is null then
      v := substring(t from '\m(AM[45])\M');
      if v is null then v := substring(t from 'LGA\s*(1700|1851|1200|1151|4677)');
        if v is not null then v := 'LGA' || v; end if;
      end if;
    end if;
    if v is not null then a := a || jsonb_build_object('socket', v, 'platform', case when v like 'AM%' then 'AMD' else 'Intel' end); end if;
  end if;
  if k = 'processor' then
    v := substring(c from 'RYZEN ([3579])');
    if v is not null then a := a || jsonb_build_object('family', 'Ryzen ' || v); end if;
    v := substring(c from 'CI([3579])');
    if v is not null then a := a || jsonb_build_object('family', 'Core i' || v); end if;
    v := substring(c from 'CU([579])');
    if v is not null then a := a || jsonb_build_object('family', 'Core Ultra ' || v); end if;
    v := substring(c from '(\d{1,2})XXX');
    if v is not null then a := a || jsonb_build_object('generation', case when c like '%AMD%' then v || '000' else v end); end if;
    if c ~ 'CU[579] 2XX' then a := a || '{"generation":"200"}'::jsonb; end if;
    if a->>'socket' = 'AM4' then a := a || '{"memory_type":"DDR4"}'::jsonb; end if;
    if a->>'socket' in ('AM5', 'LGA1851') then a := a || '{"memory_type":"DDR5"}'::jsonb; end if;
  end if;
  if k in ('memory', 'motherboard') then
    v := substring(c || ' ' || t from '\m(DDR[345])\M');
    if v is not null then a := a || jsonb_build_object('memory_type', v); end if;
    if k = 'memory' then
      a := a || jsonb_build_object('memory_format', case when c ~ 'SODIMM' or t ~ 'SO[ -]?DIMM' then 'SO-DIMM' when t ~ '\m(U?DIMM)\M' then 'DIMM' else null end);
      v := substring(c from 'DDR[345] (\d{4,5})');
      if v is not null then a := a || jsonb_build_object('speed', v); end if;
      v := substring(t from '\m(\d+)\s*GB\M');
      if v is not null then a := a || jsonb_build_object('capacity_gb', v); end if;
    else
      v := substring(t from '\m([ABHXZ][0-9]{3}[A-Z]?)\M');
      if v is not null then a := a || jsonb_build_object('chipset', v); end if;
      if t ~ 'SO[ -]?DIMM' then a := a || '{"memory_format":"SO-DIMM"}'::jsonb;
      elsif t ~ '\m(U?DIMM)\M' then a := a || '{"memory_format":"DIMM"}'::jsonb; end if;
    end if;
  end if;
  if k in ('motherboard', 'case') then
    -- Scan the description, not the header: nominal ATX cases can have exceptions.
    if t ~ '(MICRO[ -]?ATX|M[ -]?ATX)' then formats := array_append(formats, 'Micro-ATX'); end if;
    if t ~ '(MINI[ -]?ITX)' then formats := array_append(formats, 'Mini-ITX'); end if;
    if t ~ '(E[ -]?ATX)' then formats := array_append(formats, 'E-ATX'); end if;
    f := regexp_replace(t, '(MICRO[ -]?ATX|M[ -]?ATX|E[ -]?ATX)', '', 'g');
    if f ~ '\mATX\M' then formats := array_append(formats, 'ATX'); end if;
    if cardinality(formats) = 1 and k = 'motherboard' then a := a || jsonb_build_object('board_format', formats[1]); end if;
    if k = 'case' then
      -- Only explicit support lists are trusted, never infer fit from size ordering.
      if t ~ '(SOPORT|COMPATIB|SUPPORT)' and cardinality(formats) > 0 then a := a || jsonb_build_object('supported_board_formats', array_to_string(formats, ',')); end if;
      if c ~ 'CON FUENTE' then a := a || '{"includes_psu":"yes"}'::jsonb;
      elsif c ~ 'SIN FUENTE' then a := a || '{"includes_psu":"no"}'::jsonb; end if;
    end if;
  end if;
  if k = 'storage' then
    if c ~ 'NVME' then a := a || '{"storage_interface":"NVMe"}'::jsonb;
    elsif c ~ 'SATA' then a := a || '{"storage_interface":"SATA"}'::jsonb; end if;
    v := substring(t from '\m([0-9.]+\s*(?:GB|TB))\M');
    if v is not null then a := a || jsonb_build_object('capacity', replace(v, ' ', '')); end if;
  end if;
  if k = 'power_supply' then
    v := substring(t from '\m(\d{3,4})\s*W');
    if v is not null then a := a || jsonb_build_object('power_watts', v); end if;
  end if;
  if k = 'cooling' then
    a := a || jsonb_build_object('cooling_type', case when c like '%LIQUID%' then 'Liquid' when c like '%FAN%' then 'Air' else null end);
    v := substring(c from '\m(120|140|240|280|360|420)\M');
    if v is not null then a := a || jsonb_build_object('radiator_mm', v); end if;
  end if;
  return jsonb_strip_nulls(a);
end;
$$;

create or replace function public.refresh_supplier_specs()
returns trigger language plpgsql set search_path = public as $$
declare
  cls jsonb;
  aliases text;
begin
  cls := public.supplier_header_classification(new.category);
  new.inferred_attributes := public.infer_supplier_specs(new.category, new.name, new.technical_description);
  if exists (select 1 from jsonb_each(new.specification_overrides) x where jsonb_typeof(x.value) not in ('string', 'null')) then
    raise exception 'Specification overrides must contain text values';
  end if;
  new.product_type := coalesce(nullif(new.specification_overrides->>'product_type', ''), cls->>'product_type');
  new.catalog_group := coalesce(nullif(new.specification_overrides->>'catalog_group', ''), cls->>'catalog_group');
  new.component_category := coalesce(nullif(new.specification_overrides->>'component_category', ''), cls->>'component_category');
  new.technical_attributes := jsonb_strip_nulls(new.inferred_attributes || (new.specification_overrides - array['product_type', 'catalog_group', 'component_category']));
  new.is_quote_candidate := new.product_type <> 'other' and new.distribution_price_usd > 0;
  new.is_quote_candidate := coalesce(new.is_quote_candidate, false);
  aliases := case new.component_category
    when 'processor' then 'procesador processor cpu proc'
    when 'motherboard' then 'placa madre motherboard mobo mb'
    when 'memory' then 'ram memoria memory mem'
    when 'storage' then 'almacenamiento disco storage'
    when 'graphics' then 'gpu vga tarjeta de video grafica'
    when 'power_supply' then 'fuente de poder psu power supply'
    when 'case' then 'case gabinete chasis'
    when 'cooling' then 'cooler refrigeracion disipador ventilador cooling'
    else '' end;
  new.search_document := public.normalize_supplier_catalog_text(concat_ws(' ', new.category, new.name, new.brand, new.supplier_code,
    new.technical_description, new.technical_comment, new.technical_attributes::text, aliases,
    case new.product_type when 'laptop' then 'laptop notebook portatil' when 'monitor' then 'monitor pantalla' else '' end));
  new.search_terms := string_to_array(new.search_document, ' ');
  return new;
end;
$$;
create trigger trg_refresh_supplier_specs before insert or update on public.supplier_products
  for each row execute function public.refresh_supplier_specs();

-- Rebuild old classifications and poisoned aliases using raw supplier data only.
update public.supplier_products set category = category where supplier = 'deltron';

create or replace function public.set_supplier_specifications(p_product_id uuid, p_overrides jsonb)
returns public.supplier_products language plpgsql security invoker set search_path = public as $$
declare result public.supplier_products;
begin
  if jsonb_typeof(p_overrides) is distinct from 'object' then raise exception 'Expected specification object'; end if;
  update public.supplier_products set specification_overrides = p_overrides
    where id = p_product_id and business_id = public.auth_business_id() returning * into result;
  if result.id is null then raise exception 'Product not found'; end if;
  return result;
end;
$$;

-- Deterministic ordering is required when reading successive catalog pages.
create or replace function public.search_supplier_products(
  p_search text default null, p_quote_only boolean default true, p_catalog_group text default null,
  p_component_category text default null, p_include_out_of_stock boolean default false,
  p_limit integer default 80, p_offset integer default 0
) returns setof public.supplier_products language sql stable security invoker set search_path = public as $$
  select p.* from public.supplier_products p
  where p.business_id = public.auth_business_id() and p.active
    and (not coalesce(p_quote_only, true) or p.is_quote_candidate)
    and (coalesce(p_include_out_of_stock, false) or p.stock_quantity > 0)
    and (p_catalog_group is null or p.catalog_group = p_catalog_group)
    and (p_component_category is null or p.component_category = p_component_category)
    and not exists (
      select 1 from regexp_split_to_table(public.normalize_supplier_catalog_text(p_search), ' +') token
      where token <> '' and position(token in p.search_document) = 0
    )
  order by p.distribution_price_usd asc nulls last, p.name, p.id
  limit least(greatest(coalesce(p_limit, 80), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
$$;
revoke all on function public.supplier_header_classification(text) from public, anon;
revoke all on function public.infer_supplier_specs(text, text, text) from public, anon;
revoke all on function public.refresh_supplier_specs() from public, anon;
revoke all on function public.set_supplier_specifications(uuid, jsonb) from public, anon;
revoke all on function public.search_supplier_products(text, boolean, text, text, boolean, integer, integer) from public, anon;
grant execute on function public.supplier_header_classification(text), public.infer_supplier_specs(text, text, text),
  public.set_supplier_specifications(uuid, jsonb), public.search_supplier_products(text, boolean, text, text, boolean, integer, integer) to authenticated;
