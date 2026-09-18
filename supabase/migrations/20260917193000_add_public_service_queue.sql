-- Migration: Add public service queue, maintenance work type, location tracking, and stage timers.
-- Schema in English (ADR 0006). Spanish UI labels live only in Angular.

-- 1. Extend businesses table with public queue token and switch
alter table public.businesses
  add column if not exists public_queue_enabled boolean not null default false,
  add column if not exists public_queue_token uuid not null default gen_random_uuid();

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'businesses_public_queue_token_key'
  ) then
    alter table public.businesses add constraint businesses_public_queue_token_key unique (public_queue_token);
  end if;
end;
$$;

-- 2. Update service_orders.work_types constraint to include 'maintenance'
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
  check (work_types <@ array['formatting', 'repair', 'parts_replacement', 'warranty', 'maintenance']::text[]);

-- 3. Add columns to service_orders for backup, location and time tracking
alter table public.service_orders
  add column if not exists backup_requested boolean not null default false,
  add column if not exists service_location text not null default 'in_store'
    check (service_location in ('in_store', 'external_workshop')),
  add column if not exists time_adjustment_minutes int not null default 0
    check (time_adjustment_minutes between -240 and 480),
  add column if not exists current_stage text
    check (current_stage is null or current_stage in ('diagnosing', 'repairing')),
  add column if not exists stage_started_at timestamptz,
  add column if not exists accumulated_active_seconds int not null default 0
    check (accumulated_active_seconds >= 0);

alter table public.service_orders
  drop constraint if exists service_orders_backup_requested_check;

alter table public.service_orders
  add constraint service_orders_backup_requested_check
  check (not backup_requested or 'formatting' = any(work_types));

-- Backfill initial stages for existing active orders using their last status transition
update public.service_orders so
   set current_stage = so.status,
       stage_started_at = (
         select h.changed_at
           from public.order_status_history h
          where h.service_order_id = so.id
            and h.to_status = so.status
          order by h.changed_at desc
          limit 1
       )
 where so.status in ('diagnosing', 'repairing')
   and so.current_stage is null;

-- 4. Update status transition rules to allow pending -> repairing
create or replace function public.is_valid_service_order_transition(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select case p_from
    when 'pending' then p_to in ('diagnosing', 'repairing', 'cancelled')
    when 'diagnosing' then p_to in ('repairing', 'waiting_parts', 'cancelled')
    when 'repairing' then p_to in ('waiting_parts', 'ready', 'cancelled')
    when 'waiting_parts' then p_to in ('repairing', 'ready', 'cancelled')
    when 'ready' then p_to in ('delivered', 'cancelled')
    else false
  end;
$$;

-- 5. Audit table for service location and time adjustments
create table if not exists public.service_order_location_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  event_type text not null check (
    event_type in ('location_changed', 'time_adjusted', 'status_timer_updated')
  ),
  from_location text,
  to_location text,
  time_adjustment_delta int default 0,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_service_order_location_history_order
  on public.service_order_location_history(service_order_id, created_at desc);
create index if not exists idx_service_order_location_history_business
  on public.service_order_location_history(business_id);

alter table public.service_order_location_history enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where tablename = 'service_order_location_history'
       and policyname = 'service_order_location_history_tenant_isolation'
  ) then
    create policy service_order_location_history_tenant_isolation on public.service_order_location_history
      for all using (business_id = public.auth_business_id());
  end if;
end;
$$;

grant select on public.service_order_location_history to authenticated;

-- 6. Helper: normalize equipment type
create or replace function public.normalize_equipment_type(p_raw text)
returns text
language plpgsql
immutable
as $$
declare
  v_clean text;
begin
  if p_raw is null then
    return 'other';
  end if;
  v_clean := lower(trim(p_raw));
  if v_clean = '' then
    return 'other';
  end if;

  if v_clean ~* '(laptop|notebook|portatil|portátil|macbook)' then
    return 'laptop';
  elsif v_clean ~* '(pc|desktop|escritorio|computadora|torre|all in one|aio|ordenador)' then
    return 'pc';
  else
    return 'other';
  end if;
