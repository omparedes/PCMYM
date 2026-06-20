-- Phase 3 Step 1: public, unauthenticated order tracking by token.
-- Schema in English (ADR 0006). Spanish UI labels live only in Angular.
--
-- Design: service_orders gets a `tracking_token` (random uuid) that acts as a
-- bearer capability — whoever holds the link (/seguimiento/:token) can read a
-- hand-picked, public-safe summary of that one order, with no auth.uid() and
-- no business_id of their own. Anon can never SELECT service_orders directly
-- (its RLS policies are still business_id = auth_business_id(), which is null
-- for anon), so the table itself stays fully tenant-isolated; the only public
-- read path is the SECURITY DEFINER function below, which decides exactly
-- which columns leave the database. It deliberately excludes: assigned_to,
-- internal notes/diagnosis, budget line items (cost breakdown/margins), and
-- order_status_history.note/changed_by (internal technician remarks).

alter table public.service_orders
  add column tracking_token uuid not null default gen_random_uuid();

create unique index idx_service_orders_tracking_token on public.service_orders(tracking_token);

-- No new grants needed: tracking_token rides along with the existing
-- select/insert/update grants on service_orders for `authenticated` (the
-- workshop side). Its secrecy as a public capability comes from being an
-- unguessable random value handed out only via this RPC, not from RLS.

create or replace function public.get_public_tracking_info(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.service_orders;
  v_business_name text;
  v_customer_name text;
  v_budget jsonb;
  v_history jsonb;
begin
  select * into v_order from public.service_orders where tracking_token = p_token;
  if v_order.id is null then
    return null;
  end if;

  select name into v_business_name from public.businesses where id = v_order.business_id;
  select name into v_customer_name from public.customers where id = v_order.customer_id;

  -- Only the latest non-draft budget, and only status + total — never the
  -- itemized lines (those are the workshop's internal cost breakdown).
  select jsonb_build_object('folio', b.folio, 'status', b.status, 'total_amount', b.total_amount)
    into v_budget
    from public.budgets b
    where b.service_order_id = v_order.id
      and b.status in ('sent', 'approved', 'rejected')
    order by b.created_at desc
    limit 1;

  select coalesce(
      jsonb_agg(jsonb_build_object('to_status', h.to_status, 'changed_at', h.changed_at) order by h.changed_at),
      '[]'::jsonb
    )
    into v_history
    from public.order_status_history h
    where h.service_order_id = v_order.id;

  return jsonb_build_object(
    'folio', v_order.folio,
    'status', v_order.status,
    'equipment_type', v_order.equipment_type,
    'brand', v_order.brand,
    'model', v_order.model,
    'received_at', v_order.received_at,
    'estimated_delivery', v_order.estimated_delivery,
    'business_name', v_business_name,
    'customer_name', v_customer_name,
    'budget', v_budget,
    'history', v_history
  );
end;
$$;

-- Granted to `anon` on purpose: this is the one function the public tracking
-- page calls without a session. It is safe because it only ever returns the
-- hand-picked fields above for the single order matching p_token.
grant execute on function public.get_public_tracking_info(uuid) to anon, authenticated;
