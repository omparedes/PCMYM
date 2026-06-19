# ADR 0002 — Stack tecnológico

- **Estado:** Aceptada
- **Fecha:** 2026-06-19

## Decisión
- **Frontend:** Angular 22 — signal-first, standalone, **zoneless**, **Signal Forms**, OnPush por
  defecto, **Resource API** para datos. Tests con **Vitest** (integrado en el builder de Angular 22).
- **UI:** Tailwind CSS + PrimeNG (app pesada en tablas, filtros, formularios y estados).
- **Estado:** signals nativos; `@ngrx/signals` (signalStore) solo si hace falta store compartido.
  **NgRx clásico y Reactive Forms quedan prohibidos sin un ADR que los justifique.**
- **Backend:** Supabase (Postgres + Auth + Storage + Realtime + Edge Functions + pg_cron).
- **Deploy:** Vercel (SPA estática, sin SSR).
- **Repos/CI:** GitHub. **Automatización:** n8n. **IA:** API de Claude en Edge Functions (server-side).
- **Package manager:** npm. **Runtime:** Node 24.

## Justificación
- Angular signal-first + zoneless reduce complejidad de change detection y encaja con datos
  reactivos de Supabase Realtime.
- Supabase da Auth + Postgres + Storage + Realtime + Functions en una sola plataforma con RLS, ideal
  para multi-tenant con poco backend propio.
- Vercel sin SSR: la app es una herramienta interna tras login; no necesita SEO ni render server.
- PrimeNG cubre el grueso de UI de datos; Tailwind el layout.

## Consecuencias
- **+** Menos backend que mantener; seguridad en la BD.
- **−** Angular 22, PrimeNG 21 y Tailwind v4 son recientes (post-corte de varios modelos): verificar
  APIs nuevas con docs en vivo / CLI real, no asumir patrones viejos.
- **−** Dependencia de Supabase como plataforma (lock-in parcial mitigado por ser Postgres estándar).

## Notas de implementación (Fase 0)
- Vitest ya viene como runner por defecto del `ng new` de Angular 22.
- Integración PrimeNG + Tailwind v4 por capas CSS con orden `tailwind, primeng` y plugin
  `tailwindcss-primeui`; preset **Aura** vía `providePrimeNG`.
