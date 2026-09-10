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
| work_types              | text[]      | categorías múltiples: `formatting`, `repair`, `parts_replacement`, `warranty` |
| assigned_to            | uuid        | nullable, FK → profiles(id)                             |
| received_at            | timestamptz | default now()                                            |
| estimated_delivery     | date        | nullable                                                 |
| tracking_token         | uuid        | default gen_random_uuid() (Fase 3: acceso público)       |
| created_at             | timestamptz | default now()                                            |
| updated_at             | timestamptz | default now()                                            |

> El equipo se modela embebido en la OS por ahora (no como tabla aparte). Se normaliza a una tabla
> `equipment` en una fase posterior si hace falta (p.ej. historial de equipos de un mismo cliente).

`work_types` permite combinar las cuatro categorías operativas del tablero (por ejemplo, garantía y
reparación). No es todavía un catálogo comercial de servicios; ese catálogo se evaluará en Fase 6.

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

### `service_order_deliveries`
| columna             | tipo          | notas                                                   |
|---------------------|---------------|---------------------------------------------------------|
| id                  | uuid PK       | `gen_random_uuid()`                                     |
| business_id         | uuid          | not null, FK → businesses(id)                           |
| service_order_id    | uuid          | not null, único por OS, FK → service_orders(id)         |
| receiver_name       | text          | not null — persona que recibe el equipo                 |
| receiver_document   | text          | nullable                                                |
| work_summary        | text          | nullable — resumen del trabajo realizado                 |
| delivery_notes      | text          | nullable — observaciones de entrega                     |
| warranty_days       | int           | not null, `>= 0`, default `0`                           |
| warranty_terms      | text          | nullable — condiciones de garantía                      |
| delivered_at        | timestamptz   | fecha y hora efectiva de entrega                        |
| warranty_until      | date          | calculada por el RPC cuando hay garantía                 |
| delivered_by        | uuid          | nullable, FK → profiles(id)                             |
| created_at          | timestamptz   | default `now()`                                         |

La tabla es de solo lectura para `authenticated`; la única escritura es el RPC
`deliver_service_order(p_service_order_id, p_receiver_name, p_receiver_document,
p_work_summary, p_delivery_notes, p_warranty_days, p_warranty_terms)`, que en una misma
transacción inserta el registro y cambia la OS de `ready` a `delivered`. Un trigger impide que una
OS pase a `delivered` sin un registro de entrega. Esto permite reimprimir un comprobante con los
mismos datos y conserva la trazabilidad de quién recibió el equipo.

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

## API Pública y Webhooks (Fase 3)
- **RPC `get_public_tracking_info(p_token uuid)`:** `SECURITY DEFINER`. Devuelve el comprobante público de una OS filtrado por `tracking_token`: identidad y recepción del equipo (tipo, marca, modelo, serie, accesorios y observaciones), falla reportada, estado, fechas, ítems y total del último presupuesto no-borrador. Cuando ese presupuesto está aprobado, incluye solo los totales de pagos y saldo; nunca métodos de pago ni quién los registró. No devuelve técnico asignado, prioridad, notas internas del historial ni datos de otras órdenes.
- **Webhook de Notificaciones (n8n):** Trigger `AFTER UPDATE` en `service_orders`. Detecta cambios en `status` y usa `pg_net` para hacer un `POST` a la URL configurada en `app.settings.n8n_webhook_url`. Payload: `service_order_id, business_id, folio, from_status, to_status, customer_phone, tracking_token`.

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
| item_type      | text          | `part`, `labor` u `other`; default `other`              |
| product_id     | uuid          | nullable FK → `products(id)`; obligatorio si `item_type = part` |
| created_at     | timestamptz   | default now()                                            |

Los ítems `part` son repuestos enlazados al catálogo de inventario y deben tener una cantidad
entera. El precio unitario queda congelado dentro de la cotización; cambiar el precio del catálogo
no modifica presupuestos existentes. Los ítems `labor` y `other` no descuentan stock.

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
- **`apply_budget_parts_to_service_order(p_budget_id)`** — `SECURITY DEFINER`, disponible para
  el tenant autenticado. Solo acepta presupuestos `approved`, bloquea la OS y los productos para
  hacer un preflight completo de stock antes de mutar. Reserva o devuelve el delta de cada
  `budget_items.item_type = 'part'`, registra el kardex y enlaza las filas resultantes de
  `service_order_parts.budget_id`. Es idempotente: repetir la operación no duplica reservas;
  tampoco elimina repuestos manuales que no pertenezcan al presupuesto.
