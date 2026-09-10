create or replace function public.validate_sales_quote_status()
returns trigger
language plpgsql
as $$
begin
  if new.status <> old.status and not (
    (old.status = 'draft' and new.status in ('sent', 'rejected')) or
    (old.status = 'sent' and new.status in ('approved', 'rejected', 'expired'))
  ) then
    raise exception 'Invalid sales quote status transition: % to %', old.status, new.status;
  end if;
  return new;
end;
$$;

create trigger trg_validate_sales_quote_status
  before update of status on public.sales_quotes
  for each row execute function public.validate_sales_quote_status();
