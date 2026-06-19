# ESTADO DEL PROYECTO
Última actualización: 2026-06-19 por Claude Code (Sonnet 4.6) — estación Oscar/Windows

> Protocolo de handoff: **todo agente actualiza este archivo al cerrar sesión.** Es lo que permite
> cambiar de estación o de agente sin perder el hilo. Mantén el formato de abajo.

## Fase actual
**Fase 1 — Núcleo operativo. Núcleo completado y aprobado (Checkpoints A, B y C).**
Pendiente: **Fase 1.5** (fotos / pagos / log financiero) — ver `docs/03-ROADMAP-FASES.md`.

## Hecho en la última sesión

### Checkpoint A — Pre-flight (idioma de esquema, Supabase real, MCP)
- **ADR 0006**: esquema de BD en **inglés** sin excepción (`businesses`, `profiles`, `business_id`,
  `auth_business_id()`, `auth_role()`); UI/labels en español. Motivo: tipos TS autogenerados y
  consistencia para producto vendible. Migración base reescrita (nunca se había aplicado, así que
  se reemplazó el archivo directamente, sin migración de rename).
- `docs/02-MODELO-DATOS.md`, `docs/04-CONVENCIONES.md`, `AGENTS.md` y las skills
  (`supabase-migration`, `angular-feature`) actualizadas a los nombres en inglés.
- **Proyecto Supabase real provisionado**: "PCMYM" (`lhbgseamumyvtatmjnjx`, Postgres 17,
  us-east-2). `.env` (raíz, gitignored) con credenciales reales. `supabase link` + `supabase db push`
  de la migración base — confirmado con `supabase migration list` y una query REST real (RLS
  bloqueando sin sesión, `200 []`, no error).
- **MCP conectados**: Supabase MCP (read-only, scoped al proyecto) y Context7 (sin API key, tier
  gratis). Google Drive ya estaba conectado de antes. GitHub MCP queda sin configurar (no era
  requisito de esta fase).

### Checkpoint B — Feature `customers`
- Migración `customers` (`20260619161026_create_customers.sql`): búsqueda fuzzy con `pg_trgm` +
  GIN sobre `name`/`phone`/`document_number`. **Soft-delete reforzado a nivel de BD**: no existe
  GRANT ni policy de `DELETE` — verificado empíricamente insertando con `service_role` e
  intentando borrar con la key pública (la fila sobrevive).
- UI signal-first sin PrimeNG: `customers.service.ts` (tipado con `database.types.ts`
  autogenerado vía `supabase gen types`, no manual), `customers-list.ts` (`resource()` +
  `debounced()` para el buscador), `customer-form.ts` (alta/edición con Signal Forms,
  directive real `[formField]`), `auth.guard.ts` nuevo en `core/auth/`.
- **Verificado en navegador real** (Playwright headless contra Supabase real, datos de prueba
  limpiados después): login → crear → buscar → archivar → reactivar → editar. Cero errores de
  consola.

### Checkpoint C — Feature `service_orders` (la entidad central)
- Migración `service_orders` + `order_status_history`
  (`20260619174148_create_service_orders.sql`):
  - **Máquina de estados validada en Postgres** (trigger `validate_service_order`, `BEFORE INSERT
    OR UPDATE`): rechaza transiciones inválidas (`pending → delivered` directo → error). Mapa de
    transiciones en `is_valid_service_order_transition()`.
  - **Historial inmutable**: `order_status_history` sin ningún GRANT de escritura para
    `authenticated`; solo el trigger `log_service_order_status_history` (`SECURITY DEFINER`) puede
    insertar ahí. Verificado con `changed_by` poblado correctamente desde un JWT real.
  - **Aislamiento cross-tenant** (más allá de lo pedido, pero coherente con RLS-first): el mismo
    trigger de validación rechaza un `customer_id` o `assigned_to` que no pertenezca al
    `business_id` de la OS. Verificado con un cliente de otro negocio → rechazado.
  - **Folio atómico por negocio** vía `service_order_folio_counters` (tabla interna sin ningún
    GRANT, solo tocada por un trigger `SECURITY DEFINER`) con upsert + `returning` (race-safe).
  - RPC `change_service_order_status(id, status, note)` para cambiar estado y adjuntar nota al
    historial en una sola llamada.
  - Corregido en el camino: un error real de sintaxis (`UPDATE ... ORDER BY ... LIMIT`, inválido en
    Postgres) — detectado por el rollback transaccional de `supabase db push`, sin dejar estado
    parcial.