end;
$$;

-- 7. Helper: calculate target estimation in minutes for an order
create or replace function public.calculate_service_order_target_minutes(
  p_equipment_type text,
  p_work_types text[],
  p_backup_requested boolean,
  p_status text,
  p_service_location text,
  p_time_adjustment_minutes int default 0
)
returns int
language plpgsql
immutable
as $$
declare
  v_norm_eq text;
  v_minutes int := 0;
  v_has_local_work boolean := false;
  v_unknown_local_duration boolean := false;
begin
  v_norm_eq := public.normalize_equipment_type(p_equipment_type);

  -- Diagnosing stage is always 20 minutes (+ adjustment)
  if p_status = 'diagnosing' then
    return greatest(1, 20 + coalesce(p_time_adjustment_minutes, 0));
  end if;

  -- External workshop, paused, ready or finished orders do not consume local shop time
  if p_status in ('waiting_parts', 'ready', 'delivered', 'cancelled') or p_service_location = 'external_workshop' then
    return 0;
  end if;

  -- If work_types is empty or missing: indeterminate
  if p_work_types is null or array_length(p_work_types, 1) is null then
    return null;
  end if;

  -- If status is pending and it's pure repair (no local works): 20 min diagnosis only
  if p_status = 'pending' and ('repair' = any(p_work_types))
     and not ('formatting' = any(p_work_types) or 'maintenance' = any(p_work_types) or 'parts_replacement' = any(p_work_types)) then
    return greatest(1, 20 + coalesce(p_time_adjustment_minutes, 0));
  end if;

  -- Local works calculation:
  if 'formatting' = any(p_work_types) then
    v_has_local_work := true;
    if coalesce(p_backup_requested, false) then
      v_minutes := v_minutes + 120;
    else
      v_minutes := v_minutes + 60;
    end if;
  end if;

  if 'maintenance' = any(p_work_types) then
    v_has_local_work := true;
    if v_norm_eq = 'laptop' then
      v_minutes := v_minutes + 60;
    elsif v_norm_eq = 'pc' then
      v_minutes := v_minutes + 120;
    else
      v_unknown_local_duration := true;
    end if;
  end if;

  if 'parts_replacement' = any(p_work_types) then
    v_has_local_work := true;
    v_minutes := v_minutes + 60;
  end if;

  -- Pending order with both repair and local work adds 20 min for the diagnostic phase
  if p_status = 'pending' and ('repair' = any(p_work_types)) then
    v_minutes := v_minutes + 20;
  end if;

  -- Warranty alone without local work cannot determine duration
  if not v_has_local_work and ('warranty' = any(p_work_types)) then
    return null;
  end if;

  if v_unknown_local_duration then
    return null;
  end if;

  if not v_has_local_work and not ('repair' = any(p_work_types)) then
    return null;
  end if;

  return greatest(1, v_minutes + coalesce(p_time_adjustment_minutes, 0));
end;
$$;

