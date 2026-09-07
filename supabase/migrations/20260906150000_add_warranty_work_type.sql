-- Add warranty service orders to the operational work type catalogue.
-- Existing rows remain unchanged; the check is replaced in place so prior
-- formatting, repair and parts-replacement values keep working.

do $$
declare
  v_constraint text;
begin
  select con.conname
    into v_constraint
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
   where nsp.nspname = 'public'
     and rel.relname = 'service_orders'
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) like '%work_types%';

  if v_constraint is not null then
    execute format('alter table public.service_orders drop constraint %I', v_constraint);
  end if;
end;
$$;

alter table public.service_orders
  add constraint service_orders_work_types_check
  check (work_types <@ array['formatting', 'repair', 'parts_replacement', 'warranty']::text[]);

