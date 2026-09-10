-- Atomic operations for editable drafts and safe copies of frozen quotations.
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
  select * into source_quote
    from public.sales_quotes
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

  return copied_quote;
end;
$$;

create or replace function public.update_sales_quote_draft(
  p_quote_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_exchange_rate numeric,
  p_margin_rate numeric,
  p_tax_rate numeric,
  p_valid_until date,
  p_notes text,
  p_items jsonb
)
returns public.sales_quotes
language plpgsql
security invoker
set search_path = public
as $$
declare
  quote_row public.sales_quotes;
  tenant_id uuid := public.auth_business_id();
begin
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Quote items must be an array'; end if;
  select * into quote_row from public.sales_quotes where id = p_quote_id and business_id = tenant_id for update;
  if quote_row.id is null then raise exception 'Sales quote not found'; end if;
  if quote_row.status <> 'draft' then raise exception 'Only draft sales quotes can be edited'; end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'A sales quote needs at least one item'; end if;

  update public.sales_quotes set
    customer_name = nullif(trim(p_customer_name), ''),
    customer_phone = nullif(trim(p_customer_phone), ''),
    exchange_rate = p_exchange_rate,
    margin_rate = p_margin_rate,
    tax_rate = p_tax_rate,
    valid_until = p_valid_until,
    notes = nullif(trim(p_notes), '')
  where id = quote_row.id;

  delete from public.sales_quote_items where sales_quote_id = quote_row.id and business_id = tenant_id;

  insert into public.sales_quote_items (
    business_id, sales_quote_id, supplier_product_id, description, quantity,
    unit_cost_usd, unit_cost_pen, unit_price_pen, compatibility_status,
    compatibility_notes, build_key, specification_snapshot
  )
  select tenant_id, quote_row.id,
    nullif(item->>'supplier_product_id', '')::uuid,
    item->>'description', (item->>'quantity')::numeric,
    nullif(item->>'unit_cost_usd', '')::numeric, (item->>'unit_cost_pen')::numeric,
    (item->>'unit_price_pen')::numeric, coalesce(item->>'compatibility_status', 'unchecked'),
    item->>'compatibility_notes', item->>'build_key', coalesce(item->'specification_snapshot', '{}'::jsonb)
  from jsonb_array_elements(p_items) item;

  select * into quote_row from public.sales_quotes where id = quote_row.id;
  return quote_row;
end;
$$;

revoke all on function public.duplicate_sales_quote(uuid) from public, anon;
revoke all on function public.update_sales_quote_draft(uuid, text, text, numeric, numeric, numeric, date, text, jsonb) from public, anon;
grant execute on function public.duplicate_sales_quote(uuid) to authenticated;
grant execute on function public.update_sales_quote_draft(uuid, text, text, numeric, numeric, numeric, date, text, jsonb) to authenticated;
