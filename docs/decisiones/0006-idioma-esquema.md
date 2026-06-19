# ADR 0006 — Idioma del esquema de base de datos: inglés

- **Estado:** Aceptada
- **Fecha:** 2026-06-19

## Contexto
La migración base de Fase 0 se escribió en español (`negocios`, `perfiles`, `negocio_id`,
`auth_negocio_id()`) siguiendo los nombres literales del brief inicial, dejando pendiente una
decisión formal. `AGENTS.md` y `docs/04-CONVENCIONES.md` ya establecían "código en inglés,
documentación en español" como regla dura, pero el esquema de dominio quedó como excepción sin
resolver. Antes de construir las tablas de Fase 1 (`customers`, `service_orders`, ...) hace falta
fijar una sola convención: cambiarla después de tener datos reales es una migración de rename con
riesgo.

## Decisión
**Esquema y código en inglés. UI y documentación en español.**
- Tablas, columnas, funciones, triggers, políticas RLS, enums: **inglés**
  (`businesses`, `profiles`, `business_id`, `auth_business_id()`, `auth_role()`,
  `customers`, `service_orders`, `status = 'pending'`...).
- Los **valores de enum son claves en inglés**; el mapeo a etiqueta en español
  (`pending` → "Pendiente") vive **solo en la capa de presentación de Angular**, nunca en la BD.
- Documentación, comentarios de docs, `ESTADO.md`, mensajes de UI: **español** (sin cambios).

## Motivo
1. **Supabase autogenera tipos TypeScript** desde el esquema (`supabase gen types`). Un esquema
   bilingüe (tablas en español, pero convenciones de Postgres/PostgREST y la mayoría de
   integraciones en inglés) genera fricción constante al tipar y documentar.
2. **Producto vendible.** Si se vende a talleres fuera de habla hispana, o se integra con
   herramientas/librerías de terceros (todas en inglés), un esquema en inglés es el estándar de
   facto y evita una migración de rename más cara cuando ya haya tenants con datos.
3. Consistencia: el resto del código (Angular, servicios, nombres de archivo) ya es en inglés;
   tener el esquema en español era la única excepción.

## Consecuencias
- **+** Tipos generados, nombres de columnas y convenciones SQL coherentes con el resto del código.
- **+** Una sola convención para toda tabla nueva desde Fase 1 en adelante.
- **−** Hay que **reescribir la migración base** de Fase 0 (`negocios`→`businesses`,
  `perfiles`→`profiles`, `negocio_id`→`business_id`, `auth_negocio_id()`→`auth_business_id()`,
  `auth_rol()`→`auth_role()`) antes de aplicarla por primera vez. Como **todavía no se había
  aplicado a ningún Postgres real**, se reescribe el archivo de migración directamente (no se
  necesita una migración de rename adicional).
- **−** Las etiquetas en español de la UI (estados, roles) deben mantenerse sincronizadas a mano
  con las claves en inglés del esquema; se centralizan en un único mapa por dominio en el código
  Angular (no en la BD) para evitar duplicar la fuente de verdad.

## Acción derivada
- Migración `supabase/migrations/20260619120000_init_tenant_base.sql` reescrita en inglés.
- `docs/02-MODELO-DATOS.md` actualizado con los nombres en inglés.
- `docs/04-CONVENCIONES.md` actualizado: ya no hay excepción pendiente sobre el idioma del esquema.
