-- Refine delete_payment to support service_role/postgres admin invocation alongside authenticated tenant users
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
    if current_user = 'postgres' or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' then
      select business_id into v_biz_id from public.payments where id = p_payment_id;
    end if;
  end if;

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
