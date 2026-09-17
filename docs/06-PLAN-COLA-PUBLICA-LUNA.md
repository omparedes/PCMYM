# Plan de implementación para Luna: cola pública automática

Estado: plan listo para ejecución. No se ha implementado ni migrado esta funcionalidad.
Objetivo: que el cliente consulte la carga de trabajo de la tienda antes de llevar su equipo,
sin obligar a Oscar a mantener una segunda lista. Los datos se derivan de la OS.

## 1. Preparación y alcance

Leer primero `AGENTS.md`, `docs/ESTADO.md` y este plan. Antes de diseñar la migración leer
`docs/02-MODELO-DATOS.md`. Revisar `git status`, rama e historial; el handoff contiene notas
históricas que pueden estar desactualizadas. Preservar cualquier cambio existente.

Trabajar en `feat/public-service-queue` desde la versión local actual del proyecto, conservando
el cotizador existente. No hacer reset ni cambiar a una versión antigua de main para empezar.
No modificar Deltron, proformas, inventario ni automatizaciones Hermes en esta tarea.
No crear tareas paralelas ni cambiar de modelo. Ejecutar las etapas en orden.

Hallazgos del código revisado:
- `ServiceOrderWorkType` ya contiene `formatting`, `repair`, `parts_replacement`, `warranty`.
  Reutilizar Formateo; añadir únicamente `maintenance` al catálogo de trabajos.
- `equipment_type` es texto libre, no un enum: normalizar laptop/notebook/portátil y PC/desktop/
  computadora de escritorio. No adivinar el tipo de los equipos desconocidos.
- `waiting_parts → repairing` ya está permitido tanto en UI como en PostgreSQL: conservarlo.
- El seguimiento individual público ya existe. La cola debe tener un contrato público distinto.
- Cambios de estado usan `change_service_order_status`; también existen actualizaciones directas
  de tipos de trabajo. La sincronización de tiempos debe cubrir ambas vías en PostgreSQL.

## 2. Reglas aprobadas por Oscar

| Trabajo | Estimación predeterminada |
| --- | ---: |
| Diagnóstico de reparación electrónica | 20 minutos |
| Reparación electrónica derivada al taller externo | 0 minutos en tienda |
| Formateo | 60 minutos |
| Formateo con respaldo de información | 120 minutos totales |
| Mantenimiento laptop | 60 minutos |
| Mantenimiento PC de escritorio | 120 minutos |
| Cambio de repuesto en tienda | 60 minutos |

- Respaldo añade 60 minutos exclusivamente a Formateo; no es otro trabajo independiente.
- La selección de trabajo, el equipo y el estado bastan en el flujo habitual.
- Permitir una ampliación excepcional del tiempo desde el detalle de la OS (por ejemplo +30 min).
- Diagnóstico comienza al entrar en `diagnosing`; trabajo local comienza al entrar en `repairing`.
- Derivados, `waiting_parts`, `ready`, `delivered` y `cancelled` no consumen tiempo local activo.
- Esperando repuesto tampoco cuenta como pendiente local hasta que se retome.
- El vencimiento de una estimación no cambia estados, no deriva, no completa trabajos y no hace
  que desaparezca un equipo. Mostrar «Está tomando más tiempo de lo estimado».
- Varios equipos pueden estar en proceso simultáneamente.
- Nunca publicar datos personales ni detalles identificables de las órdenes.

## 3. Decisiones concretas para esta V1

Estas decisiones resuelven detalles técnicos que no fijó Oscar; implementarlas y documentarlas.

**Reparación externa:** conservar los estados canónicos de OS. Añadir una ubicación/indicador
persistente `service_location` (`in_store` / `external_workshop`). Al entrar en `repairing`,
una OS de reparación electrónica sin trabajo local seleccionado pasa automáticamente a externo.
El mismo botón habitual debe decir «Derivar a reparación» en ese caso y mostrar dónde está el equipo.
No cambiar la ubicación histórica de las OS existentes por inferencia en la migración.
Para combinaciones `repair` + formateo/mantenimiento/repuesto, conservar atención local hasta que
se use la acción explícita de derivar: no ocultar trabajo local porque también contiene `repair`.
Permitir retorno explícito a tienda, auditado, sin alterar la OS ni crear otra orden.

**Combinaciones:** trabajos locales distintos se suman una sola vez; respaldo está incluido
en el total de formateo. `repair` aporta 20 min a la etapa diagnóstica, no otros 20 en reparación.
Si una OS local sin `repair` usa diagnóstico, asignar también 20 min a esa etapa; al finalizar
diagnóstico, descontarlo definitivamente y conservar solo los trabajos locales por hacer.
Una OS pendiente solo de formateo/repuesto/mantenimiento no debe exigir un diagnóstico ficticio:
permitir `pending → repairing` para trabajo local conocido, tanto en SQL como en UI.
Garantía por sí sola no determina duración: sin trabajo adicional, marcar estimación pendiente.
Un equipo de tipo desconocido con mantenimiento tampoco tendrá duración inventada.