-- 8. Trigger to synchronize time tracking and stages
create or replace function public.sync_service_order_time_tracking()
returns trigger
language plpgsql
as $$
begin
  -- Automatically clean backup_requested if formatting is removed
  if new.backup_requested and not ('formatting' = any(new.work_types)) then
    new.backup_requested := false;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      new.current_stage := null;
      new.stage_started_at := null;
      new.accumulated_active_seconds := 0;
    elsif new.status = 'diagnosing' then
      new.current_stage := 'diagnosing';
      new.stage_started_at := coalesce(new.stage_started_at, now());
      new.accumulated_active_seconds := coalesce(new.accumulated_active_seconds, 0);
    elsif new.status = 'repairing' then
      new.current_stage := 'repairing';
      -- If repair without local work, auto-derive to external
      if ('repair' = any(new.work_types)) and not ('formatting' = any(new.work_types) or 'maintenance' = any(new.work_types) or 'parts_replacement' = any(new.work_types)) then
        new.service_location := 'external_workshop';
      end if;
      if new.service_location = 'in_store' then
        new.stage_started_at := coalesce(new.stage_started_at, now());
      else
        new.stage_started_at := null;
      end if;
      new.accumulated_active_seconds := coalesce(new.accumulated_active_seconds, 0);
    end if;
    return new;
  end if;

  -- tg_op = 'UPDATE'
  if old.status is distinct from new.status then
    if new.status = 'diagnosing' then
      new.current_stage := 'diagnosing';
      new.stage_started_at := now();
      new.accumulated_active_seconds := 0;
    elsif new.status = 'repairing' then
      if old.status = 'waiting_parts' then
        -- Resuming repairing stage: keep accumulated seconds, restart timer if in_store
        new.current_stage := 'repairing';
        if new.service_location = 'in_store' then
          new.stage_started_at := now();
        else
          new.stage_started_at := null;
        end if;
      else
        -- Starting repairing afresh from pending or diagnosing
        new.current_stage := 'repairing';
        new.accumulated_active_seconds := 0;
        if ('repair' = any(new.work_types)) and not ('formatting' = any(new.work_types) or 'maintenance' = any(new.work_types) or 'parts_replacement' = any(new.work_types)) then
          new.service_location := 'external_workshop';
        end if;
        if new.service_location = 'in_store' then
          new.stage_started_at := now();
        else
          new.stage_started_at := null;
        end if;
      end if;
    elsif new.status = 'waiting_parts' then
      -- Pause timer
      if old.stage_started_at is not null then
        new.accumulated_active_seconds := coalesce(old.accumulated_active_seconds, 0) +
          greatest(0, extract(epoch from (now() - old.stage_started_at))::int);
      end if;
      new.stage_started_at := null;
    elsif new.status in ('ready', 'delivered', 'cancelled') then
      new.stage_started_at := null;
      new.current_stage := null;
    end if;
  end if;

  -- Location changes while remaining in repairing
  if old.status = new.status and new.status = 'repairing' and old.service_location is distinct from new.service_location then
    if new.service_location = 'external_workshop' then
      -- Pausing in-store timer
      if old.stage_started_at is not null then
        new.accumulated_active_seconds := coalesce(old.accumulated_active_seconds, 0) +
          greatest(0, extract(epoch from (now() - old.stage_started_at))::int);
      end if;
      new.stage_started_at := null;
    elsif new.service_location = 'in_store' then
      -- Resuming in-store timer
      new.stage_started_at := now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_service_orders_sync_time_tracking on public.service_orders;
create trigger trg_service_orders_sync_time_tracking
  before insert or update on public.service_orders
  for each row execute function public.sync_service_order_time_tracking();

-- 9. Operational RPC: transition location
create or replace function public.transition_service_location(
  p_service_order_id uuid,
  p_target_location text,
  p_notes text default null
)
returns public.service_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.service_orders;
  v_from_location text;
begin
  if p_target_location not in ('in_store', 'external_workshop') then
    raise exception 'Invalid target location: %', p_target_location;
  end if;

  select service_location into v_from_location
    from public.service_orders
   where id = p_service_order_id
     and business_id = public.auth_business_id()
   for update;

  if v_from_location is null then
    raise exception 'Service order not found or not accessible';
  end if;

  if v_from_location = p_target_location then
    select * into v_order from public.service_orders where id = p_service_order_id;
    return v_order;
  end if;

  update public.service_orders
     set service_location = p_target_location
   where id = p_service_order_id
     and business_id = public.auth_business_id()
  returning * into v_order;

  insert into public.service_order_location_history (
    business_id,
    service_order_id,
    event_type,
    from_location,
    to_location,
    notes,
    recorded_by
  ) values (
    v_order.business_id,
    v_order.id,
    'location_changed',
    v_from_location,
    p_target_location,
    p_notes,
    auth.uid()
  );

  return v_order;
