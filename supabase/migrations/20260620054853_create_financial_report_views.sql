-- Phase 2 Stage 2: SQL views for the financial dashboard.
-- Schema in English (ADR 0006). Spanish UI labels live only in Angular.
--
-- Every view below is created `with (security_invoker = true)` (Postgres 15+):
-- the view executes with the privileges/RLS of the calling role, not its
-- owner. Since every underlying table already has a `business_id =
-- auth_business_id()` RLS policy, each view is automatically scoped to the
-- caller's own tenant with zero extra filtering needed — and it is
-- impossible for a view to leak another tenant's rows even if its SQL body
-- is wrong, because Postgres still enforces the base tables' RLS underneath.
-- Every view still SELECTs business_id explicitly so the shape is consistent
-- and self-describing for any future caller (e.g. a service_role admin tool).

-- ============================================================
-- View: v_income_expense_daily — income vs. expense per day, for the last
-- 90 days. Powers the "ingresos vs gastos" chart.
-- ============================================================
create view public.v_income_expense_daily
with (security_invoker = true)
as
select
  business_id,
  date_trunc('day', created_at)::date as entry_date,
  sum(amount) filter (where entry_type = 'income') as total_income,
  sum(amount) filter (where entry_type = 'expense') as total_expense
from public.financial_entries
where created_at >= now() - interval '90 days'
group by business_id, date_trunc('day', created_at)::date;

-- ============================================================
-- View: v_income_expense_monthly — income vs. expense per month, all-time.
-- ============================================================
create view public.v_income_expense_monthly
with (security_invoker = true)
as
select
  business_id,
  date_trunc('month', created_at)::date as entry_month,
  sum(amount) filter (where entry_type = 'income') as total_income,
  sum(amount) filter (where entry_type = 'expense') as total_expense
from public.financial_entries
group by business_id, date_trunc('month', created_at)::date;

-- ============================================================
-- View: v_top_customers — customers ranked by total revenue (sum of
-- payments across all their service orders).
-- ============================================================
create view public.v_top_customers
with (security_invoker = true)
as
select
  p.business_id,
  c.id as customer_id,
  c.name as customer_name,
  count(distinct so.id) as service_order_count,
  sum(p.amount) as total_revenue
from public.payments p
join public.service_orders so on so.id = p.service_order_id
join public.customers c on c.id = so.customer_id
group by p.business_id, c.id, c.name
order by total_revenue desc;

-- ============================================================
-- View: v_top_equipment_types — most-serviced equipment types (a proxy for
-- "servicios más realizados", since service_orders has no separate service
-- catalog yet — see docs/02-MODELO-DATOS.md).
-- ============================================================
create view public.v_top_equipment_types
with (security_invoker = true)
as
select
  business_id,
  coalesce(equipment_type, 'Sin especificar') as equipment_type,
  count(*) as order_count
from public.service_orders
group by business_id, coalesce(equipment_type, 'Sin especificar')
order by order_count desc;

-- ============================================================
-- View: v_accounts_receivable — outstanding balance per service order, i.e.
-- the latest approved budget's total minus payments received so far.
-- Orders without an approved budget have no defined "amount owed" yet and
-- are excluded; orders with balance_due <= 0 (fully paid) are excluded too.
-- ============================================================
create view public.v_accounts_receivable
with (security_invoker = true)
as
select
  so.business_id,
  so.id as service_order_id,
  so.folio,
  so.status as order_status,
  c.id as customer_id,
  c.name as customer_name,
  b.total_amount as approved_amount,
  coalesce(pay.total_paid, 0) as total_paid,
  b.total_amount - coalesce(pay.total_paid, 0) as balance_due
from public.service_orders so
join public.customers c on c.id = so.customer_id
join lateral (
  select bu.total_amount
  from public.budgets bu
  where bu.service_order_id = so.id and bu.status = 'approved'
  order by bu.created_at desc
  limit 1
) b on true
left join lateral (
  select sum(amount) as total_paid
  from public.payments where service_order_id = so.id
) pay on true
where so.status <> 'cancelled'
  and b.total_amount - coalesce(pay.total_paid, 0) > 0;

-- ============================================================
-- Grants: views inherit no grants automatically; `authenticated` gets
-- read-only access (RLS on the underlying tables does the rest, per the
-- security_invoker note above).
-- ============================================================
grant select on public.v_income_expense_daily to authenticated;
grant select on public.v_income_expense_monthly to authenticated;
grant select on public.v_top_customers to authenticated;
grant select on public.v_top_equipment_types to authenticated;
grant select on public.v_accounts_receivable to authenticated;
