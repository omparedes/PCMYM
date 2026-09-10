import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { SupplierCatalogService } from './supplier-catalog.service';
import { SUPPLIER_COMPONENT_CATEGORY_LABELS, type SupplierProduct } from './proformas.models';
import { specs } from './pc-compatibility';
import { SPECIFICATION_FIELDS, specificationValueLabel } from './supplier-specifications';

@Component({
  selector: 'app-supplier-spec-editor', imports: [FormField], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rounded-xl border border-blue-200 bg-white p-5 mb-4" aria-label="Ficha técnica del producto">
      <div class="flex justify-between gap-3"><div><h3 class="font-bold">Ficha técnica: {{ product().name }}</h3>
        <p class="text-xs text-slate-500">Grupo Deltron: {{ product().category }} · {{ product().supplier_code }}</p></div>
        <button type="button" (click)="closed.emit()" aria-label="Cerrar ficha">✕</button></div>
      <p class="text-sm my-3">Los datos vacíos requieren revisión. Tus correcciones se conservan al importar otro HTML.</p>
      <label class="block text-xs font-bold mb-3">Clasificación manual
        <select [formField]="specForm['component_category']" class="block border rounded p-2 w-full">
          <option value="">Conservar clasificación actual</option>
          @for (item of categories; track item.key) { <option [value]="item.key">{{ item.label }}</option> }
          <option value="peripheral">Periférico / accesorio</option><option value="laptop">Laptop</option>
          <option value="monitor">Monitor</option><option value="desktop">Computadora completa</option>
          <option value="unclassified">Por clasificar</option>
        </select>
      </label>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        @for (field of fields(); track field.key) {
          <label class="text-xs font-semibold" [for]="'spec-' + field.key">{{ field.label }}
            @if (field.options) {
              <select [id]="'spec-' + field.key" [formField]="specForm[field.key]" class="block w-full border rounded p-2 mt-1">
                <option value="">Sin verificar</option>
                @for (value of field.options; track value) { <option [value]="value">{{ valueLabel(value) }}</option> }
              </select>
            } @else { <input [id]="'spec-' + field.key" [formField]="specForm[field.key]" type="text" class="block w-full border rounded p-2 mt-1" /> }
            <span class="block text-slate-500 font-normal mt-1">{{ field.hint }}</span>
          </label>
        }
      </div>
      @if (error()) { <p role="alert" class="text-red-600 my-2 text-sm">{{ error() }}</p> }
      <div class="flex gap-3 mt-4"><button type="button" class="bg-blue-700 text-white rounded px-4 py-2" [disabled]="saving()" (click)="save()">Guardar ficha</button>
        <button type="button" class="border rounded px-4 py-2" [disabled]="saving()" (click)="restore()">Restablecer datos del HTML</button></div>
    </section>
  `,
})
export class SupplierSpecEditor {
  readonly product = input.required<SupplierProduct>();
  readonly saved = output<SupplierProduct>(); readonly closed = output<void>();
  private readonly catalog = inject(SupplierCatalogService);
  protected readonly categories = Object.entries(SUPPLIER_COMPONENT_CATEGORY_LABELS).filter(([key]) => key !== 'other').map(([key, label]) => ({ key, label }));
  protected readonly model = signal<Record<string, string>>({});
  protected readonly specForm = form(this.model);
  protected readonly error = signal(''); protected readonly saving = signal(false);
  protected readonly valueLabel = specificationValueLabel;
  private original: Record<string, string> = {};
  protected readonly fields = computed(() => {
    const kind = this.model()['component_category'] || this.product().component_category;
    return SPECIFICATION_FIELDS.filter((f) => !f.kinds || f.kinds.includes(kind));
  });
  constructor() {
    effect(() => {
      const p = this.product(); const data = specs(p);
      this.original = { ...Object.fromEntries(SPECIFICATION_FIELDS.map((f) => [f.key, data[f.key] ?? ''])), component_category: '' };
      this.model.set({ ...this.original });
    });
  }
  protected async save(): Promise<void> {
    const model = this.model();
    for (const field of this.fields()) {
      if (field.numeric && model[field.key] && !(Number(model[field.key]) > 0)) {
        this.error.set(field.label + ': ingresa un número mayor que cero'); return;
      }
    }
    const overrides = { ...(this.product().specification_overrides as Record<string, string | null>) };
    for (const field of this.fields()) {
      if (model[field.key] !== this.original[field.key]) overrides[field.key] = model[field.key]?.trim() || null;
    }
    const kind = model['component_category'];
    if (kind) {
      const component = this.categories.some((c) => c.key === kind);
      overrides['component_category'] = component ? kind : 'other';
      overrides['product_type'] = component ? 'component' : kind === 'unclassified' ? 'other' : kind;
      overrides['catalog_group'] = component ? 'pc_parts' : ({ peripheral: 'peripherals', laptop: 'laptops', monitor: 'monitors' } as Record<string, string>)[kind] ?? 'other';
    }
    await this.persist(overrides);
  }
  protected async restore(): Promise<void> { await this.persist({}); }
  private async persist(overrides: Record<string, string | null>): Promise<void> {
    this.saving.set(true); this.error.set('');
    try { this.saved.emit(await this.catalog.setSpecifications(this.product().id, overrides)); }
    catch { this.error.set('No se pudo guardar la ficha. Revisa la conexión e inténtalo nuevamente.'); }
    finally { this.saving.set(false); }
  }
}
