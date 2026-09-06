-- Keep server-generated model tokens aligned with the Angular preview and
-- backfill products created before automatic SKU generation existed.

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
  v_match text[];
begin
  if v_text ~ 'mouse|ratón' then v_family := 'MOU';
  elsif v_text ~ 'teclado' then v_family := 'KBD';
  elsif v_text ~ 'parlante|speaker' then v_family := 'SPK';
  elsif v_text ~ 'estabilizador' then v_family := 'EST';
  elsif v_text ~ 'wifi|wi-fi' then v_family := 'WIFI';
  elsif v_text ~ 'bluetooth' then v_family := 'BT';
  elsif v_text ~ 'case|hdd|ssd' then v_family := 'CASE';
  elsif v_text ~ 'cable' then v_family := 'CBL';
  elsif v_text ~ 'monitor' then v_family := 'MON';
  end if;

  v_brand := upper(left(trim(regexp_replace(coalesce(p_brand, ''), '[^A-Za-z0-9]+', '', 'g')), 3));
  if v_brand = '' then v_brand := 'GEN'; end if;

  select groups into v_match
    from regexp_matches(upper(coalesce(p_model, '')), '([A-Z]+-?[0-9][A-Z0-9]*)') as matches(groups)
   limit 1;
  v_model := upper(regexp_replace(coalesce(v_match[1], ''), '[^A-Za-z0-9]+', '', 'g'));

  if v_model = '' then
    v_model := upper(left(trim(regexp_replace(coalesce(p_model, ''), '[^A-Za-z0-9]+', '', 'g')), 12));
  end if;
  if v_model = '' then
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

do $$
declare
  v_product record;
begin
  for v_product in
    select id, business_id, name, category, brand, model
      from public.products
     where sku is null
     order by created_at, id
  loop
    update public.products
       set sku = public.generate_product_sku(
         v_product.name,
         v_product.category,
         v_product.brand,
         v_product.model,
         v_product.business_id
       )
     where id = v_product.id
       and sku is null;
  end loop;
end;
$$;
