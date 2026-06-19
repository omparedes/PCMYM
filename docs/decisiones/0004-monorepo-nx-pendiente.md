# ADR 0004 — Monorepo Nx (PENDIENTE / diferida)

- **Estado:** Pendiente (a decidir en Fase 7)
- **Fecha:** 2026-06-19

## Contexto
El workspace `C:\Github\PCMYM` albergará varios proyectos (CRM, web pública, automatizaciones).
Una opción es gestionarlos con **Nx** (monorepo con grafo de dependencias, cache, generadores).
Para el MVP, Nx añade complejidad sin beneficio claro: hoy solo hay una app Angular.

## Decisión (provisional)
**No** adoptar Nx ahora. Usar estructura ligera de carpetas (`apps/`, `supabase/`, `automation/`).
**Reevaluar la migración a Nx en Fase 7** (producto vendible), cuando existan múltiples apps/libs
compartidas (p. ej. UI compartida, SDK de tenant, branding) y el coste de coordinación lo justifique.

## Disparadores para reconsiderar
- Aparición de una segunda app que comparta código con `crm` (web pública, panel de admin de tenants).
- Necesidad de librerías compartidas versionadas.
- Tiempos de CI que se beneficien del cache/affected de Nx.

## Consecuencias
- **+** Menos complejidad y configuración durante el MVP.
- **−** Si se migra tarde, reorganizar imports y rutas tiene coste; mitigado manteniendo límites
  limpios entre `core/shared/features` desde ya.
