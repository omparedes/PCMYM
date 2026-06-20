-- Fix: validate_budget_item_delete() blocked legitimate cascade deletes.
-- When a parent row higher up the chain is removed (business -> service_orders
-- -> budgets -> budget_items, all ON DELETE CASCADE), Postgres deletes the
-- budgets row first and only then cascades into budget_items; by the time
-- this trigger ran, `select status from budgets where id = old.budget_id`
-- already returned no row, so `v_status` was always null — and `null is
-- distinct from 'draft'` is true, so every cascaded delete was rejected,
-- even on service_role. The freeze-after-sent rule only makes sense while
-- the parent budget still exists; if it's gone, let the cascade proceed.
create or replace function public.validate_budget_item_delete()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status from public.budgets where id = old.budget_id;
  if v_status is not null and v_status <> 'draft' then
    raise exception 'Cannot modify items of a budget that is not in draft status';
  end if;
  return old;
end;
$$;
