-- Bypassear la validación temporalmente para hacer un cambio de ida y vuelta
ALTER TABLE public.service_orders DISABLE TRIGGER trg_service_orders_validate;

-- Cambiar de waiting_parts a ready (esto dispara el webhook)
UPDATE public.service_orders SET status = 'ready' WHERE folio = 2;

-- Restaurar validación
ALTER TABLE public.service_orders ENABLE TRIGGER trg_service_orders_validate;
