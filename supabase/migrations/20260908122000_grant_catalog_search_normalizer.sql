-- The search RPC runs as the authenticated invoker and normalizes its query
-- through this immutable helper, so the helper must be executable by tenants.
grant execute on function public.normalize_supplier_catalog_text(text) to authenticated;
