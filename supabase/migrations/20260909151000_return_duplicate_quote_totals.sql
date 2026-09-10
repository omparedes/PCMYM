-- Return the fully recalculated copy, including totals populated by item triggers.
create or replace function public.duplicate_sales_quote(p_quote_id uuid)
returns public.sales_quotes
language plpgsql
security invoker
set search_path = public
as $$
declare
  source_quote public.sales_quotes;
  copied_quote public.sales_quotes;
  tenant_id uuid := public.auth_business_id();
begin
  select * into source_quote from public.sales_quotes
   where id = p_quote_id and business_id = tenant_id;
  if source_quote.id is null then raise exception 'Sales quote not found'; end if;

  insert into public.sales_quotes (
    business_id, folio, status, customer_id, customer_name, customer_phone,
    currency, exchange_rate, margin_rate, tax_rate, valid_until, notes, created_by
  ) values (
    tenant_id, public.next_sales_quote_folio(), 'draft', source_quote.customer_id,
    source_quote.customer_name, source_quote.customer_phone, source_quote.currency,
    source_quote.exchange_rate, source_quote.margin_rate, source_quote.tax_rate,
    source_quote.valid_until, source_quote.notes, auth.uid()
  ) returning * into copied_quote;

  insert into public.sales_quote_items (
    business_id, sales_quote_id, supplier_product_id, description, quantity,
    unit_cost_usd, unit_cost_pen, unit_price_pen, compatibility_status,
    compatibility_notes, build_key, specification_snapshot
  )
  select tenant_id, copied_quote.id, supplier_product_id, description, quantity,
    unit_cost_usd, unit_cost_pen, unit_price_pen, compatibility_status,
    compatibility_notes, build_key, specification_snapshot
    from public.sales_quote_items
   where sales_quote_id = source_quote.id and business_id = tenant_id;

  select * into copied_quote from public.sales_quotes where id = copied_quote.id;
  return copied_quote;
end;
$$;