end;
$$;

grant execute on function public.transition_service_location(uuid, text, text) to authenticated;

-- 10. Operational RPC: adjust service order time
create or replace function public.adjust_service_order_time(
  p_service_order_id uuid,
  p_minutes_delta int,
  p_reason text default null
)
returns public.service_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.service_orders;
  v_new_adjustment int;
begin
  if p_minutes_delta is null or p_minutes_delta = 0 then
    raise exception 'Minutes delta must be non-zero';
  end if;

  select time_adjustment_minutes into v_new_adjustment
    from public.service_orders
   where id = p_service_order_id
     and business_id = public.auth_business_id()
   for update;

  if v_new_adjustment is null then
    raise exception 'Service order not found or not accessible';
  end if;

  v_new_adjustment := v_new_adjustment + p_minutes_delta;
  if v_new_adjustment < -240 or v_new_adjustment > 480 then
    raise exception 'Total adjustment must be between -240 and 480 minutes';
  end if;

  update public.service_orders
     set time_adjustment_minutes = v_new_adjustment
   where id = p_service_order_id
     and business_id = public.auth_business_id()
  returning * into v_order;

  insert into public.service_order_location_history (
    business_id,
    service_order_id,
    event_type,
    time_adjustment_delta,
    notes,
    recorded_by
  ) values (
    v_order.business_id,
    v_order.id,
    'time_adjusted',
    p_minutes_delta,
    p_reason,
    auth.uid()
  );

  return v_order;
end;
$$;

grant execute on function public.adjust_service_order_time(uuid, int, text) to authenticated;

