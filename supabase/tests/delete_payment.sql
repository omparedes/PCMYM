-- Test suite for payment deletion and financial_entries cascade cleanup
begin;

do $$
declare
  v_biz_id uuid;
  v_order_id uuid;
  v_user_id uuid;
  v_payment_id uuid;
  v_entry_count int;
  v_deleted boolean;
begin
  select id into v_biz_id from public.businesses limit 1;
  select id into v_order_id from public.service_orders where business_id = v_biz_id limit 1;
  select id into v_user_id from public.profiles where business_id = v_biz_id limit 1;

  if v_order_id is not null then
    -- 1. Insert test payment
    insert into public.payments (business_id, service_order_id, amount, payment_method, notes)
    values (v_biz_id, v_order_id, 88.50, 'cash', 'Test payment for deletion')
    returning id into v_payment_id;

    -- 2. Verify financial entry was logged with payment_id
    select count(*) into v_entry_count
      from public.financial_entries
     where payment_id = v_payment_id;

    if v_entry_count <> 1 then
      raise exception 'Expected 1 financial entry linked to payment %, got %', v_payment_id, v_entry_count;
    end if;

    -- 3. Simulate authenticated user session of the tenant
    if v_user_id is not null then
      perform set_config('request.jwt.claim.sub', v_user_id::text, true);
      perform set_config('request.jwt.claim.role', 'authenticated', true);
    end if;

    -- 4. Invoke delete_payment RPC
    select public.delete_payment(v_payment_id) into v_deleted;
    if not v_deleted then
      raise exception 'delete_payment returned false';
    end if;

    -- 5. Verify payment row is deleted
    if exists (select 1 from public.payments where id = v_payment_id) then
      raise exception 'Payment was not deleted from public.payments';
    end if;

    -- 6. Verify financial entry is deleted
    if exists (select 1 from public.financial_entries where payment_id = v_payment_id) then
      raise exception 'Linked financial entry was not cleaned up';
    end if;
  end if;

  raise notice 'PAYMENT DELETION TESTS PASSED SUCCESSFULLY!';
end;
$$;

rollback;
