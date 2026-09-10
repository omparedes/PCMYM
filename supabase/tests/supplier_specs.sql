-- Synthetic fixtures only. Every write is rolled back, including auth users.
begin;
do $$
declare c jsonb;
begin
  if public.infer_supplier_specs('CASES ATX', 'CASE GM ATX', 'Soporta: Mini-ITX/Micro-ATX. Fuente ATX') ->> 'supported_board_formats' is distinct from 'Micro-ATX,Mini-ITX' then
    raise exception 'Case name or PSU must not add ATX motherboard support';
  end if;
  if public.infer_supplier_specs('CASES ATX', 'CASE ATX', 'Compatible con RGB, fuente ATX') ? 'supported_board_formats' then
    raise exception 'Generic compatibility text must not imply case fit';
  end if;
  if public.supplier_header_classification('MB CI9 S1700 DDR4')->>'component_category' is distinct from 'motherboard' then raise exception 'MB header'; end if;
  if public.supplier_header_classification('CPU CI5 12XXX S1700')->>'component_category' is distinct from 'processor' then raise exception 'CPU header'; end if;
  if public.supplier_header_classification('FAN COOLER CPU')->>'component_category' is distinct from 'cooling' then raise exception 'Cooler header'; end if;
  if public.supplier_header_classification('CASES, FUENTE PARA GAMING')->>'component_category' is distinct from 'power_supply' then raise exception 'PSU exception'; end if;
  if public.supplier_header_classification('CASES, ACCESORIOS')->>'component_category' is distinct from 'other' then raise exception 'Case accessory exclusion'; end if;
  if public.supplier_header_classification('MEM FLASH, USB DRIVE')->>'component_category' is distinct from 'other' then raise exception 'Flash exclusion'; end if;
  if public.supplier_header_classification('PRODUCTOS SIN CLASIFICAR')->>'product_type' is distinct from 'other' then raise exception 'Unknown header'; end if;
  c := public.infer_supplier_specs('CPU AMD RYZEN 5 SAM4 5XXX', 'PROC AMD 5600', 'Incluye cooler');
  if c->>'socket' is distinct from 'AM4' or c->>'generation' is distinct from '5000' or c->>'family' is distinct from 'Ryzen 5' then raise exception 'AMD extraction: %', c; end if;
  c := public.infer_supplier_specs('CPU CI5 12XXX S1700', 'PROC INT CORE I5-12400', '');
  if c->>'socket' is distinct from 'LGA1700' or c->>'family' is distinct from 'Core i5' or c->>'generation' is distinct from '12' then raise exception 'Intel extraction: %', c; end if;
  c := public.infer_supplier_specs('MB CI9 S1700 DDR4', 'MB B760M', 'Placa Micro-ATX, 2 DIMM');
  if c->>'board_format' is distinct from 'Micro-ATX' or c->>'memory_type' is distinct from 'DDR4' then raise exception 'Board extraction: %', c; end if;
  c := public.infer_supplier_specs('MEM DDR5 5200 PC5-41600', 'MEM RAM 8G SOD', '8GB SO-DIMM');
  if c->>'memory_format' is distinct from 'SO-DIMM' then raise exception 'Description overrides misleading RAM header'; end if;
