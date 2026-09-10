-- Correct supplier abbreviations in rows imported before the refined parser.
-- The previous migration is already applied and remains immutable.

update public.supplier_products
set component_category = 'motherboard',
    search_document = public.normalize_supplier_catalog_text(search_document || ' motherboard placa placa madre mobo mb'),
    search_terms = string_to_array(public.normalize_supplier_catalog_text(search_document || ' motherboard placa placa madre mobo mb'), ' ')
where product_type = 'component'
  and public.normalize_supplier_catalog_text(category || ' ' || name || ' ' || coalesce(technical_description, '')) ~ '(motherboard|mainboard|mobo|placa|(^| )mb( |$))';

update public.supplier_products
set component_category = 'case',
    search_document = public.normalize_supplier_catalog_text(search_document || ' case gabinete chasis'),
    search_terms = string_to_array(public.normalize_supplier_catalog_text(search_document || ' case gabinete chasis'), ' ')
where product_type = 'component'
  and public.normalize_supplier_catalog_text(category) = 'c';
