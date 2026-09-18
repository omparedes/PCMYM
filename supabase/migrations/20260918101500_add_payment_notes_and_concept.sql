-- Add notes column to payments table and enrich financial_entries description.
-- Schema in English (ADR 0006).

alter table public.payments
  add column if not exists notes text;

create or replace function public.log_payment_to_financial_entries()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_folio int;
  v_desc text;
begin
  select folio into v_folio from public.service_orders where id = new.service_order_id;
  v_desc := 'Pago de Orden #' || coalesce(v_folio::text, new.service_order_id::text);

  if new.notes is not null and trim(new.notes) <> '' then
    v_desc := v_desc || ' — ' || trim(new.notes);
  end if;

  insert into public.financial_entries (business_id, entry_type, amount, description)
  values (
    new.business_id,
    'income',
    new.amount,
    v_desc
  );

  return new;
end;
$$;
