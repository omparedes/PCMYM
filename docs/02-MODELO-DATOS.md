# 02 — Modelo de datos

> **Léeme antes de tocar la BD.** Todo cambio de esquema pasa por una migración en
> `supabase/migrations/`. Prohibido editar el esquema a mano en el dashboard.

## Idioma del esquema
**Inglés, sin excepción** (tablas, columnas, funciones, triggers, RLS, valores de enum). Decisión
registrada en [`decisiones/0006-idioma-esquema.md`](decisiones/0006-idioma-esquema.md). Las
etiquetas visibles al usuario (español) viven solo en la capa de presentación de Angular, nunca en
la BD.

## Reglas transversales (aplican a TODA tabla de dominio)
- `id uuid primary key default gen_random_uuid()`.
- `business_id uuid not null references businesses(id)` — la columna de tenant.
- `created_at timestamptz not null default now()` y `updated_at timestamptz not null default now()`.
- **RLS activado** desde la migración que crea la tabla, con políticas que filtran por
  `business_id = auth_business_id()`.
- **GRANT explícito** a `authenticated` (Supabase no auto-expone tablas nuevas al Data API).
- Índice en `business_id` como mínimo; índices adicionales según patrones de búsqueda.

## Tablas base (Fase 0 — migración `20260619140938_init_tenant_base.sql`)
### `businesses` (tenants)
| columna      | tipo        | notas                                  |
|--------------|-------------|----------------------------------------|
| id           | uuid PK     | `gen_random_uuid()`                    |
| name         | text        | nombre del taller                      |
| slug         | text unique | identificador legible (subdominio futuro) |
| active       | boolean     | default true                           |
| created_at   | timestamptz | default now()                          |
| updated_at   | timestamptz | default now()                          |

RLS: un usuario solo ve y edita su propio negocio (`id = auth_business_id()`).

### `profiles` (usuario ↔ negocio, 1:1 con auth.users)
| columna      | tipo        | notas                                                |
|--------------|-------------|------------------------------------------------------|
| id           | uuid PK     | = `auth.users.id` (FK a auth.users, on delete cascade) |
| business_id  | uuid        | not null, FK → businesses(id)                        |
| name         | text        | nombre del usuario                                   |
| role         | text        | `owner` \| `technician` \| `reception` (check)       |
| created_at   | timestamptz | default now()                                        |
| updated_at   | timestamptz | default now()                                        |

RLS: el usuario ve los perfiles de su mismo `business_id`. Solo `owner` crea/edita/borra perfiles.

### Funciones helper (security definer, anti-recursión RLS)
- `auth_business_id()` — devuelve el `business_id` del `profiles` de `auth.uid()`. Pivote de toda
  política RLS multi-tenant.
- `auth_role()` — devuelve el `role` del `profiles` de `auth.uid()`.
- `set_updated_at()` — trigger genérico que actualiza `updated_at` en cada UPDATE.

## Tablas de dominio (Fase 1)

### `customers`
| columna          | tipo        | notas                                          |
|-------------------|-------------|------------------------------------------------|
| id                | uuid PK     | `gen_random_uuid()`                            |
| business_id       | uuid        | not null, FK → businesses(id)                  |
| name              | text        | not null                                       |
| document_type     | text        | nullable (p.ej. `DNI`, `RUC` — contexto Perú)  |
| document_number   | text        | nullable                                       |
| phone             | text        | nullable                                       |
| email             | text        | nullable                                       |
| address           | text        | nullable                                       |
| notes             | text        | nullable                                       |
| archived_at       | timestamptz | nullable — soft delete, NUNCA borrado físico   |
| created_at        | timestamptz | default now()                                  |
| updated_at        | timestamptz | default now()                                  |

Índices: `business_id`; búsqueda por `name`, `phone`, `document_number` (índices `pg_trgm` o btree
simple según necesidad real, ver migración). RLS estándar (select/insert/update/delete por
`business_id = auth_business_id()`).

