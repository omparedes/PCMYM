-- Phase 3 Step 3: status-change notifications to n8n (WhatsApp/email fanout
-- lives in n8n, not here — this trigger only fires the webhook).
-- Schema in English (ADR 0006).
--
-- The n8n webhook URL is environment-specific and is NOT committed in this
-- migration (a real workshop's webhook path shouldn't sit in plaintext git
-- history any more than an API key would). It is read from a Postgres custom
-- setting instead. Before this goes live on a given environment, run once
-- against that Supabase project's SQL editor (or via the CLI):
--
--   alter database postgres set app.settings.n8n_webhook_url = 'https://your-n8n.example.com/webhook/pcmym-status';
--   select pg_reload_conf();
--
-- Until that's set, the trigger silently no-ops (logs a NOTICE) instead of
-- failing the status update — a missing webhook config must never block the
-- workshop from changing an order's status.

create extension if not exists pg_net;

create or replace function public.notify_service_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_webhook_url text := current_setting('app.settings.n8n_webhook_url', true);
  v_customer_phone text;
begin
  if old.status is distinct from new.status then
    if v_webhook_url is null or v_webhook_url = '' then
      raise notice 'n8n webhook URL not configured (app.settings.n8n_webhook_url) — skipping notification for service_order %', new.id;
      return new;
    end if;

    select phone into v_customer_phone from public.customers where id = new.customer_id;

    perform net.http_post(
      url := v_webhook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
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

create trigger trg_service_orders_notify_status_change
  after update on public.service_orders
  for each row execute function public.notify_service_order_status_change();