- UI: `service-orders-board.ts` (tablero por estado, `resource()` + `computed()`),
  `service-order-form.ts` (alta con cliente existente o creación inline), `service-order-detail.ts`
  (detalle + cambio de estado + línea de tiempo desde `order_status_history`). Nuevo `core/layout/
  shell.ts` con navegación (Clientes/Órdenes/Cerrar sesión) y `core/profiles/profiles.service.ts`
  (para el selector de técnico asignado).
- `database.types.ts` regenerado tras la migración (incluye las nuevas tablas y el RPC).
- **Verificado en navegador real** contra el Supabase real: login → tablero vacío → alta con
  cliente nuevo inline → detalle creado (folio correcto) → timeline inicial → cambio de estado con
  nota → timeline actualizado → vuelta al tablero. Datos de prueba limpiados al terminar.

### Cierre de sesión
- `docs/03-ROADMAP-FASES.md`: Fase 1 marcada como "núcleo completado"; nueva **Fase 1.5** con
  fotos/pagos/log financiero (lo que quedó fuera de esta tanda), antes de Fase 2.
- **Verificado en todo momento:** `npm run build` ✓, `npm test` (Vitest) ✓, `npm run lint` ✓.

## En progreso / a medio hacer
- Nada a medias. El núcleo de Fase 1 (Clientes + Orden de Servicio con máquina de estados e
  historial) está completo, verificado y aprobado por Oscar en los tres checkpoints.

## Siguiente paso concreto
- **Fase 1.5** (cuando Oscar la apruebe): empezar por la migración de **fotos del equipo**
  (`service_order_photos` + bucket de Storage con políticas por `business_id`) usando la skill
  `supabase-migration` como base, luego la UI de subida en `service-order-detail.ts`. Después:
  `payments` (registro de pago mínimo contra una OS) y `financial_entries` (log ingreso/gasto).
  Detalle de columnas en `docs/02-MODELO-DATOS.md` → "Tablas pendientes (Fase 1 restante)" (a
  precisar al iniciar esa fase, igual que se hizo con `customers`/`service_orders`).
- Antes de tocar la BD: leer `docs/02-MODELO-DATOS.md`. Usar las skills `supabase-migration` y
  `angular-feature` para mantener el patrón ya establecido.

## Decisiones tomadas (resumen, detalle en docs/decisiones/)
- Multi-tenant desde el día uno; modelo **1 usuario → 1 negocio** (`profiles`), N:N diferido. [0001]
- Stack Angular 22 + Supabase + Vercel; npm como package manager. [0002]
- La Orden de Servicio es la entidad central (fases del ciclo de vida, no módulos). [0003]
- Sin Nx por ahora (reevaluar en Fase 7). [0004]
- PrimeNG 21 sobre Angular 22 con `legacy-peer-deps` + cdk 22, temporal. [0005]
- **Esquema de BD en inglés sin excepción**, UI en español. [0006]
- Soft-delete reforzado a nivel de BD (sin GRANT de DELETE) en `customers`; mismo principio
  aplicado a `service_orders` (se cancela, no se borra).
- Historial de OS escrito únicamente por trigger `SECURITY DEFINER`, nunca por el cliente.
- MCP: Supabase y Context7 conectados; GitHub MCP pendiente de credenciales si se necesita.

## Bloqueos / dudas para Oscar
1. **Credenciales para GitHub MCP** (opcional, no bloqueante). Comandos en
   `docs/04-CONVENCIONES.md` si se quiere activar más adelante.
2. **Inyección de env en Vercel.** Hoy la anon key (pública) vive en `src/environments/
   environment.development.ts`. Para producción, decidir si Vercel la inyecta en build o se deja
   commiteada (es pública, RLS la protege). Pendiente de pulir antes de un primer deploy real.
3. **Bundle initial ~695kB** (presupuesto subido a 800kB en `angular.json` para no generar ruido).
   Normal por incluir `supabase-js` real; revisar si crece mucho más con Fase 1.5/Fase 2.
4. **Datos de prueba**: todas las pruebas E2E de esta sesión crearon negocios/usuarios/clientes de
   prueba en el Supabase real y se limpiaron al terminar (verificado con `businesses: []` al
   cierre). El proyecto remoto queda sin datos sintéticos ni reales.
