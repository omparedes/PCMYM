-- Comprehensive SQL test for Public Service Queue & acceptance criteria
-- All operations are performed within a transaction and rolled back.

begin;

-- Test helper functions directly
do $$
declare
  v_mins int;
begin
  -- 1. Reparación pendiente -> 20 min; diagnóstico -> 20 min; externo -> 0 min
  v_mins := public.calculate_service_order_target_minutes('laptop', array['repair'], false, 'pending', 'in_store', 0);
  if v_mins is distinct from 20 then
    raise exception 'Test 1 Failed: Pure repair pending should be 20 min, got %', v_mins;
  end if;

  v_mins := public.calculate_service_order_target_minutes('laptop', array['repair'], false, 'diagnosing', 'in_store', 0);
  if v_mins is distinct from 20 then
    raise exception 'Test 1 Failed: Diagnosing should be 20 min, got %', v_mins;
  end if;

  v_mins := public.calculate_service_order_target_minutes('laptop', array['repair'], false, 'repairing', 'external_workshop', 0);
  if v_mins is distinct from 0 then
    raise exception 'Test 1 Failed: External workshop should be 0 local min, got %', v_mins;
  end if;

  -- 3. Formateo -> 60; con respaldo -> 120
  v_mins := public.calculate_service_order_target_minutes('pc', array['formatting'], false, 'repairing', 'in_store', 0);
  if v_mins is distinct from 60 then
    raise exception 'Test 3 Failed: Formatting should be 60 min, got %', v_mins;
  end if;

  v_mins := public.calculate_service_order_target_minutes('pc', array['formatting'], true, 'repairing', 'in_store', 0);
  if v_mins is distinct from 120 then
    raise exception 'Test 3 Failed: Formatting with backup should be 120 min, got %', v_mins;
  end if;

  -- 4. Laptop mantenimiento -> 60; PC -> 120; desconocido/garantía sola -> null (por confirmar)
  v_mins := public.calculate_service_order_target_minutes('Laptop HP', array['maintenance'], false, 'repairing', 'in_store', 0);
  if v_mins is distinct from 60 then
    raise exception 'Test 4 Failed: Maintenance laptop should be 60 min, got %', v_mins;
  end if;

  v_mins := public.calculate_service_order_target_minutes('Computadora Escritorio', array['maintenance'], false, 'repairing', 'in_store', 0);
  if v_mins is distinct from 120 then
    raise exception 'Test 4 Failed: Maintenance PC should be 120 min, got %', v_mins;
  end if;

  v_mins := public.calculate_service_order_target_minutes('Impresora 3D', array['maintenance'], false, 'repairing', 'in_store', 0);
  if v_mins is not null then
    raise exception 'Test 4 Failed: Maintenance on unknown equipment should be null, got %', v_mins;
  end if;

  v_mins := public.calculate_service_order_target_minutes('Laptop HP', array['warranty'], false, 'repairing', 'in_store', 0);
  if v_mins is not null then
    raise exception 'Test 4 Failed: Warranty alone should be null, got %', v_mins;
  end if;

  -- 6. Combinación formateo con respaldo + mantenimiento laptop -> 180 min locales
  v_mins := public.calculate_service_order_target_minutes('Laptop Lenovo', array['formatting', 'maintenance'], true, 'repairing', 'in_store', 0);
  if v_mins is distinct from 180 then
    raise exception 'Test 6 Failed: Formatting + backup + maintenance laptop should be 180 min, got %', v_mins;
  end if;
end $$;

-- Synthetic multi-tenant fixtures
insert into public.businesses (id, name, slug, active, public_queue_enabled, public_queue_token)
values
  ('e1000000-0000-4000-8000-000000000001', 'Taller Sintético Alpha', 'taller-alpha-test', true, true, 'e1000000-0000-4000-8000-0000000000aa'),
  ('e1000000-0000-4000-8000-000000000002', 'Taller Sintético Beta', 'taller-beta-test', true, false, 'e1000000-0000-4000-8000-0000000000bb');

insert into auth.users (id, email)
values
  ('e1000000-0000-4000-8000-000000000003', 'alpha-tester@example.com'),
  ('e1000000-0000-4000-8000-000000000004', 'beta-tester@example.com');

insert into public.profiles (id, business_id, name, role)
values
  ('e1000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000001', 'Tester Alpha', 'owner'),
  ('e1000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000002', 'Tester Beta', 'owner');

