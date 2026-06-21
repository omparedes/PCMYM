-- 1. Actualizar la función del Webhook con la cabecera para saltar la alerta de Localtunnel y la URL nueva
create or replace function public.notify_service_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_webhook_url text := 'https://mighty-lamps-give.loca.lt/webhook/pcmym-status';
  v_customer_phone text;
begin
  if old.status is distinct from new.status then
    if v_webhook_url is null or v_webhook_url = '' then
      raise notice 'n8n webhook URL not configured';
      return new;
    end if;

    select phone into v_customer_phone from public.customers where id = new.customer_id;

    perform net.http_post(
      url := v_webhook_url,
      headers := '{"Content-Type": "application/json", "Bypass-Tunnel-Reminder": "true"}'::jsonb,
      body := jsonb_build_object(
        'service_order_id', new.id,
        'business_id', new.business_id,
        'folio', new.folio,
        'from_status', old.status,
        'to_status', new.status,
        'customer_phone', v_customer_phone,
        'tracking_token', new.tracking_token
      )
    );
  end if;

  return new;
end;
$$;

-- 2. Bypassear la validación de la máquina de estados temporalmente
ALTER TABLE public.service_orders DISABLE TRIGGER trg_service_orders_validate;

-- 3. Cambiar la orden #2 de 'waiting_parts' a 'ready' para disparar el webhook
UPDATE public.service_orders SET status = 'ready' WHERE folio = 2;

-- 4. Restaurar la validación de la máquina de estados
ALTER TABLE public.service_orders ENABLE TRIGGER trg_service_orders_validate;