end $$;
insert into public.businesses(id, name, slug) values
('a5000000-0000-4000-8000-000000000001', 'Synthetic catalog A', 'test-catalog-a-20260908'),
('a5000000-0000-4000-8000-000000000002', 'Synthetic catalog B', 'test-catalog-b-20260908');
insert into auth.users(id) values ('a5000000-0000-4000-8000-000000000003');
insert into public.profiles(id, business_id, name, role) values
('a5000000-0000-4000-8000-000000000003', 'a5000000-0000-4000-8000-000000000001', 'Synthetic tester', 'owner');
insert into public.supplier_products(id, business_id, supplier_code, category, name, technical_description, stock_quantity, distribution_price_usd) values
('a5000000-0000-4000-8000-000000000004', 'a5000000-0000-4000-8000-000000000001', 'TEST-RAM', 'MEM DDR4 3200 PC4-25600', 'MEM 8GB', 'Memoria de prueba DIMM', 5, 20),
('a5000000-0000-4000-8000-000000000005', 'a5000000-0000-4000-8000-000000000002', 'TEST-RAM-B', 'MEM DDR4 3200 PC4-25600', 'MEM 8GB', 'Memoria de prueba DIMM', 5, 10),
('a5000000-0000-4000-8000-000000000006', 'a5000000-0000-4000-8000-000000000001', 'TEST-KEYBOARD', 'TECLADO USB', 'Teclado para PC', 'Compatible motherboard CPU intel; buffer 8 MB', 5, 10),
('a5000000-0000-4000-8000-000000000007', 'a5000000-0000-4000-8000-000000000001', 'TEST-HDD', 'DISCO DURO 3.5" SATA', 'Disco 64 MB', 'Para motherboard Intel', 5, 10),
('a5000000-0000-4000-8000-000000000008', 'a5000000-0000-4000-8000-000000000001', 'TEST-BATTERY', 'ACCESORIOS', 'Pila para placa madre', 'CPU MB AMD', 5, 1);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a5000000-0000-4000-8000-000000000003', true);
do $$
declare source_id uuid; copy_id uuid; q public.sales_quotes; item_count int;
begin
  insert into public.sales_quotes (business_id, folio, customer_name, exchange_rate, margin_rate, tax_rate)
  values ('a5000000-0000-4000-8000-000000000001', public.next_sales_quote_folio(), 'Cliente original', 3.37, .2, .18)
  returning id into source_id;
  insert into public.sales_quote_items (business_id, sales_quote_id, supplier_product_id, description, quantity, unit_cost_usd, unit_cost_pen, unit_price_pen)
  values ('a5000000-0000-4000-8000-000000000001', source_id, 'a5000000-0000-4000-8000-000000000004', 'MEM 8GB', 1, 20, 67.4, 81);
  update public.sales_quotes set status = 'sent' where id = source_id;
  q := public.duplicate_sales_quote(source_id);
  copy_id := q.id;
  if q.status is distinct from 'draft' or q.customer_name is distinct from 'Cliente original' then raise exception 'Duplicate header'; end if;
  select count(*) into item_count from public.sales_quote_items where sales_quote_id = copy_id;
  if item_count <> 1 then raise exception 'Duplicate items: %', item_count; end if;
  if (select total_amount from public.sales_quotes where id = source_id) <> (select total_amount from public.sales_quotes where id = copy_id) then raise exception 'Duplicate total'; end if;
  begin
    perform public.update_sales_quote_draft(source_id, 'No debe editarse', '', 3.37, .2, .18, null, '', '[]');
    raise exception 'Sent quote edited';
  exception when raise_exception then
    if sqlerrm is distinct from 'Only draft sales quotes can be edited' then raise; end if;
  end;
  q := public.update_sales_quote_draft(copy_id, 'Cliente nuevo', '999999999', 3.4, .25, .18, '2030-01-01', 'Agregar monitor', jsonb_build_array(jsonb_build_object(
    'supplier_product_id', 'a5000000-0000-4000-8000-000000000004', 'description', 'MEM 8GB', 'quantity', 2,
    'unit_cost_usd', 20, 'unit_cost_pen', 68, 'unit_price_pen', 90, 'compatibility_status', 'unchecked',
    'compatibility_notes', null, 'build_key', null, 'specification_snapshot', '{}'::jsonb)));
  if q.customer_name is distinct from 'Cliente nuevo' or q.status is distinct from 'draft' then raise exception 'Draft update'; end if;
  if (select customer_name from public.sales_quotes where id = source_id) is distinct from 'Cliente original' then raise exception 'Source modified'; end if;
end $$;
do $$
declare p public.supplier_products; n int;
begin
  select count(*) into n from public.search_supplier_products('RAM 8G DDR4');
  if n is distinct from 1 then raise exception 'Token search / tenant isolation: %', n; end if;
  select count(*) into n from public.search_supplier_products(p_component_category => 'motherboard');
  if n is distinct from 0 then raise exception 'False motherboard classifications'; end if;
  p := public.set_supplier_specifications('a5000000-0000-4000-8000-000000000004', '{"memory_type":"DDR5","modules_per_kit":"1"}');
  -- A fresh import writes raw supplier fields, while manual overrides survive.
  insert into public.supplier_products (business_id, supplier_code, category, name, distribution_price_usd)
  values ('a5000000-0000-4000-8000-000000000001', 'TEST-RAM', 'MEM DDR4 3200 PC4-25600', 'MEM 8GB new price', 25)
  on conflict (business_id, supplier, supplier_code) do update set name = excluded.name, distribution_price_usd = excluded.distribution_price_usd;
  select * into p from public.supplier_products where id = 'a5000000-0000-4000-8000-000000000004';
  if p.technical_attributes->>'memory_type' is distinct from 'DDR5' or p.distribution_price_usd is distinct from 25 then raise exception 'Override lost on import'; end if;
  begin
    perform public.set_supplier_specifications('a5000000-0000-4000-8000-000000000005', '{"memory_type":"DDR3"}');
    raise exception 'Cross-tenant edit succeeded';
  exception when raise_exception then
    if sqlerrm is distinct from 'Product not found' then raise; end if;
  end;
  p := public.set_supplier_specifications('a5000000-0000-4000-8000-000000000004', '{}');
  if p.technical_attributes->>'memory_type' is distinct from 'DDR4' then raise exception 'Restore inferred specs'; end if;
end $$;
reset role;
rollback;
select 'Catalog classification, specifications, import preservation and RLS checks passed' as result;
