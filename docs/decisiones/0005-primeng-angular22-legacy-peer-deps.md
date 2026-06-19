# ADR 0005 — PrimeNG 21 sobre Angular 22 con legacy-peer-deps (temporal)

- **Estado:** Aceptada (temporal — revisar cuando PrimeNG soporte Angular 22)
- **Fecha:** 2026-06-19

## Contexto
El stack fija **Angular 22** (salió 2026-06-03) y **PrimeNG** como definitivos. Al hacer el
bootstrap, la última versión publicada de PrimeNG (21.1.9) declara peer dependencies sobre
**Angular 21** (`@angular/cdk@^21` → `@angular/common@^21`). No existe aún build de PrimeNG para
Angular 22. `npm install` falla con `ERESOLVE`.

## Decisión
Mantener Angular 22 + PrimeNG 21 y desbloquear la instalación:
- `apps/crm/.npmrc` con `legacy-peer-deps=true` (instalación reproducible para todos los agentes/estaciones).
- Fijar `@angular/cdk@22` para que PrimeNG use el CDK alineado con Angular 22 en runtime.

Verificado en Fase 0: `npm run build`, `npm test` (Vitest) y `npm run lint` pasan; el login
placeholder (PrimeNG + Tailwind + Signal Forms) compila y renderiza.

## Consecuencias
- **+** Se respeta el stack definitivo sin downgrade de Angular.
- **+** Reversión trivial: cuando PrimeNG publique soporte Angular 22, subir la versión y eliminar
  `.npmrc` (o la línea legacy-peer-deps).
- **−** Combinación no soportada oficialmente: posible incompatibilidad puntual en algún componente
  de PrimeNG; mitigado porque en Fase 0 no hay features reales todavía.
- **−** `legacy-peer-deps` relaja la resolución de TODAS las dependencias, no solo PrimeNG; revisar
  al añadir librerías nuevas.

## Disparador de revisión
Publicación de PrimeNG con peer `@angular/core@^22` (o build v22). Acción: bump de `primeng` y
`@primeuix/themes`, quitar el flag, re-verificar build/test/lint.