-- 11. Configuration RPCs for public queue
create or replace function public.set_public_queue_config(
  p_enabled boolean,
  p_rotate_token boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_biz public.businesses;
begin
  if p_rotate_token then
    update public.businesses
       set public_queue_enabled = coalesce(p_enabled, public_queue_enabled),
           public_queue_token = gen_random_uuid(),
           updated_at = now()
     where id = public.auth_business_id()
    returning * into v_biz;
  else
    update public.businesses
       set public_queue_enabled = coalesce(p_enabled, public_queue_enabled),
           updated_at = now()
     where id = public.auth_business_id()
    returning * into v_biz;
  end if;

  if v_biz.id is null then
    raise exception 'Business not found or access denied';
  end if;

  return jsonb_build_object(
    'public_queue_enabled', v_biz.public_queue_enabled,
    'public_queue_token', v_biz.public_queue_token
  );
end;
$$;

grant execute on function public.set_public_queue_config(boolean, boolean) to authenticated;

create or replace function public.get_public_queue_config()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_biz public.businesses;
begin
  select * into v_biz
    from public.businesses
   where id = public.auth_business_id();

  if v_biz.id is null then
    raise exception 'Business not found or access denied';
  end if;

  return jsonb_build_object(
    'public_queue_enabled', v_biz.public_queue_enabled,
    'public_queue_token', v_biz.public_queue_token
  );
end;
$$;

grant execute on function public.get_public_queue_config() to authenticated;

-- 12. Public read-only RPC for customer queue view (Strict privacy: zero PII)
create or replace function public.get_public_service_queue(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business public.businesses;
  v_rec record;
  v_active_items jsonb := '[]'::jsonb;
  v_waiting_items jsonb := '[]'::jsonb;
  v_count_active int := 0;
  v_count_waiting int := 0;
  v_count_external_or_paused int := 0;
  v_has_overdue_or_indeterminate boolean := false;
  v_max_active_remaining int := 0;
  v_sum_waiting_target int := 0;
  v_rel_order int := 0;
  v_target_mins int;
  v_elapsed_seconds int;
  v_elapsed_mins int;
  v_remaining_mins int;
  v_is_overdue boolean;
  v_eq_cat text;
  v_work_desc text;
  v_last_activity timestamptz;
  v_band jsonb := null;
begin
  if p_token is null then
    return jsonb_build_object('is_enabled', false, 'error', 'Token required');
  end if;

  -- 1. Find active business by public token
  select * into v_business
    from public.businesses
   where public_queue_token = p_token
     and active = true
     and public_queue_enabled = true;

  if v_business.id is null then
    return jsonb_build_object(
      'is_enabled', false,
      'error', 'Queue not found or inactive'
    );
  end if;

  -- 2. Determine last_activity_at from real order updates
  select greatest(
           max(so.updated_at),
           (select max(osh.changed_at) from public.order_status_history osh where osh.business_id = v_business.id)
         )
    into v_last_activity
    from public.service_orders so
   where so.business_id = v_business.id;

  -- 3. Iterate active orders in FIFO order (received_at asc, id asc)
  for v_rec in
    select
      so.id,
      so.equipment_type,
      so.work_types,
      so.backup_requested,
      so.status,
      so.service_location,
      so.time_adjustment_minutes,
      so.stage_started_at,
      so.accumulated_active_seconds,
      so.received_at
    from public.service_orders so
   where so.business_id = v_business.id
     and so.status in ('pending', 'diagnosing', 'repairing', 'waiting_parts')
   order by so.received_at asc, so.id asc
  loop
    -- Generic equipment category (Never brand or model)
    v_eq_cat := case public.normalize_equipment_type(v_rec.equipment_type)
      when 'laptop' then 'Laptop'
      when 'pc' then 'PC'
      else 'Equipo'
    end;

    -- Human-friendly summary of work
    v_work_desc := case
      when v_rec.status = 'diagnosing' then 'Diagnóstico'
      when 'formatting' = any(v_rec.work_types) and coalesce(v_rec.backup_requested, false) and 'maintenance' = any(v_rec.work_types) then 'Formateo con respaldo y mantenimiento'
      when 'formatting' = any(v_rec.work_types) and coalesce(v_rec.backup_requested, false) then 'Formateo con respaldo'
      when 'formatting' = any(v_rec.work_types) and 'maintenance' = any(v_rec.work_types) then 'Formateo y mantenimiento'
      when 'formatting' = any(v_rec.work_types) and 'parts_replacement' = any(v_rec.work_types) then 'Formateo y repuesto'
      when 'formatting' = any(v_rec.work_types) then 'Formateo'
      when 'maintenance' = any(v_rec.work_types) and 'parts_replacement' = any(v_rec.work_types) then 'Mantenimiento y repuesto'
      when 'maintenance' = any(v_rec.work_types) then 'Mantenimiento'
      when 'parts_replacement' = any(v_rec.work_types) then 'Cambio de repuesto'
      when 'repair' = any(v_rec.work_types) then 'Reparación'
      when 'warranty' = any(v_rec.work_types) then 'Garantía'
      else 'Servicio técnico'
    end;

    -- External workshop or waiting parts: counted outside local queue
    if v_rec.status = 'waiting_parts' or v_rec.service_location = 'external_workshop' then
      v_count_external_or_paused := v_count_external_or_paused + 1;
      continue;
    end if;

    -- Active items (in attention: diagnosing or in_store repairing)
    if v_rec.status in ('diagnosing', 'repairing') then
      v_count_active := v_count_active + 1;
      v_rel_order := v_rel_order + 1;

      v_target_mins := public.calculate_service_order_target_minutes(
        v_rec.equipment_type,
        v_rec.work_types,
        v_rec.backup_requested,
        v_rec.status,
        v_rec.service_location,
        v_rec.time_adjustment_minutes
      );

      if v_target_mins is null or v_rec.stage_started_at is null then
        v_has_overdue_or_indeterminate := true;
        v_active_items := v_active_items || jsonb_build_object(
          'relative_order', v_rel_order,
          'equipment_category', v_eq_cat,
          'work_summary', v_work_desc,
          'phase', 'in_progress',
          'estimated_remaining_minutes', null,
          'is_overdue', false
        );
      else
        v_elapsed_seconds := coalesce(v_rec.accumulated_active_seconds, 0) +
          greatest(0, extract(epoch from (now() - v_rec.stage_started_at))::int);
        v_elapsed_mins := v_elapsed_seconds / 60;
        v_remaining_mins := v_target_mins - v_elapsed_mins;

        if v_remaining_mins <= 0 then
          v_is_overdue := true;
          v_has_overdue_or_indeterminate := true;
          v_active_items := v_active_items || jsonb_build_object(
            'relative_order', v_rel_order,
            'equipment_category', v_eq_cat,
            'work_summary', v_work_desc,
            'phase', 'in_progress',
            'estimated_remaining_minutes', 0,
            'is_overdue', true
          );
        else
          v_is_overdue := false;
          if v_remaining_mins > v_max_active_remaining then
            v_max_active_remaining := v_remaining_mins;
          end if;
          v_active_items := v_active_items || jsonb_build_object(
            'relative_order', v_rel_order,
            'equipment_category', v_eq_cat,
            'work_summary', v_work_desc,
            'phase', 'in_progress',
            'estimated_remaining_minutes', v_remaining_mins,
            'is_overdue', false
          );
        end if;
      end if;

    -- Waiting items (pending)
    elsif v_rec.status = 'pending' then
      v_count_waiting := v_count_waiting + 1;
      v_rel_order := v_rel_order + 1;

      v_target_mins := public.calculate_service_order_target_minutes(
        v_rec.equipment_type,
        v_rec.work_types,
        v_rec.backup_requested,
        v_rec.status,
        v_rec.service_location,
        v_rec.time_adjustment_minutes
      );

      if v_target_mins is null then
        v_has_overdue_or_indeterminate := true;
        v_waiting_items := v_waiting_items || jsonb_build_object(
          'relative_order', v_rel_order,
          'equipment_category', v_eq_cat,
          'work_summary', v_work_desc,
          'phase', 'waiting',
          'estimated_remaining_minutes', null,
          'is_overdue', false
        );
      else
        v_sum_waiting_target := v_sum_waiting_target + v_target_mins;
        v_waiting_items := v_waiting_items || jsonb_build_object(
          'relative_order', v_rel_order,
          'equipment_category', v_eq_cat,
          'work_summary', v_work_desc,
          'phase', 'waiting',
          'estimated_remaining_minutes', v_target_mins,
          'is_overdue', false
        );
      end if;
    end if;
  end loop;

  -- Wait band heuristic:
  -- From max remaining in active items to (max remaining + sum of waiting)
  if v_count_active = 0 and v_count_waiting = 0 then
    v_band := null;
  elsif v_has_overdue_or_indeterminate then
    v_band := null; -- "Tiempo por confirmar"
  else
    v_band := jsonb_build_object(
      'min_minutes', v_max_active_remaining,
      'max_minutes', v_max_active_remaining + v_sum_waiting_target,
      'label', format('%s–%s min', v_max_active_remaining, v_max_active_remaining + v_sum_waiting_target)
    );
  end if;

  return jsonb_build_object(
    'is_enabled', true,
    'business_name', v_business.name,
    'generated_at', now(),
    'last_activity_at', v_last_activity,
    'counts', jsonb_build_object(
      'in_service', v_count_active,
      'waiting', v_count_waiting,
      'external_or_paused', v_count_external_or_paused,
      'total_active_queue', v_count_active + v_count_waiting
    ),
    'active_items', v_active_items,
    'waiting_items', v_waiting_items,
    'estimated_wait_band', v_band
  );
end;
$$;

grant execute on function public.get_public_service_queue(uuid) to anon, authenticated;
