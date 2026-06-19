# 02 — Modelo de datos

> **Léeme antes de tocar la BD.** Todo cambio de esquema pasa por una migración en
> `supabase/migrations/`. Prohibido editar el esquema a mano en el dashboard.

## Reglas transversales (aplican a TODA tabla de dominio)
- `id uuid primary key default gen_random_uuid()`.
- `negocio_id uuid not null references negocios(id)` — la columna de tenant.
- `created_at timestamptz not null default now()` y `updated_at timestamptz not null default now()`.
- **RLS activado** desde la migración que crea la tabla, con políticas que filtran por
  `negocio_id = auth_negocio_id()`.
- Nombres de tablas y columnas en **inglés**... salvo el dominio ya acordado en español del
  negocio. **Decisión de nomenclatura pendiente de confirmar con Oscar** (ver Dudas abajo): hoy
  las tablas base usan `negocios`/`perfiles` (español). Mantener coherencia hasta resolver el ADR.

## Tablas base (Fase 0 — ya en la primera migración)
### `negocios` (tenants)
| columna      | tipo        | notas                                  |
|--------------|-------------|----------------------------------------|
| id           | uuid PK     | `gen_random_uuid()`                    |
| nombre       | text        | nombre del taller                      |
| slug         | text unique | identificador legible (subdominio futuro) |
| activo       | boolean     | default true                           |
| created_at   | timestamptz | default now()                          |
| updated_at   | timestamptz | default now()                          |

RLS: un usuario solo ve su propio negocio (`id = auth_negocio_id()`).

### `perfiles` (usuario ↔ negocio, 1:1 con auth.users)
| columna      | tipo        | notas                                                |
|--------------|-------------|------------------------------------------------------|
| id           | uuid PK     | = `auth.users.id` (FK a auth.users, on delete cascade) |
| negocio_id   | uuid        | not null, FK → negocios(id)                          |
| nombre       | text        | nombre del usuario                                   |
| rol          | text        | `owner` \| `tecnico` \| `recepcion` (enum/check)     |
| created_at   | timestamptz | default now()                                        |
| updated_at   | timestamptz | default now()                                        |

RLS: el usuario ve los perfiles de su mismo `negocio_id`. Solo `owner` puede crear/editar perfiles
del negocio (refinable en Fase 1).

### Función `auth_negocio_id()`
`security definer`, devuelve el `negocio_id` del `perfiles` correspondiente a `auth.uid()`.
Es el pivote de todas las políticas RLS. Se crea en la primera migración.

## Tablas de dominio (Fase 1 — NO crear todavía)
Diseño objetivo (se materializa en migraciones de Fase 1):
- **`clientes`** — datos del cliente (nombre, teléfono, email), `negocio_id`.
- **`ordenes_servicio` (OS)** — entidad central. Campos: `cliente_id`, `negocio_id`, `equipo`
  (descripción/marca/modelo/serie), `estado` (enum), `tecnico_id`, `descripcion_falla`,
  `diagnostico`, `total`, `created_at`...
  - Máquina de estados: `pendiente → en_diagnostico → en_reparacion → esperando_repuesto → listo → entregado`.
- **`os_historial`** — una fila por transición de estado de una OS (estado_anterior, estado_nuevo,
  usuario, nota, timestamp). Trazabilidad.
- **`os_fotos`** — referencias a objetos de Storage (fotos del equipo) ligadas a la OS.
- **`pagos`** — registro de pago mínimo contra una OS.
- **`movimientos_financieros`** — log simple ingreso/gasto.

> El detalle de columnas y la máquina de estados se especifica al iniciar Fase 1, junto con sus
> migraciones. Ver [`03-ROADMAP-FASES.md`](03-ROADMAP-FASES.md) y
> [`decisiones/0003-os-entidad-central.md`](decisiones/0003-os-entidad-central.md).

## Dudas abiertas para Oscar
- **Idioma de los identificadores de BD.** La convención dura dice "código en inglés", pero el
  dominio del negocio se modela hoy en español (`negocios`, `perfiles`, `ordenes_servicio`,
  `estado=pendiente`). Hay que elegir UNA y registrarla en un ADR: (a) todo en inglés
  (`businesses`, `profiles`, `service_orders`, `status=pending`), o (b) dominio en español por
  cercanía al negocio. Las tablas base se crearon en español de forma provisional; cambiarlo
  después es una migración de rename. **Pendiente de confirmar.**
