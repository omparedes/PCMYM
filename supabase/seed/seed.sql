-- Synthetic seed data for local development (`npx supabase db reset`).
-- Runs as superuser, so RLS does not apply here.
-- NEVER put real customer data in this file. Real data goes in `*-real.sql`
-- files (gitignored). See .gitignore and docs/04-CONVENCIONES.md.

-- Demo business (tenant).
insert into public.businesses (id, name, slug, active)
values ('00000000-0000-0000-0000-000000000001', 'Taller Demo PCMYM', 'demo', true)
on conflict (id) do nothing;

-- The 'owner' profile requires a user in auth.users. To create a test owner:
--   1) Create a user in Supabase Auth (local dashboard or CLI).
--   2) Insert their profile linking that auth.users.id with the demo business, e.g.:
--      insert into public.profiles (id, business_id, name, role)
--      values ('<auth-user-uuid>', '00000000-0000-0000-0000-000000000001', 'Owner Demo', 'owner');