insert into public.customers (id, business_id, name)
values
  ('e1000000-0000-4000-8000-000000000005', 'e1000000-0000-4000-8000-000000000001', 'Cliente Alpha'),
  ('e1000000-0000-4000-8000-000000000006', 'e1000000-0000-4000-8000-000000000002', 'Cliente Beta');

-- Test as authenticated Alpha user
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000003', true);

do $$
declare
  v_order_id uuid;
  v_order public.service_orders;
begin
  -- Direct pending -> repairing transition check
  insert into public.service_orders (
    id, business_id, customer_id, equipment_type, work_types, status, backup_requested
  ) values (
    'e1000000-0000-4000-8000-000000000010',
    'e1000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000005',
    'laptop',
    array['maintenance']::text[],
    'pending',
    false
  ) returning * into v_order;

  -- Test transition pending -> repairing directly (allowed by our update)
  v_order := public.change_service_order_status(v_order.id, 'repairing', 'Iniciando mantenimiento directo');
  if v_order.status <> 'repairing' or v_order.current_stage <> 'repairing' or v_order.stage_started_at is null then
    raise exception 'Direct pending -> repairing transition failed';
  end if;

  -- Test 5: Pause on waiting_parts and resume
  -- Simulate 15 min spent:
  update public.service_orders
     set stage_started_at = now() - interval '15 minutes'
   where id = v_order.id;

  v_order := public.change_service_order_status(v_order.id, 'waiting_parts', 'Pausado por repuesto');
  if v_order.accumulated_active_seconds < 890 or v_order.accumulated_active_seconds > 910 then
    raise exception 'Test 5 Failed: Accumulated seconds after 15 min pause should be ~900, got %', v_order.accumulated_active_seconds;
  end if;

  if v_order.stage_started_at is not null then
    raise exception 'Test 5 Failed: stage_started_at must be null while paused';
  end if;

  -- Resume repairing
  v_order := public.change_service_order_status(v_order.id, 'repairing', 'Reanudando');
  if v_order.accumulated_active_seconds < 890 or v_order.accumulated_active_seconds > 910 then
    raise exception 'Test 5 Failed: Accumulated seconds should be preserved on resume, got %', v_order.accumulated_active_seconds;
  end if;
  if v_order.stage_started_at is null then
    raise exception 'Test 5 Failed: stage_started_at must be non-null on resume';
  end if;

  -- Location transitions and adjustments
  v_order := public.transition_service_location(v_order.id, 'external_workshop', 'Derivado');
  if v_order.service_location <> 'external_workshop' then
    raise exception 'Location transition failed';
  end if;

  v_order := public.adjust_service_order_time(v_order.id, 30, 'Tornillos oxidados');
  if v_order.time_adjustment_minutes <> 30 then
    raise exception 'Time adjustment failed';
  end if;
end $$;

-- Test 9 & 10: Public queue view as anonymous role
set local role anon;
do $$
declare
  v_res jsonb;
  v_cnt int;
begin
  -- Token A (enabled): returns queue
  v_res := public.get_public_service_queue('e1000000-0000-4000-8000-0000000000aa');
  if (v_res->>'is_enabled')::boolean is not true then
    raise exception 'Test 9 Failed: Queue A should be enabled';
  end if;
  if v_res->>'business_name' is distinct from 'Taller Sintético Alpha' then
    raise exception 'Test 9 Failed: Business name mismatch';
  end if;

  -- Verify strict privacy (no sensitive keys present)
  if v_res ? 'customer_name' or v_res ? 'folio' or v_res ? 'phone' or v_res ? 'notes' then
    raise exception 'Test 9 Failed: Sensitive data leaked in queue root';
  end if;

  -- Token B (disabled): returns is_enabled: false
  v_res := public.get_public_service_queue('e1000000-0000-4000-8000-0000000000bb');
  if (v_res->>'is_enabled')::boolean is not false then
    raise exception 'Test 10 Failed: Queue B should be disabled';
  end if;

  -- Anon sees 0 rows when attempting direct query due to tenant RLS (auth_business_id() is null)
  select count(*) into v_cnt from public.service_orders;
  if v_cnt <> 0 then
    raise exception 'Anon should see 0 rows in service_orders via RLS, saw: %', v_cnt;
  end if;
end $$;

rollback;
