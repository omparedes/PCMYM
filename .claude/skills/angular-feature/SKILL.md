---
name: angular-feature
description: Crea una feature CRUD signal-first en el CRM Angular 22 de PCMYM (componente standalone + servicio Supabase + Signal Form + signal store). Úsalo al añadir o ampliar un módulo de dominio en apps/crm.
---

# Skill: angular-feature (patrón signal-first PCMYM)

Una feature vive en `apps/crm/src/app/features/<dominio>/`. Stack: Angular 22 standalone, OnPush,
zoneless, **Signal Forms** (`@angular/forms/signals`), **Resource API** para lectura, Tailwind
(+ PrimeNG cuando publique soporte oficial para Angular 22 — ver ADR 0005; mientras tanto, listas y
tablas se construyen con HTML nativo + Tailwind, no con `p-table`).

**Nombres de dominio (tablas, campos, rutas) en inglés** — ver ADR 0006. Las etiquetas visibles al
usuario (labels, botones, mensajes) van en español, normalmente en un mapa de traducción separado
del modelo (p.ej. `STATUS_LABELS` para un enum de estado).

## Reglas
- `ChangeDetectionStrategy.OnPush` y componentes **standalone** (sin NgModules).
- **Nada de Reactive Forms clásico ni NgRx clásico** (prohibidos sin ADR).
- Acceso a datos: encapsula Supabase en un **servicio por feature**; los componentes no llaman al
  cliente directamente.
- Lectura de datos remotos con `resource()` / `httpResource()`. Escritura vía métodos del servicio.
- Estado local con signals; estado compartido entre componentes con `signalStore` (`@ngrx/signals`)
  solo si se justifica.
- Nombres de archivo sin sufijo de tipo (convención Angular 20+): `customers-list.ts`, no
  `customers-list.component.ts`.

## Estructura sugerida de una feature
```
features/<domain>/
  <domain>.service.ts     # acceso a Supabase (CRUD), tipado
  <domain>.models.ts      # tipos del dominio (en inglés) + mapas de etiquetas en español
  <domain>-list.ts        # listado (tabla Tailwind nativa + Resource API)
  <domain>-form.ts        # alta/edición (Signal Forms)
  <domain>.routes.ts      # rutas de la feature (loadComponent)
```

## Signal Forms (patrón verificado en Angular 22)
```ts
import { form, required, email } from '@angular/forms/signals';

protected readonly model = signal({ name: '', email: '' });
protected readonly f = form(this.model, (path) => {
  required(path.name);
  email(path.email);
});
// Estado del form: this.f().valid(), this.f().touched(), etc.
```
En el template, enlaza inputs con la directiva `FormField` (selector `[formField]`):
```html
<input type="text" [formField]="f.name" />
```
Importa `FormField` desde `@angular/forms/signals` en `imports` del componente.

## Servicio Supabase (patrón)
```ts
import { Injectable } from '@angular/core';
import { supabase } from '../../core/supabase/supabase.client';

@Injectable({ providedIn: 'root' })
export class CustomersService {
  // business_id lo impone RLS; no hace falta filtrarlo manualmente en el cliente.
  async list() { return supabase.from('customers').select('*'); }
  async create(input: NewCustomer) { return supabase.from('customers').insert(input).select().single(); }
}
```

## Definition of Done de una feature
Rutas con `loadComponent`; CRUD funcionando contra Supabase con RLS; Signal Forms validando;
tests Vitest verdes; sin claves privadas en el cliente.
