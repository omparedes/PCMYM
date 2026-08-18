-- Public tracking: expand the customer-facing receipt and financial summary.
-- The tracking token remains the only unauthenticated access path. This
-- function deliberately returns a curated snapshot, never table rows.

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
  v_budget public.budgets;
  v_budget_items jsonb := '[]'::jsonb;
  v_total_paid numeric(10,2) := 0;
  v_history jsonb;
begin
  select * into v_order
    from public.service_orders
    where tracking_token = p_token;

  if v_order.id is null then
    return null;
  end if;

  select name into v_business_name from public.businesses where id = v_order.business_id;
  select name into v_customer_name from public.customers where id = v_order.customer_id;

  -- A budget becomes public only after it has left draft. The latest one is
  -- authoritative because sent/approved/rejected budgets are immutable.
  select * into v_budget
    from public.budgets
    where service_order_id = v_order.id
      and status in ('sent', 'approved', 'rejected')
    order by created_at desc
    limit 1;

  if v_budget.id is not null then
    select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'description', bi.description,
            'quantity', bi.quantity,
            'unit_price', bi.unit_price,
            'line_total', bi.quantity * bi.unit_price
          )
          order by bi.created_at
        ),
        '[]'::jsonb
      )
      into v_budget_items
      from public.budget_items bi
      where bi.budget_id = v_budget.id;

    -- Payments are only meaningful against an approved quote. Expose totals,
    -- never payment method, timestamp, or staff member.
    if v_budget.status = 'approved' then
      select coalesce(sum(p.amount), 0)
        into v_total_paid
        from public.payments p
        where p.service_order_id = v_order.id;
    end if;
  end if;

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
    'serial_number', v_order.serial_number,
    'accessories', v_order.accessories,
    'reported_issue', v_order.reported_issue,
    'initial_diagnosis', v_order.initial_diagnosis,
    'received_at', v_order.received_at,
    'estimated_delivery', v_order.estimated_delivery,
    'business_name', v_business_name,
    'customer_name', v_customer_name,
    'budget', case when v_budget.id is null then null else jsonb_build_object(
      'folio', v_budget.folio,
      'status', v_budget.status,
      'total_amount', v_budget.total_amount,
      'items', v_budget_items,
      'total_paid', case when v_budget.status = 'approved' then v_total_paid else null end,
      'balance_due', case when v_budget.status = 'approved' then greatest(v_budget.total_amount - v_total_paid, 0) else null end
    ) end,
    'history', v_history
  );
end;
$$;
