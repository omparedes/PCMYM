-- Test suite for smart payments notes and financial entries description
begin;

do $$
declare
  v_has_col boolean;
  v_col_type text;
  v_biz_id uuid;
  v_order_id uuid;
  v_entry_desc text;
begin
  -- 1. Check notes column exists on payments
  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'payments' and column_name = 'notes'
  ) into v_has_col;

  if not v_has_col then
    raise exception 'Column notes does not exist on table public.payments';
  end if;

  -- 2. Check column type
  select data_type into v_col_type
    from information_schema.columns
   where table_schema = 'public' and table_name = 'payments' and column_name = 'notes';

  if v_col_type <> 'text' then
    raise exception 'Column notes is not text, got: %', v_col_type;
  end if;

  -- 3. Check trigger function exists
  if not exists (
    select 1 from pg_proc where proname = 'log_payment_to_financial_entries'
  ) then
    raise exception 'Function log_payment_to_financial_entries does not exist';
  end if;

  -- 4. Test insert payment with notes and verify financial_entries description
  select id into v_biz_id from public.businesses limit 1;
  select id into v_order_id from public.service_orders where business_id = v_biz_id limit 1;

  if v_order_id is not null then
    insert into public.payments (business_id, service_order_id, amount, payment_method, notes)
    values (v_biz_id, v_order_id, 50.00, 'cash', 'Adaptador Bluetooth USB + Abono');

    select description into v_entry_desc
      from public.financial_entries
     where business_id = v_biz_id
     order by created_at desc
     limit 1;

    if v_entry_desc not like '%Adaptador Bluetooth USB + Abono%' then
      raise exception 'financial_entries description does not contain payment notes: %', v_entry_desc;
    end if;

    -- 5. Test insert payment without notes
    insert into public.payments (business_id, service_order_id, amount, payment_method, notes)
    values (v_biz_id, v_order_id, 25.00, 'transfer', null);

    select description into v_entry_desc
      from public.financial_entries
     where business_id = v_biz_id
     order by created_at desc
     limit 1;

    if v_entry_desc like '%—%' then
      raise exception 'financial_entries description should not contain delimiter when notes is null: %', v_entry_desc;
    end if;
  end if;

  raise notice 'ALL SMART PAYMENTS TESTS PASSED SUCCESSFULLY!';
end;
$$;

rollback;
