# ADR 0001 — Multi-tenancy desde el día uno

- **Estado:** Aceptada
- **Fecha:** 2026-06-19
- **Contexto del brief:** Fase 0 (bootstrap).

## Contexto
PCMYM no es un software para un solo taller: el objetivo de negocio es venderlo como producto SaaS
a otros talleres. Si la separación entre negocios se añade después, reescribir el modelo de datos y
la seguridad es caro y arriesgado (riesgo de fuga de datos entre clientes).

## Decisión
Diseñar **multi-tenant desde la primera migración**, con estrategia **shared database / shared
schema / columna de tenant**:
- Toda tabla de dominio lleva `negocio_id uuid not null references negocios(id)`.
- **RLS activado** en toda tabla, con políticas que filtran por `negocio_id = auth_negocio_id()`.
- `auth_negocio_id()` (security definer) resuelve el tenant desde `perfiles` a partir de `auth.uid()`.
- **Modelo de usuario: 1 usuario → 1 negocio** (tabla `perfiles`, 1:1 con `auth.users`). Más simple
  para el MVP. La opción N:N (`usuarios_negocio`, un usuario gestiona varios negocios) se evaluará
  cuando aparezca la necesidad real (probable en Fase 7).

## Consecuencias
- **+** Aislamiento garantizado en la base de datos, no en el cliente.
- **+** Onboarding de un nuevo tenant = crear una fila en `negocios` + perfiles.
- **−** Toda query y política debe respetar `negocio_id`; disciplina obligatoria en cada migración.
- **−** Migrar a N:N más adelante implica una tabla puente y reescribir `auth_negocio_id()`.

## Alternativas descartadas
- **Schema-per-tenant / DB-per-tenant:** mayor aislamiento pero operación y migraciones mucho más
  complejas; innecesario para el volumen esperado.
- **Filtrado solo en la app (sin RLS):** inaceptable; una falla de código expondría datos de otros
  negocios.
