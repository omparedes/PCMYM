# 00 — Visión y alcance

## Problema
Los talleres de venta y servicio técnico de computadoras gestionan equipos, diagnósticos,
reparaciones, repuestos, clientes y cobros con herramientas dispersas (papel, WhatsApp, Excel).
Se pierde trazabilidad del equipo, el cliente no sabe en qué estado está su reparación, y no hay
datos para decidir.

## Producto
PCMYM centraliza la operación del taller alrededor de la **Orden de Servicio (OS)**: desde que
entra un equipo hasta que se entrega, todo queda registrado y trazable. Marca del negocio piloto:
**PCMYM**.

## Diferenciador / objetivo de negocio
Diseñado **multi-tenant desde el día uno**: no es un software para un solo taller, sino un
producto **replicable y vendible** a otros negocios del mismo rubro. Cada negocio (tenant) opera
aislado sobre la misma plataforma.

## Usuarios
- **Dueño / administrador del taller:** ve todo del negocio, reportes, finanzas.
- **Técnico:** gestiona órdenes asignadas, registra diagnósticos y reparaciones.
- **Recepción / mostrador:** crea órdenes, registra clientes, cobra.
- **Cliente final** (fase 3): consulta el estado de su equipo por un enlace público con token,
  sin login.

## Principios de producto
1. **La OS es el centro.** Recepción, diagnóstico, reparación y entrega son fases de una misma OS.
2. **Registrar desde el día uno.** El MVP (Fase 1) ya debe permitir capturar información real del
   taller, aunque falten reportes y automatizaciones.
3. **Trazabilidad total.** Cada cambio de estado de una OS queda en un historial.
4. **Aislamiento entre negocios.** La seguridad multi-tenant (RLS) es un requisito, no una mejora.

## Fuera de alcance del MVP (Fase 1)
Presupuestos formales, reportes avanzados, notificaciones automáticas, portal del cliente,
base de conocimiento, IA e inventario completo. Ver fases en [`03-ROADMAP-FASES.md`](03-ROADMAP-FASES.md).