- **`record_expense(p_amount, p_description)`** — `SECURITY DEFINER`, única vía para insertar una
  fila `entry_type = 'expense'` en `financial_entries` (que sigue sin GRANT de INSERT para
  `authenticated`, igual que en Fase 1.5). Resuelve `business_id` internamente vía
  `auth_business_id()`, nunca confía en un valor que mande el cliente.

### `supplier_catalog_imports` y `supplier_products` (catálogo de proveedores)
El catálogo externo se mantiene separado de `products`: importar una lista de Deltron nunca
modifica el stock propio. `supplier_catalog_imports` registra cada archivo, tipo de cambio,
impuestos, filas aceptadas y advertencias. `supplier_products` usa el código del proveedor como
identificador estable y conserva categoría, descripción técnica, disponibilidad, precios en USD,
marca, garantía, clasificación comercial y atributos técnicos extraídos.

`supplier_products` añade `catalog_group` (`pc_parts`, `laptops`, `monitors`, `peripherals` u
`other`) y `component_category` (`processor`, `motherboard`, `memory`, `storage`, `graphics`,
`power_supply`, `case`, `cooling` u `other`). `search_document` y `search_terms` guardan el texto
normalizado y los sinónimos técnicos/comerciales generados durante la importación. Esto permite
buscar `RAM 8G DDR4`, `placa AM5` o `case gabinete` aunque los términos no estén contiguos.

Ambas tablas son multi-tenant y tienen RLS por `business_id`. Cada importación marca como inactivos
los productos Deltron que ya no aparecen en el archivo más reciente. La importación es idempotente
por `(business_id, supplier, supplier_code)`.

La RPC `search_supplier_products()` aplica el tenant autenticado, oculta por defecto el stock cero
o desconocido, filtra por grupo/subcategoría y ordena por precio de distribución ascendente. Acepta
paginación y un modo explícito para incluir agotados; la UI no carga un límite arbitrario del catálogo
para completar la búsqueda.

### `sales_quotes` y `sales_quote_items` (proformas de venta)
Las proformas son independientes de la OS y congelan el tipo de cambio, margen, IGV, vigencia,
cliente, costo y precio de cada línea. `supplier_product_id` permite rastrear el producto externo
que originó la línea, pero los importes quedan guardados para que una actualización posterior del
catálogo no altere una proforma enviada.

La máquina de estados es `draft → sent → approved | rejected | expired`. Los ítems solo se pueden
modificar mientras la proforma está en `draft`. El trigger `recalculate_sales_quote_total` mantiene
subtotal, IGV y total calculados en PostgreSQL. `next_sales_quote_folio()` asigna folios correlativos
por negocio bajo bloqueo de fila.

La clasificación se deriva exclusivamente del encabezado Deltron mediante
`supplier_header_classification`; las descripciones sirven para enriquecer atributos, no para
convertir un teclado o disco en una placa. `infer_supplier_specs` extrae datos conservadores.
El trigger `refresh_supplier_specs` centraliza clasificación, atributos y alias en cada escritura.

`supplier_products.inferred_attributes` conserva la extracción del HTML y
`specification_overrides` las correcciones manuales (valores textuales; null borra un atributo
inferido). `technical_attributes` es la combinación efectiva. El RPC invoker
`set_supplier_specifications(uuid,jsonb)` aplica las correcciones bajo RLS del negocio actual;
enviar `{}` restaura la extracción automática. Las importaciones no envían overrides y los
conservan en el upsert. No se añadieron tablas ni accesos públicos nuevos.

`sales_quote_items.build_key` separa conjuntos independientes dentro de la proforma;
`specification_snapshot` conserva la ficha efectiva al cotizar. `compatibility_status` usa
`unchecked`, `compatible`, `incompatible` o `review`, con los motivos en `compatibility_notes`.
La UI bloquea conflictos conocidos y guarda armados como `review` hasta la comprobación técnica
integral. El motor de reglas vive en `pc-compatibility.ts`; no es un validador de compatibilidad
en el backend. RLS y el bloqueo de edición de ítems después de `sent` siguen aplicándose en BD.

Las proformas en `draft` se modifican mediante `update_sales_quote_draft()`, que reemplaza de
forma atómica sus datos de cliente, condiciones y líneas, y deja que los triggers recalculen los
totales. `duplicate_sales_quote()` copia cualquier proforma del mismo tenant a un nuevo folio en
estado `draft`, incluyendo precios, armados y snapshots; la original no se altera. Las proformas
enviadas, aprobadas, rechazadas o vencidas no se editan directamente: se duplica una copia.

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
