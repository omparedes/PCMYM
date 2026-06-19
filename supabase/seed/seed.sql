-- Seed de DATOS SINTÉTICOS para desarrollo local (`npx supabase db reset`).
-- Se ejecuta como superusuario, por lo que RLS no aplica aquí.
-- NUNCA pongas datos reales de clientes en este archivo. Los datos reales van en
-- archivos `*-real.sql` (gitignored). Ver .gitignore y docs/04-CONVENCIONES.md.

-- Negocio (tenant) de demostración.
insert into public.negocios (id, nombre, slug, activo)
values ('00000000-0000-0000-0000-000000000001', 'Taller Demo PCMYM', 'demo', true)
on conflict (id) do nothing;

-- El perfil 'owner' requiere un usuario en auth.users. Para crear un owner de prueba:
--   1) Crea un usuario en Supabase Auth (dashboard local o `supabase` CLI).
--   2) Inserta su perfil enlazando ese auth.users.id con el negocio demo, por ejemplo:
--      insert into public.perfiles (id, negocio_id, nombre, rol)
--      values ('<auth-user-uuid>', '00000000-0000-0000-0000-000000000001', 'Owner Demo', 'owner');
