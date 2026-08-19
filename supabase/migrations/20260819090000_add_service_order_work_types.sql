-- Operational board: a service order can require more than one kind of work.
-- The values are stable workflow categories, not a tenant-specific catalogue.

alter table public.service_orders
  add column work_types text[] not null default '{}'::text[]
  check (work_types <@ array['formatting', 'repair', 'parts_replacement']::text[]);

create index idx_service_orders_work_types
  on public.service_orders using gin (work_types);
