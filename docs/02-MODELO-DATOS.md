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

## Tablas de dominio (Fase 1.5)

### `service_order_photos`
| columna           | tipo        | notas                                              |
|---------------------|-------------|-------------------------------------------------------|
| id                  | uuid PK     | `gen_random_uuid()`                                    |
| business_id         | uuid        | not null, FK → businesses(id)                          |
| service_order_id    | uuid        | not null, FK → service_orders(id)                      |
| storage_path        | text        | not null — ruta del objeto en el bucket `service_photos` |
| uploaded_by         | uuid        | nullable, FK → profiles(id)                             |
| uploaded_at         | timestamptz | default now()                                           |

Trigger `validate_service_order_photo` (mismo patrón que `validate_service_order`): rechaza un
`service_order_id` que no pertenezca al `business_id` de la fila. Tabla inmutable desde el cliente
(solo `select, insert`; sin `update`/`delete`).

**Storage**: bucket `service_photos` **privado** (no público). Rutas con el patrón
`{business_id}/{service_order_id}/{uuid}-{filename}`; las políticas RLS de `storage.objects` exigen
que el primer segmento de la ruta coincida con `auth_business_id()` — aislamiento por tenant a nivel
de Storage, no solo en la tabla. La UI renderiza las fotos con **signed URLs** (de corta duración),
nunca con una URL pública sin autenticar.

### `payments`
| columna           | tipo          | notas                                                |
|---------------------|---------------|---------------------------------------------------------|
| id                  | uuid PK       | `gen_random_uuid()`                                     |
| business_id         | uuid          | not null, FK → businesses(id)                           |
| service_order_id    | uuid          | not null, FK → service_orders(id)                       |
| amount              | numeric(10,2) | not null, check `> 0`                                   |
| payment_method      | text          | not null, check `in ('cash', 'transfer', 'card')`        |
| created_at          | timestamptz   | default now()                                            |
| recorded_by         | uuid          | nullable, FK → profiles(id)                              |

Trigger `validate_payment` (mismo patrón de validación cruzada). Tabla inmutable desde el cliente
(solo `select, insert`). Cada inserción dispara `trg_payments_log_financial_entry`.

### `financial_entries` (caja — inmutable, ni siquiera INSERT directo)
| columna      | tipo          | notas                                            |
|---------------|---------------|------------------------------------------------------|
| id            | uuid PK       | `gen_random_uuid()`                                  |
| business_id   | uuid          | not null, FK → businesses(id)                        |
| entry_type    | text          | not null, check `in ('income', 'expense')`            |
| amount        | numeric(10,2) | not null, check `> 0`                                |
| description   | text          | not null                                              |
| created_at    | timestamptz   | default now()                                         |

**Sin GRANT de INSERT para `authenticated`** — la única vía de escritura es el trigger
`log_payment_to_financial_entries` (`AFTER INSERT` en `payments`, `SECURITY DEFINER`), que genera
automáticamente una entrada `income` con la descripción `"Pago de Orden #<folio>"`. Por ahora la
tabla solo recibe `income` desde pagos; un flujo de alta manual de `expense` queda fuera de esta
fase (evaluar en Fase 2 si hace falta).

## Tablas de dominio (Fase 2)

### `budgets` (presupuestos / cotizaciones)
| columna           | tipo          | notas                                                  |
|---------------------|---------------|-----------------------------------------------------------|
| id                  | uuid PK       | `gen_random_uuid()`                                        |
| business_id         | uuid          | not null, FK → businesses(id)                              |
| folio               | int           | correlativo por negocio, igual patrón que `service_orders` |
| service_order_id    | uuid          | not null, FK → service_orders(id)                          |
| status              | text          | enum por check, ver máquina de estados abajo                |
| total_amount        | numeric(10,2) | denormalizado = `sum(budget_items.quantity * unit_price)`   |
| notes               | text          | nullable                                                     |
| created_by          | uuid          | nullable, FK → profiles(id)                                  |
| created_at          | timestamptz   | default now()                                                |
| updated_at          | timestamptz   | default now()                                                |

**Máquina de estados (`status`):** `draft → sent → approved | rejected`. `approved`/`rejected` son
terminales — un presupuesto rechazado o aprobado nunca se reabre; si el taller necesita ajustar el
precio, crea un presupuesto nuevo para la misma OS. Validada en Postgres
(`is_valid_budget_transition`/`validate_budget`), mismo patrón que la máquina de estados de la OS.

**Etiquetas UI (español):** `draft` → Borrador, `sent` → Enviado, `approved` → Aprobado, `rejected`
→ Rechazado.

