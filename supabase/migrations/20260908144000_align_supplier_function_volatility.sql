alter function public.supplier_header_classification(text) stable;
create or replace function public.infer_supplier_specs(p_category text, p_name text, p_description text)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  c text := upper(coalesce(p_category, ''));
  t text := upper(coalesce(p_name, '') || ' ' || coalesce(p_description, ''));
  k text := public.supplier_header_classification(p_category)->>'component_category';
  a jsonb := '{}'::jsonb;
  v text; f text; formats text[] := array[]::text[];
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
    -- Cases: only the explicit list immediately following a support label is evidence.
    -- A nominal ATX case or its ATX PSU must not enlarge the supported motherboard list.
    if k = 'case' then
      t := coalesce(substring(t from '(?:SOPORTA(?:DOS|DAS)?|COMPATIBLES?(?: CON)?|SUPPORT(?:ED|S)?)[ :]*((?:MICRO[ -]?ATX|MINI[ -]?ITX|E[ -]?ATX|M[ -]?ATX|ATX)(?:[ ,/]+(?:MICRO[ -]?ATX|MINI[ -]?ITX|E[ -]?ATX|M[ -]?ATX|ATX))*)'), '');
    end if;
    if t ~ '\m(MICRO[ -]?ATX|M[ -]?ATX)\M' then formats := array_append(formats, 'Micro-ATX'); end if;
    if t ~ '\m(MINI[ -]?ITX)\M' then formats := array_append(formats, 'Mini-ITX'); end if;
    if t ~ '\m(E[ -]?ATX)\M' then formats := array_append(formats, 'E-ATX'); end if;
    f := regexp_replace(t, '\m(MICRO[ -]?ATX|M[ -]?ATX|E[ -]?ATX)\M', '', 'g');
    if f ~ '\mATX\M' then formats := array_append(formats, 'ATX'); end if;
    if cardinality(formats) = 1 and k = 'motherboard' then a := a || jsonb_build_object('board_format', formats[1]); end if;
    if k = 'case' then
      -- Only explicit support lists are trusted, never infer fit from size ordering.
      if cardinality(formats) > 0 then a := a || jsonb_build_object('supported_board_formats', array_to_string(formats, ',')); end if;
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



