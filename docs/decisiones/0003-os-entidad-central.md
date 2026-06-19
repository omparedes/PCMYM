# ADR 0003 — La Orden de Servicio (OS) es la entidad central

- **Estado:** Aceptada
- **Fecha:** 2026-06-19

## Contexto
El flujo del taller es: recibir un equipo → diagnosticar → reparar → entregar. La tentación es
modelar cada paso como un módulo independiente (Recepción, Diagnóstico, Reparación, Entrega), pero
eso fragmenta la información del mismo equipo y rompe la trazabilidad.

## Decisión
La **Orden de Servicio (OS)** es la entidad corazón del sistema. Recepción, diagnóstico, reparación
y entrega son **fases del ciclo de vida de la MISMA OS**, no módulos separados.
- La OS tiene una **máquina de estados**:
  `pendiente → en_diagnostico → en_reparacion → esperando_repuesto → listo → entregado`.
- **Cada cambio de estado se registra** en una tabla de historial (`os_historial`) con estado
  anterior, estado nuevo, usuario, nota y timestamp → trazabilidad completa.
- Clientes, fotos del equipo, pagos y movimientos financieros se relacionan con la OS.

## Consecuencias
- **+** Una sola fuente de verdad por equipo; historial auditable; base natural para el seguimiento
  público del cliente (Fase 3) y reportes (Fase 2).
- **+** La UI puede ser un tablero por estado (kanban) alimentado por Realtime.
- **−** La lógica de transiciones debe validarse (no saltar estados inválidos); se centraliza en la
  capa de servicio y/o en constraints/funciones de Postgres.

## Pendiente (se concreta en Fase 1)
Columnas exactas de `ordenes_servicio`, reglas de transición permitidas y si las transiciones se
validan en la app, en la BD (trigger/función) o ambas.
