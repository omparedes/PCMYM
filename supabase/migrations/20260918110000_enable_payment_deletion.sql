-- Enable payment deletion with cascade cleanup of financial_entries.
-- Schema in English (ADR 0006).

-- 1. Add payment_id column to financial_entries with cascade delete
alter table public.financial_entries
  add column if not exists payment_id uuid references public.payments(id) on delete cascade;

create index if not exists idx_financial_entries_payment_id
  on public.financial_entries(payment_id);

-- 2. Update trigger to populate payment_id on insert
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

  insert into public.financial_entries (business_id, entry_type, amount, description, payment_id)
  values (
    new.business_id,
    'income',
    new.amount,
    v_desc,
    new.id
  );

  return new;
end;
$$;

-- 3. Grants and RLS policy for payments deletion
grant delete on public.payments to authenticated;

drop policy if exists "payments_delete" on public.payments;
create policy "payments_delete" on public.payments
  for delete to authenticated
  using (business_id = public.auth_business_id());

-- 4. Atomic RPC to delete payment and guarantee financial entries cleanup
create or replace function public.delete_payment(p_payment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_biz_id uuid := public.auth_business_id();
  v_payment public.payments;
begin
  if v_biz_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_payment
    from public.payments
   where id = p_payment_id
     and business_id = v_biz_id;

  if v_payment.id is null then
    raise exception 'Payment not found or access denied';
  end if;

  -- Clean up any unlinked legacy financial entries from before this migration
  delete from public.financial_entries
   where (payment_id = p_payment_id)
      or (payment_id is null
          and business_id = v_biz_id
          and entry_type = 'income'
          and amount = v_payment.amount
          and created_at between v_payment.created_at - interval '5 seconds' and v_payment.created_at + interval '5 seconds');

  delete from public.payments where id = p_payment_id;

  return true;
end;
$$;

grant execute on function public.delete_payment(uuid) to authenticated;
