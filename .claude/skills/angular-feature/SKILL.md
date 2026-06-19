---
name: angular-feature
description: Crea una feature CRUD signal-first en el CRM Angular 22 de PCMYM (componente standalone + servicio Supabase + Signal Form + signal store). Úsalo al añadir o ampliar un módulo de dominio en apps/crm.
---

# Skill: angular-feature (patrón signal-first PCMYM)

Una feature vive en `apps/crm/src/app/features/<dominio>/`. Stack: Angular 22 standalone, OnPush,
zoneless, **Signal Forms** (`@angular/forms/signals`), **Resource API** para lectura, PrimeNG + Tailwind.

## Reglas
- `ChangeDetectionStrategy.OnPush` y componentes **standalone** (sin NgModules).
- **Nada de Reactive Forms clásico ni NgRx clásico** (prohibidos sin ADR).
- Acceso a datos: encapsula Supabase en un **servicio por feature**; los componentes no llaman al
  cliente directamente.
- Lectura de datos remotos con `resource()` / `httpResource()`. Escritura vía métodos del servicio.
- Estado local con signals; estado compartido entre componentes con `signalStore` (`@ngrx/signals`)
  solo si se justifica.
- Nombres de archivo sin sufijo de tipo (convención Angular 20+): `clientes-list.ts`, no
  `clientes-list.component.ts`.

## Estructura sugerida de una feature
```
features/<dominio>/
  <dominio>.service.ts     # acceso a Supabase (CRUD), tipado
  <dominio>.models.ts      # tipos del dominio
  <dominio>-list.ts        # listado (PrimeNG Table + Resource API)
  <dominio>-form.ts        # alta/edición (Signal Forms)
  <dominio>.routes.ts      # rutas de la feature (loadComponent)
```

## Signal Forms (patrón verificado en Angular 22)
```ts
import { form, required, email } from '@angular/forms/signals';

protected readonly model = signal({ nombre: '', email: '' });
protected readonly f = form(this.model, (path) => {
  required(path.nombre);
  email(path.email);
});
// Estado del form: this.f().valid(), this.f().touched(), etc.
```
En el template, enlaza inputs con la directiva `FormField`:
```html
<input pInputText [formField]="f.nombre" />
```
Importa `FormField` desde `@angular/forms/signals` en `imports` del componente.

## Servicio Supabase (patrón)
```ts
import { Injectable } from '@angular/core';
import { supabase } from '../../core/supabase/supabase.client';

@Injectable({ providedIn: 'root' })
export class ClientesService {
  // negocio_id lo impone RLS; no hace falta filtrarlo manualmente en el cliente.
  async list() { return supabase.from('clientes').select('*'); }
  async create(input: NuevoCliente) { return supabase.from('clientes').insert(input).select().single(); }
}
```

## Definition of Done de una feature
Rutas con `loadComponent`; CRUD funcionando contra Supabase con RLS; Signal Forms validando;
tests Vitest verdes; sin claves privadas en el cliente.