**Esperas y pausas:** guardar tiempo activo acumulado por etapa. Al pasar a `waiting_parts` o
externo, parar el contador; al retomar la misma etapa, continuar el saldo, sin descontar la pausa.
No usar `updated_at` como inicio: editar una nota no reinicia el contador. No duplicar etapas
ni reiniciar tiempos al repetir un RPC o refrescar la página.
Al pasar de diagnóstico a trabajo local, iniciar el presupuesto de esa etapa, sin contar otra vez
los minutos del diagnóstico. Los cambios de duración conservan lo ya consumido.

**Orden:** FIFO por recepción (`received_at`, luego id), sin arrastre ni prioridades manuales V1.
No cambiar el comportamiento de prioridad de las OS; aquí mostrar el orden estimado habitual.

**Espera global:** no prometer una hora de cita. Con todos los tiempos conocidos, presentar
una banda: desde el mayor tiempo restante de las atenciones activas hasta ese tiempo más la suma
de las pendientes. Ejemplo: activas de 20 y 60 min, pendientes de 60 y 120 → banda 60–240 min.
Etiquetar «Espera orientativa para iniciar un nuevo trabajo; depende del avance y trabajos en paralelo».
Es una banda heurística, no una garantía ni agenda. No sumar las atenciones activas entre sí.
Si hay una activa excedida, pendiente sin duración o reloj inicial desconocido, omitir la banda
numérica y mostrar cantidades y «Tiempo por confirmar». Nunca anunciar disponibilidad inmediata
solo porque el contador llegó a cero. Sin equipos mostrar «Sin trabajos locales en cola».
Sin horario configurado no afirmar «Taller abierto» ni convertir duraciones en horas de llegada.

## 4. Etapa A: datos y sincronización automática

Entregable: migración incremental, contratos y pruebas SQL. No editar migraciones ya aplicadas.

- Ampliar el CHECK de `work_types` con `maintenance`, conservando todos los valores existentes.
- Añadir respaldo de información condicionado a `formatting`; al desmarcar formateo limpiar el
  respaldo de forma consistente en servidor y UI.
- Añadir ubicación y estado persistente del reloj: etapa, inicio, minutos activos acumulados,
  estimación/ajuste. Elegir columnas en OS o una tabla 1:1 si simplifica; no crear otro catálogo
  de órdenes ni una cola manual. Documentar los nombres definitivos en el modelo de datos.
- Centralizar reglas de duración y exclusión en SQL; frontend consume resultado, no mantiene
  otra interpretación independiente. Usar hora del servidor y transacciones/bloqueo de OS.
- Auditar inicio/pausa/retorno/derivación/ajuste sin exponer ese historial públicamente.
- Para OS anteriores: aprovechar último evento válido de estado si permite reconstrucción fiable;
  si no, dejar reloj desconocido. No poner `now()` a todas ni anunciar todas como recién iniciadas.
- Cualquier tabla nueva lleva `business_id` y RLS desde la primera migración. Validar FK/relaciones
  del mismo tenant y restringir parámetros de tiempo (finitos, positivos y rango razonable).
- Mantener las validaciones de entrega por comprobante, historial, pagos, repuestos y webhooks.

## 5. Etapa B: contrato público mínimo

Entregable: RPC público dedicado, enlace por negocio y pruebas con rol `anon`.

- Ruta propuesta `/cola/:token`, token aleatorio por negocio distinto de los tokens de OS.
  Configuración única para activar/desactivar publicación y copiar/rotar enlace. Default desactivado.
- RPC `get_public_service_queue(p_token uuid)` de solo lectura, con búsqueda de negocio explícita,
  proyección cerrada y `search_path` fijo. Si necesita SECURITY DEFINER, revisar todo el contrato:
  no confiar en RLS implícito del dueño ni aceptar un `business_id` arbitrario como autorización.
- Mantener tablas OS/clientes privadas. No otorgar SELECT de tablas completas a `anon` ni usar
  Realtime público sobre `service_orders`.
- Devolver solo nombre público del taller, conteos, categorías genéricas («Laptop», «PC», «Equipo»),
  trabajos, fase pública, duración/restante/indeterminada y orden relativo.
- No devolver nombres de cliente, teléfonos, marcas/modelos/series, UUID/folio de OS, tokens de
  seguimiento, fallas, diagnósticos textuales, notas, pagos, direcciones o archivos.