Tabla sin GRANT de `delete` (se rechaza vía estado, no se borra). `update` solo cambia `status`/
`notes` en la práctica — el cambio de estado pasa por el RPC `change_budget_status`.

### `budget_items` (líneas — repuestos/mano de obra)
| columna       | tipo          | notas                                            |
|----------------|---------------|-------------------------------------------------------|
| id             | uuid PK       | `gen_random_uuid()`                                    |
| business_id    | uuid          | not null, FK → businesses(id)                          |
| budget_id      | uuid          | not null, FK → budgets(id)                             |
| description    | text          | not null                                                |
| quantity       | numeric(10,2) | not null, default 1, check `> 0`                       |
| unit_price     | numeric(10,2) | not null, check `>= 0`                                  |
| created_at     | timestamptz   | default now()                                            |

**Presupuesto congelado tras enviarse:** los ítems solo se pueden insertar/editar/eliminar
mientras el presupuesto padre está en `draft` (trigger `validate_budget_item` /
`validate_budget_item_delete`). Una vez `sent`, lo que vio el cliente no puede cambiar por debajo
de una aprobación/rechazo. Cada insert/update/delete dispara `recalculate_budget_total` (`AFTER`,
`SECURITY DEFINER`) que recalcula `budgets.total_amount` desde cero.

> Nota de diseño: `validate_budget_item_delete` solo bloquea el delete si el presupuesto padre
> **todavía existe** y no está en `draft`. Si el padre ya fue eliminado (delete en cascada desde
> `service_orders`/`businesses`), el delete de los ítems se permite — de lo contrario un cascade
> delete administrativo (p.ej. borrar un negocio de prueba) quedaría bloqueado permanentemente.

### `budget_status_history` (trazabilidad — inmutable)
Mismo patrón que `order_status_history`: una fila por cada creación/cambio de `status`, escrita
únicamente por el trigger `SECURITY DEFINER` `log_budget_status_history`. Sin GRANT de escritura
para `authenticated`.

### RPCs de Fase 2
- **`change_budget_status(p_budget_id, p_new_status)`** — `SECURITY DEFINER`, mismo shape que
  `change_service_order_status`. Re-valida `business_id = auth_business_id()` antes de mutar; los
  triggers de validación/historial igual se disparan sobre la tabla.
- **`record_expense(p_amount, p_description)`** — `SECURITY DEFINER`, única vía para insertar una
  fila `entry_type = 'expense'` en `financial_entries` (que sigue sin GRANT de INSERT para
  `authenticated`, igual que en Fase 1.5). Resuelve `business_id` internamente vía
  `auth_business_id()`, nunca confía en un valor que mande el cliente.

## Vistas de reportes financieros (Fase 2)
Todas creadas `with (security_invoker = true)` (Postgres 15+): la vista corre con los privilegios
de quien la consulta, no de su dueño. Como cada tabla base ya tiene RLS por
`business_id = auth_business_id()`, las vistas quedan automáticamente acotadas al tenant que
consulta sin filtro adicional — y es imposible que una vista filtre datos de otro tenant aunque su
SQL tenga un error, porque Postgres sigue aplicando el RLS de las tablas base por debajo. Todas
devuelven `business_id` explícitamente. Con `grant select ... to authenticated`.

- **`v_income_expense_daily`** — ingresos/gastos por día, últimos 90 días.
- **`v_income_expense_monthly`** — ingresos/gastos por mes, histórico completo.
- **`v_top_customers`** — clientes ordenados por ingresos totales (suma de `payments` vía sus OS).
- **`v_top_equipment_types`** — `equipment_type` más atendido en `service_orders` (proxy de
  "servicios más realizados"; no hay catálogo de servicios todavía, ver nota abajo).
- **`v_accounts_receivable`** — saldo pendiente por OS: total del último presupuesto `approved`
  menos lo pagado en `payments`. Solo incluye OS con saldo `> 0` y no `cancelled`.

> Nota: `service_orders` no tiene un campo de "tipo de servicio" separado del equipo; `equipment_type`
> se usa como proxy. Si se necesita un catálogo de servicios real, evaluarlo en una fase posterior
> (probablemente Fase 6 — Inventario y catálogo).

## Notas de implementación
- `service_role` para crear el primer `owner` de un negocio (onboarding) — RLS exige un owner
  preexistente para insertar perfiles vía `authenticated`.
- Toda tabla nueva: usar la skill `supabase-migration` (plantilla con RLS + GRANT incluidos).
- `database.types.ts` (Angular) se regenera con `npx supabase gen types typescript --linked`
  contra el proyecto remoto enlazado — no se edita a mano.
