-- Link budget lines to inventory products and apply approved parts to an OS.
-- A budget is a quote: creating or editing it never changes stock. Stock is
-- reserved only through apply_budget_parts_to_service_order after approval.

alter table public.budget_items
  add column item_type text not null default 'other',
  add column product_id uuid;

alter table public.budget_items
  add constraint budget_items_item_type_check
  check (item_type in ('part', 'labor', 'other'));

alter table public.budget_items
  add constraint budget_items_product_id_fkey
  foreign key (product_id) references public.products(id) on delete restrict;

alter table public.budget_items
  add constraint budget_items_product_type_check
  check ((item_type = 'part') = (product_id is not null));

create index idx_budget_items_product_id on public.budget_items(product_id);
create index idx_budget_items_type on public.budget_items(budget_id, item_type);

alter table public.service_order_parts
  add column budget_id uuid references public.budgets(id) on delete set null;

create index idx_service_order_parts_budget_id on public.service_order_parts(budget_id);

create or replace function public.validate_budget_item()
returns trigger
language plpgsql
as $$
declare
  v_budget public.budgets;
  v_product_business_id uuid;
begin
  select * into v_budget from public.budgets where id = new.budget_id;
  if v_budget.id is null or v_budget.business_id <> new.business_id then
    raise exception 'budget_id does not belong to this business';
  end if;
  if v_budget.status <> 'draft' then
    raise exception 'Cannot modify items of a budget that is not in draft status';
  end if;

  if new.item_type not in ('part', 'labor', 'other') then
    raise exception 'Invalid budget item type';
  end if;
  if new.item_type = 'part' and new.product_id is null then
    raise exception 'Inventory product is required for a part item';
  end if;
  if new.item_type <> 'part' and new.product_id is not null then
    raise exception 'Only part items can reference an inventory product';
  end if;
  if new.item_type = 'part' and new.quantity <> trunc(new.quantity) then
    raise exception 'Part quantities must be whole units';
  end if;

  if new.product_id is not null then
    select business_id into v_product_business_id
      from public.products where id = new.product_id;
    if v_product_business_id is null or v_product_business_id <> new.business_id then
      raise exception 'product_id does not belong to this business';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.apply_budget_parts_to_service_order(p_budget_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid := public.auth_business_id();
  v_budget public.budgets;
  v_order public.service_orders;
  v_product public.products;
  v_part public.service_order_parts;
  v_item record;
  v_desired int;
  v_delta int;
  v_unit_price numeric(10,2);
  v_products_applied int := 0;
  v_units_reserved int := 0;
  v_units_returned int := 0;
begin
  if v_business_id is null then
    raise exception 'No business associated with the current user';
  end if;

  select * into v_budget
    from public.budgets
   where id = p_budget_id
     and business_id = v_business_id
   for update;
  if v_budget.id is null then
    raise exception 'Budget not found or not accessible';
  end if;
  if v_budget.status <> 'approved' then
    raise exception 'Only approved budgets can apply inventory parts';
  end if;

  select * into v_order
    from public.service_orders
   where id = v_budget.service_order_id
     and business_id = v_business_id
   for update;
  if v_order.id is null then
    raise exception 'Service order not found or not accessible';
  end if;
  if v_order.status in ('delivered', 'cancelled') then
    raise exception 'Cannot apply parts to a closed service order';
  end if;

  if not exists (
    select 1 from public.budget_items
     where budget_id = v_budget.id and item_type = 'part'
  ) then
    raise exception 'Approved budget has no inventory-linked parts';
  end if;
  if exists (
    select 1 from public.budget_items
     where budget_id = v_budget.id
       and item_type = 'part'
       and (product_id is null or quantity <> trunc(quantity))
  ) then
    raise exception 'Budget contains an invalid part quantity or product';
  end if;

  -- Preflight every product in deterministic order. If one product is short,
  -- no stock or OS part is changed by this transaction.
  for v_item in
    select bi.product_id, sum(bi.quantity)::int as desired_quantity
      from public.budget_items bi
     where bi.budget_id = v_budget.id and bi.item_type = 'part'
     group by bi.product_id
     order by bi.product_id
  loop
    select * into v_product
      from public.products
     where id = v_item.product_id
       and business_id = v_business_id
     for update;
    if v_product.id is null then
      raise exception 'Inventory product not found or not accessible';
    end if;

    select * into v_part
      from public.service_order_parts
     where service_order_id = v_order.id
       and product_id = v_item.product_id
       and business_id = v_business_id
     for update;

    v_delta := v_item.desired_quantity - coalesce(v_part.quantity, 0);
    if v_delta > 0 and v_product.current_stock < v_delta then
      raise exception 'Stock insuficiente para %: disponible %, adicional requerido %',
        v_product.name, v_product.current_stock, v_delta;
    end if;
  end loop;

  -- Apply the already validated deltas and freeze the budget price in the OS.
  for v_item in
    select bi.product_id,
           sum(bi.quantity)::int as desired_quantity,
           round(sum(bi.quantity * bi.unit_price) / sum(bi.quantity), 2)::numeric(10,2) as unit_price
      from public.budget_items bi
     where bi.budget_id = v_budget.id and bi.item_type = 'part'
     group by bi.product_id
     order by bi.product_id
  loop
    select * into v_product
      from public.products
     where id = v_item.product_id
       and business_id = v_business_id
     for update;

    select * into v_part
      from public.service_order_parts
     where service_order_id = v_order.id
       and product_id = v_item.product_id
       and business_id = v_business_id
     for update;

    v_desired := v_item.desired_quantity;
    v_delta := v_desired - coalesce(v_part.quantity, 0);
    v_unit_price := v_item.unit_price;

    if v_delta > 0 then
      update public.products
         set current_stock = current_stock - v_delta
       where id = v_product.id;
      insert into public.inventory_movements (
        business_id, product_id, movement_type, quantity, previous_stock, new_stock,
        reason, service_order_id, performed_by, notes
      ) values (
        v_business_id, v_product.id, 'out', -v_delta, v_product.current_stock,
        v_product.current_stock - v_delta, 'service_order', v_order.id, auth.uid(),
        'Aplicado desde presupuesto #' || v_budget.folio
      );
      v_units_reserved := v_units_reserved + v_delta;
    elsif v_delta < 0 then
      update public.products
         set current_stock = current_stock - v_delta
       where id = v_product.id;
      insert into public.inventory_movements (
        business_id, product_id, movement_type, quantity, previous_stock, new_stock,
        reason, service_order_id, performed_by, notes
      ) values (
        v_business_id, v_product.id, 'in', -v_delta, v_product.current_stock,
        v_product.current_stock - v_delta, 'service_return', v_order.id, auth.uid(),
        'Ajuste por sincronización del presupuesto #' || v_budget.folio
      );
      v_units_returned := v_units_returned + abs(v_delta);
    end if;

    if v_part.id is null then
      insert into public.service_order_parts (
        business_id, service_order_id, product_id, quantity, unit_price, unit_cost, notes, budget_id
      ) values (
        v_business_id, v_order.id, v_product.id, v_desired, v_unit_price, v_product.cost_price,
        'Aplicado desde presupuesto #' || v_budget.folio, v_budget.id
      );
    else
      update public.service_order_parts
         set quantity = v_desired,
             unit_price = v_unit_price,
             unit_cost = v_product.cost_price,
             budget_id = v_budget.id,
             updated_at = now()
       where id = v_part.id;
    end if;

    v_products_applied := v_products_applied + 1;
  end loop;

  return jsonb_build_object(
    'budget_id', v_budget.id,
    'service_order_id', v_order.id,
    'products_applied', v_products_applied,
    'units_reserved', v_units_reserved,
    'units_returned', v_units_returned
  );
end;
$$;

grant execute on function public.apply_budget_parts_to_service_order(uuid) to authenticated;

