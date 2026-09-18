-- Clean unused variable warning from get_public_service_queue

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
