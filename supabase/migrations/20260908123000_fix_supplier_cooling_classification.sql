-- Reclassify cooling products that were caught by the generic CPU keyword.
-- Product names beginning with a processor family remain processors even when
-- their marketing text mentions an included cooler.

update public.supplier_products
set component_category = 'cooling',
    search_document = public.normalize_supplier_catalog_text(search_document || ' cooling refrigeracion cooler disipador ventilador fan'),
    search_terms = string_to_array(public.normalize_supplier_catalog_text(search_document || ' cooling refrigeracion cooler disipador ventilador fan'), ' ')
where product_type = 'component'
  and (
    public.normalize_supplier_catalog_text(name) ~ '^(cooler|cooling|refriger|disipador|ventilador|fan|masterliquid|liquid|liquido|aio)'
    or public.normalize_supplier_catalog_text(category) ~ '(cooler|cooling|refriger|disipador|ventilador|fan|masterliquid|liquid|liquido|aio)'
  )
  and public.normalize_supplier_catalog_text(name) !~ '^(amd|intel|proc|procesador|processor|ryzen|core i|cpu)';