- Publicar separados pendientes y en proceso; derivados/esperando repuesto se pueden contar
  aparte como «Fuera de la cola local», sin detallar el taller asociado.
- Token inválido, desactivado o de negocio inactivo → respuesta vacía/no disponible.
- Diferenciar `generated_at` (consulta) de `last_activity_at` (último cambio operativo real);
  refrescar la página no debe aparentar que Oscar actualizó una orden.
- Acotar tamaño de respuesta y mantener conteos globales correctos si se limita la lista.

## 6. Etapa C: interfaz interna y pública

- En alta/detalle/filtros de OS: mostrar Mantenimiento; reutilizar Formateo; respaldo visible solo
  al seleccionar Formateo. Mostrar estimación calculada sin pedir minutos obligatoriamente.
- En detalle: tiempo de etapa, pausa/derivación, ajuste excepcional y acción de retorno cuando
  corresponda. Conservar nombres comprensibles según el trabajo («Formateando», «En mantenimiento»).
- Añadir copiar enlace público y control de publicación por negocio en una ubicación interna simple.
- Página pública móvil: conteos, «En atención», «En espera», tiempos orientativos y última actividad.
  Consultar el RPC con Resource API cada 60 segundos mientras la pestaña esté visible; limpiar
  temporizador al salir. No escribir en BD cada minuto ni usar IA, cron o n8n para los contadores.
- Si falla la actualización, mostrar fallo/datos anteriores y su fecha; no mostrar cola vacía.
- Mostrar «Consultar antes de traer el equipo; este enlace no reserva turno».
- Reusar el estilo Angular/Tailwind/PrimeNG existente, sin nuevas librerías innecesarias.

## 7. Etapa D: aceptación obligatoria

Pruebas automáticas de lógica y SQL con reloj controlado/datos sintéticos:
1. Reparación pendiente → 20 min; diagnóstico durante 5 min → quedan 15; derivación → 0 local.
2. Cumplir 20 min sin cambiar estado conserva el equipo activo y vuelve indeterminada la espera.
3. Formateo → 60; con respaldo → 120, nunca 180 ni respaldo duplicado.
4. Laptop mantenimiento → 60; PC → 120; desconocido/garantía sola → por confirmar.
5. Repuesto: consumir 15 de 60, pausar 2 horas y retomar → quedan 45, no 0 ni 60.
6. Combinación formateo con respaldo + mantenimiento laptop → 180 min locales; agregar `repair`
   no deriva automáticamente esa combinación ni duplica el diagnóstico al pasar de etapa.
7. Dos activas 20/60 y dos pendientes 60/120 → banda 60–240; una excedida → tiempo por confirmar.
8. Editar notas, consultas repetidas y reintentos no reinician relojes ni duplican eventos.
9. Dos negocios y rol `anon`: token A solo devuelve proyección pública de A; no permite leer
   tablas base ni editar datos. Usuario A no puede cambiar reloj/configuración del negocio B.
10. Negocio desactivado/token rotado → enlace anterior deja de servir. No se filtran datos privados.
11. Estados `ready`, `delivered`, `cancelled`, `waiting_parts` y externo quedan fuera del cálculo.
12. OS histórica sin reloj fiable y fallo de red nunca se convierten en «disponible ahora».

Desde `apps/crm`: ejecutar `npm test`, `npm run lint`, `npm run build`.
Aplicar la migración al Supabase enlazado dentro de la autorización de implementación, verificando
antes el proyecto destino y migraciones pendientes. No usar `db reset` en remoto. Si el entorno
requiere aprobación, usar el mecanismo de permisos; informar cualquier bloqueo real.
Regenerar tipos desde BD, ejecutar `supabase db lint --linked` y pruebas SQL en transacción/rollback.
No usar OS reales como fixtures. Probar UI con datos sintéticos y describir cualquier comprobación
visual que no se haya podido realizar. No declarar terminado si falta migración o validación.

## 8. Handoff y control de alcance

Actualizar `docs/ESTADO.md`, `docs/02-MODELO-DATOS.md` y roadmap. Reportar archivos relevantes,
reglas implementadas, pruebas, migraciones aplicadas y pendientes. Commit/push/despliegue solo
si la solicitud de ejecución los incluye. Mantener la cola desactivada hasta que Oscar la habilite.
No implementar reservas, avisos automáticos, calendarios laborales ni estadísticas predictivas.
Si el código contradice este plan, resolver adaptaciones técnicas conservando el comportamiento
descrito; consultar solo ante una decisión de negocio imprescindible, no por elecciones rutinarias.
