-- Phase 1.5 Stage 1: equipment photos in Supabase Storage, linked to service_orders.
-- Schema in English (ADR 0006). Spanish UI labels live only in Angular.

-- ============================================================
-- Storage bucket: service_photos (private — RLS-gated, not public).
-- Objects are stored as {business_id}/{service_order_id}/{uuid}-{filename},
-- so the same auth_business_id() check used everywhere else can be enforced
-- directly on storage.objects, in addition to the service_order_photos table
-- below. Rendering uses signed URLs (short-lived, issued only after RLS
-- allows the read), never an unauthenticated public URL.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('service_photos', 'service_photos', false)
on conflict (id) do nothing;

create policy "service_photos_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'service_photos'
    and (storage.foldername(name))[1] = public.auth_business_id()::text
  );

create policy "service_photos_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'service_photos'
    and (storage.foldername(name))[1] = public.auth_business_id()::text
  );

-- ============================================================
-- Table: service_order_photos
-- ============================================================
create table public.service_order_photos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create index idx_service_order_photos_business_id on public.service_order_photos(business_id);
create index idx_service_order_photos_service_order_id on public.service_order_photos(service_order_id, uploaded_at);

-- ============================================================
-- Tenant-consistency validation, same pattern as validate_service_order():
-- service_order_id must belong to the same business_id as the photo row.
-- ============================================================
create or replace function public.validate_service_order_photo()
returns trigger
language plpgsql
as $$
declare
  v_order_business_id uuid;
begin
  select business_id into v_order_business_id
    from public.service_orders where id = new.service_order_id;
  if v_order_business_id is null or v_order_business_id <> new.business_id then
    raise exception 'service_order_id does not belong to this business';
  end if;
  return new;
end;
$$;

create trigger trg_service_order_photos_validate
  before insert on public.service_order_photos
  for each row execute function public.validate_service_order_photo();

-- ============================================================
-- Grants + RLS. Immutable trail: no UPDATE/DELETE grant — a photo record is
-- never edited once uploaded (mirrors order_status_history's immutability,
-- though here the client inserts directly rather than via a SECURITY DEFINER
-- trigger, since the upload itself is the user action being recorded).
-- ============================================================
grant select, insert on public.service_order_photos to authenticated;

alter table public.service_order_photos enable row level security;

create policy "service_order_photos_select" on public.service_order_photos
  for select to authenticated
  using (business_id = public.auth_business_id());

create policy "service_order_photos_insert" on public.service_order_photos
  for insert to authenticated
  with check (business_id = public.auth_business_id());