### `service_orders` (OS — entidad central)
| columna               | tipo        | notas                                                  |
|------------------------|-------------|---------------------------------------------------------|
| id                     | uuid PK     | `gen_random_uuid()`                                     |
| business_id            | uuid        | not null, FK → businesses(id)                           |
| folio                  | int         | correlativo legible **por negocio** (p.ej. orden #0042) |
| customer_id            | uuid        | not null, FK → customers(id)                            |
| equipment_type         | text        | nullable (laptop, PC, impresora...)                     |
| brand                  | text        | nullable                                                |
| model                  | text        | nullable                                                |
| serial_number          | text        | nullable                                                |
| accessories            | text        | nullable (cargador, mouse...)                           |
| reported_issue         | text        | nullable — falla reportada por el cliente               |
| initial_diagnosis      | text        | nullable — diagnóstico del técnico                      |
| status                 | text        | enum por check, ver máquina de estados abajo            |
| priority                | text        | enum: `low` \| `normal` \| `high` \| `urgent`           |
| assigned_to            | uuid        | nullable, FK → profiles(id)                             |
| received_at            | timestamptz | default now()                                            |
| estimated_delivery     | date        | nullable                                                 |
| created_at             | timestamptz | default now()                                            |
| updated_at             | timestamptz | default now()                                            |

> El equipo se modela embebido en la OS por ahora (no como tabla aparte). Se normaliza a una tabla
> `equipment` en una fase posterior si hace falta (p.ej. historial de equipos de un mismo cliente).

**Máquina de estados (`status`):**
`pending → diagnosing → repairing → waiting_parts → ready → delivered`, con `cancelled` alcanzable
desde cualquier estado no terminal. Ver
[`decisiones/0003-os-entidad-central.md`](decisiones/0003-os-entidad-central.md).

**Mapeo de etiquetas en UI (español, solo capa de presentación — NUNCA en la BD):**
| clave (BD)      | etiqueta (UI)          |
|------------------|------------------------|
| `pending`        | Pendiente              |
| `diagnosing`      | En diagnóstico         |
| `repairing`       | En reparación          |
| `waiting_parts`   | Esperando repuesto     |
| `ready`           | Listo para entrega     |
| `delivered`       | Entregado              |
| `cancelled`       | Cancelado              |

`folio`: correlativo por negocio (no global), generado por trigger/secuencia lógica en la migración
(ver migración `service_orders`), para que cada taller vea "Orden #1, #2..." independientemente de
otros tenants.

### `order_status_history` (trazabilidad — Fase 1)
| columna           | tipo        | notas                                      |
|---------------------|-------------|---------------------------------------------|
| id                  | uuid PK     | `gen_random_uuid()`                         |
| business_id         | uuid        | not null (denormalizado para RLS directa)   |
| service_order_id    | uuid        | not null, FK → service_orders(id)           |
| from_status          | text        | nullable (null en la fila de creación)      |
| to_status            | text        | not null                                     |
| note                | text        | nullable                                     |
| changed_by          | uuid        | nullable, FK → profiles(id)                  |
| changed_at          | timestamptz | default now()                                |

Se llena **por trigger de BD** al cambiar `service_orders.status` (no por la app), para que el
historial sea a prueba de manipulación e independiente del cliente que escriba (web, MCP, futuro
móvil). Ver migración de `service_orders` para el trigger y la validación de transiciones.

## Tablas pendientes (Fase 1 restante — NO construir todavía)
Quedan anotadas en el roadmap (`docs/03-ROADMAP-FASES.md`), fuera de esta tanda:
- **`equipment_photos`** — fotos del equipo en Supabase Storage, ligadas a `service_orders`.
- **`payments`** — registro de pago mínimo contra una `service_order`.
- **`financial_entries`** — log simple de ingreso/gasto.

## Notas de implementación
- `service_role` para crear el primer `owner` de un negocio (onboarding) — RLS exige un owner
  preexistente para insertar perfiles vía `authenticated`.
- Toda tabla nueva: usar la skill `supabase-migration` (plantilla con RLS + GRANT incluidos).
