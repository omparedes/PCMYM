import { ChangeDetectionStrategy, Component, computed, effect, inject, resource, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SupplierSpecEditor } from './supplier-spec-editor';
import { checkBuild, checkCandidate, COMPATIBILITY_LABELS, specs, values } from './pc-compatibility';
import { SPECIFICATION_FIELDS, specificationValueLabel } from './supplier-specifications';

import { SupplierCatalogService, type SupplierImportPreview, type SupplierImportResult } from './supplier-catalog.service';
import { SalesQuotesService } from './sales-quotes.service';
import {
  quoteItemTotal,
  roundQuotePrice,
  SUPPLIER_CATALOG_GROUP_LABELS,
  SUPPLIER_COMPONENT_CATEGORY_LABELS,
  SUPPLIER_SEARCH_SUGGESTIONS,
  salesQuoteStatusLabel,
  supplierCatalogGroupLabel,
  supplierComponentCategoryLabel,
  supplierProductTypeLabel,
  type SalesQuoteItemDraft,
  type SalesQuoteEditorData,
  type SalesQuoteStatus,
  type SupplierCatalogGroup,
  type SupplierComponentCategory,
  type SupplierProduct,
} from './proformas.models';

interface SelectedProduct {
  key: string;
  buildKey: string | null;
  product: SupplierProduct;
  quantity: number;
  frozenPricing?: { unitCostUsd: number; unitCostPen: number; unitPricePen: number };
}

@Component({
  selector: 'app-proformas-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, DecimalPipe, SupplierSpecEditor],
  templateUrl: './proformas-shell.html',
})
export class ProformasShell {
  private readonly catalog = inject(SupplierCatalogService);
  private readonly quotesService = inject(SalesQuotesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly editingQuoteId = this.route.snapshot.paramMap.get('id');

  protected readonly supplierProductTypeLabel = supplierProductTypeLabel;
  protected readonly supplierCatalogGroupLabel = supplierCatalogGroupLabel;
  protected readonly supplierComponentCategoryLabel = supplierComponentCategoryLabel;
  protected readonly salesQuoteStatusLabel = salesQuoteStatusLabel;
  protected readonly quoteItemTotal = quoteItemTotal;

  protected readonly search = signal('');
  protected readonly buildMode = signal(false);
  protected readonly builds = signal(['PC 1']);
  protected readonly activeBuild = signal('PC 1');
  protected readonly technicalFilters = signal<Record<string, string>>({});
  protected readonly page = signal(0);
  protected readonly showReview = signal(true);
  protected readonly reviewAccepted = signal(false);
  protected readonly editingProduct = signal<SupplierProduct | null>(null);
  protected readonly compatibilityLabels = COMPATIBILITY_LABELS;
  protected readonly valueLabel = specificationValueLabel;
  protected readonly productSpecs = specs;
  protected readonly quoteOnly = signal(true);
  protected readonly catalogGroup = signal<SupplierCatalogGroup | 'all'>('pc_parts');
  protected readonly componentCategory = signal<SupplierComponentCategory | 'all'>('all');
  protected readonly includeOutOfStock = signal(false);
  protected readonly catalogGroups = [
    { value: 'all' as const, label: 'Todos' },
    ...Object.entries(SUPPLIER_CATALOG_GROUP_LABELS).filter(([value]) => value !== 'other').map(([value, label]) => ({ value: value as SupplierCatalogGroup, label })),
    { value: 'other' as const, label: SUPPLIER_CATALOG_GROUP_LABELS.other },
  ];
  protected readonly componentCategories = Object.entries(SUPPLIER_COMPONENT_CATEGORY_LABELS)
    .map(([value, label]) => ({ value: value as SupplierComponentCategory, label }));
  protected readonly importRefresh = signal(0);
  protected readonly quoteRefresh = signal(0);
  protected readonly products = resource({
    params: () => ({
      search: this.search(),
      quoteOnly: this.quoteOnly(),
      catalogGroup: this.catalogGroup() === 'all' ? undefined : this.catalogGroup(),
      componentCategory: this.catalogGroup() === 'pc_parts' && this.componentCategory() !== 'all' ? this.componentCategory() : undefined,
      includeOutOfStock: this.includeOutOfStock(),
    }),
    loader: ({ params }) => this.catalog.listProducts({
      ...params,
      catalogGroup: params.catalogGroup === 'all' ? undefined : params.catalogGroup as SupplierCatalogGroup,
      componentCategory: params.componentCategory === 'all' ? undefined : params.componentCategory as SupplierComponentCategory,
    }),
    defaultValue: [] as SupplierProduct[],
  });
  protected readonly imports = resource({
    params: () => ({ refresh: this.importRefresh() }),
    loader: () => this.catalog.listImports(),
    defaultValue: [],
  });
  protected readonly quotes = resource({
    params: () => ({ refresh: this.quoteRefresh() }),
    loader: () => this.quotesService.list(),
    defaultValue: [],
  });
  protected readonly editorData = resource<SalesQuoteEditorData | null, { id: string | null }>({
    params: () => ({ id: this.editingQuoteId }),
    loader: ({ params }) => params.id ? this.quotesService.loadEditor(params.id) : Promise.resolve(null),
    defaultValue: null,
  });

  protected readonly selected = signal<SelectedProduct[]>([]);
  protected readonly exchangeRate = signal(3.37);
  private readonly exchangeRateTouched = signal(false);
  private readonly catalogExchangeRateEffect = effect(() => {
    const latest = this.imports.value()[0];
    if (latest && !this.exchangeRateTouched()) this.exchangeRate.set(Number(latest.exchange_rate));
  });
  protected readonly marginRate = signal(0.20);
  protected readonly taxRate = signal(0.18);
  protected readonly customerName = signal('');
  protected readonly customerPhone = signal('');
  protected readonly validUntil = signal(this.defaultValidUntil());
  protected readonly quoteNotes = signal('');
  protected readonly importPreview = signal<SupplierImportPreview | null>(null);
  protected readonly importResult = signal<SupplierImportResult | null>(null);
  protected readonly importError = signal<string | null>(null);
  protected readonly importing = signal(false);
  protected readonly previewing = signal(false);
  protected readonly quoteError = signal<string | null>(null);
  protected readonly savingQuote = signal(false);
  protected readonly savedQuoteFolio = signal<number | null>(null);
  private hydratedEditor = false;
  protected readonly currentItems = computed(() => this.selected().filter((i) => i.buildKey === (this.buildMode() ? this.activeBuild() : null)));
  protected readonly buildReports = computed(() => this.builds().map((key) => ({
    key, items: this.selected().filter((i) => i.buildKey === key),
    result: checkBuild(this.selected().filter((i) => i.buildKey === key)),
  })).filter((b) => b.items.length > 0));
  protected readonly hasInvalidBuild = computed(() => this.buildReports().some((b) => b.result.status === 'incompatible'));
  protected readonly facets = computed(() => SPECIFICATION_FIELDS.filter((f) => f.filter && f.kinds?.includes(this.componentCategory())).map((field) => ({
    ...field,
    values: [...new Set(this.products.value().flatMap((p) => (specs(p)[field.key] ?? '').split(',').map((s) => s.trim()).filter(Boolean)))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true })),
  })));
  protected readonly classifiedResults = computed(() => this.products.value().filter((p) => Object.entries(this.technicalFilters()).every(([key, value]) => !value || values(specs(p)[key]).includes(value.toUpperCase()))).map((product) => ({ product, check: this.candidateCheck(product) })));
  protected readonly excludedCount = computed(() => this.classifiedResults().filter((r) => r.check.status === 'incompatible').length);
  protected readonly reviewCount = computed(() => this.classifiedResults().filter((r) => r.check.status === 'review').length);
  protected readonly filteredResults = computed(() => this.classifiedResults().filter((r) => r.check.status !== 'incompatible' && (this.showReview() || r.check.status !== 'review')));
  protected readonly pageResults = computed(() => this.filteredResults().slice(this.page() * 40, (this.page() + 1) * 40));
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filteredResults().length / 40)));
  constructor() {
    effect(() => { this.search(); this.catalogGroup(); this.componentCategory(); this.technicalFilters(); this.showReview(); this.selected(); this.activeBuild(); this.buildMode(); this.page.set(0); });
    effect(() => { this.selected(); this.reviewAccepted.set(false); });
    effect(() => {
      const data = this.editorData.value();
      if (data && !this.hydratedEditor) {
        this.hydratedEditor = true;
        this.hydrateEditor(data);
      }
    });
  }
  protected readonly searchSuggestions = computed(() => {
    const current = this.search().trim().toLowerCase().split(/\s+/).pop() ?? '';
    if (!current) return SUPPLIER_SEARCH_SUGGESTIONS;
    return SUPPLIER_SEARCH_SUGGESTIONS.filter((suggestion) => suggestion.value.startsWith(current) || suggestion.label.toLowerCase().startsWith(current));
  });

  protected readonly subtotal = computed(() =>
    this.selected().reduce((sum, item) => sum + quoteItemTotal({
      quantity: item.quantity,
      unit_price_pen: this.itemUnitPrice(item),
    }), 0),
  );
  protected readonly taxAmount = computed(() => Number((this.subtotal() * this.taxRate()).toFixed(2)));
  protected readonly total = computed(() => Number((this.subtotal() + this.taxAmount()).toFixed(2)));

  protected chooseFile(file: File | undefined): void {
    if (!file) return;
    this.importError.set(null);
    this.importResult.set(null);
    this.previewing.set(true);
    void this.catalog.previewDeltronHtml(file)
      .then((preview) => this.importPreview.set(preview))
      .catch((error: unknown) => this.importError.set(error instanceof Error ? error.message : 'No se pudo leer el HTML'))
      .finally(() => this.previewing.set(false));
  }

  protected applyImport(): void {
    const preview = this.importPreview();
    if (!preview) return;
    this.importError.set(null);
    this.importing.set(true);
    void this.catalog.importDeltronHtml(preview.file, preview)
      .then((result) => {
        this.importResult.set(result);
        this.exchangeRateTouched.set(false);
        this.exchangeRate.set(Number(result.import.exchange_rate));
        this.importPreview.set(null);
        this.importRefresh.update((value) => value + 1);
        this.products.reload();
      })
      .catch((error: unknown) => this.importError.set(error instanceof Error ? error.message : 'No se pudo actualizar el catálogo'))
      .finally(() => this.importing.set(false));
  }

  protected addProduct(product: SupplierProduct): void {
    if (!product.is_quote_candidate || !(Number(product.stock_quantity) > 0) || this.candidateCheck(product).status === 'incompatible') return;
    const buildKey = this.buildMode() ? this.activeBuild() : null;
    const key = (buildKey ?? 'free') + ':' + product.id;
    this.selected.update((items) => {
      const existing = items.find((item) => item.key === key);
      if (existing) return this.singleSlot(product) && buildKey ? items : items.map((item) => item.key === key ? { ...item, quantity: item.quantity + 1 } : item);
      const retained = buildKey && this.singleSlot(product) ? items.filter((i) => i.buildKey !== buildKey || i.product.component_category !== product.component_category) : items;
      return [...retained, { key, buildKey, product, quantity: 1 }];
    });
  }

  protected itemUnitPrice(item: SelectedProduct): number {
    return item.frozenPricing?.unitPricePen ?? this.salePrice(item.product);
  }

  private hydrateEditor(data: SalesQuoteEditorData): void {
    if (data.quote.status !== 'draft') return;
    this.customerName.set(data.quote.customer_name ?? '');
    this.customerPhone.set(data.quote.customer_phone ?? '');
    this.exchangeRate.set(Number(data.quote.exchange_rate));
    this.marginRate.set(Number(data.quote.margin_rate));
    this.taxRate.set(Number(data.quote.tax_rate));
    this.validUntil.set(data.quote.valid_until ?? this.defaultValidUntil());
    this.quoteNotes.set(data.quote.notes ?? '');
    const products = new Map(data.products.map((product) => [product.id, product]));
    const buildKeys = [...new Set(data.items.map((item) => item.build_key).filter((key): key is string => !!key))];
    if (buildKeys.length) {
      this.buildMode.set(true);
      this.builds.set(buildKeys);
      this.activeBuild.set(buildKeys[0]);
    }
    this.selected.set(data.items.map((item) => {
      const product = products.get(item.supplier_product_id ?? '') ?? ({
        id: item.supplier_product_id ?? item.id,
        supplier_code: item.supplier_product_id ?? item.id,
        name: item.description,
        category: 'Producto cotizado',
        component_category: 'other',
        product_type: 'other',
        catalog_group: 'other',
        technical_attributes: item.specification_snapshot,
        specification_overrides: {},
        stock_quantity: 1,
        is_quote_candidate: true,
        distribution_price_usd: item.unit_cost_usd,
      } as SupplierProduct);
      return {
        key: item.id,
        buildKey: item.build_key,
        product,
        quantity: Number(item.quantity),
        frozenPricing: {
          unitCostUsd: Number(item.unit_cost_usd ?? 0),
          unitCostPen: Number(item.unit_cost_pen),
          unitPricePen: Number(item.unit_price_pen),
        },
      };
    }));
  }

  protected removeProduct(key: string): void {
    this.selected.update((items) => items.filter((item) => item.key !== key));
  }

  protected setQuantity(productId: string, value: number): void {
    this.selected.update((items) => items.map((item) => item.key === productId
      ? { ...item, quantity: item.buildKey && this.singleSlot(item.product) ? 1 : Number.isFinite(value) && value > 0 ? Math.floor(value) : 1 }
      : item));
  }

  protected candidateCheck(product: SupplierProduct) {
    if (!this.buildMode()) return { status: 'unchecked' as const, reasons: [] as string[] };
    const context = this.currentItems().filter((i) => !this.singleSlot(product) || i.product.component_category !== product.component_category);
    return checkCandidate(product, context.map((i) => i.product));
  }
  protected addLabel(product: SupplierProduct): string {
    return this.buildMode() && this.singleSlot(product) && this.currentItems().some((i) => i.product.component_category === product.component_category) ? 'Sustituir' : 'Agregar';
  }
  protected singleSlot(product: SupplierProduct): boolean {
    return ['processor', 'motherboard', 'case', 'power_supply', 'graphics', 'cooling'].includes(product.component_category);
  }
  protected newBuild(): void {
    const name = 'PC ' + (this.builds().length + 1);
    this.builds.update((list) => [...list, name]); this.activeBuild.set(name); this.buildMode.set(true);
  }
  protected setTechnicalFilter(key: string, value: string): void {
    this.technicalFilters.update((current) => ({ ...current, [key]: value }));
  }
  protected specificationsSaved(product: SupplierProduct): void {
    this.editingProduct.set(null);
    this.selected.update((items) => items.map((i) => i.product.id === product.id ? { ...i, product } : i));
    this.products.reload();
  }

  protected costInSoles(product: SupplierProduct): number {
    return Number(((product.distribution_price_usd ?? 0) * this.exchangeRate()).toFixed(2));
  }

  protected salePrice(product: SupplierProduct): number {
    return roundQuotePrice(this.costInSoles(product) * (1 + this.marginRate()));
  }

  protected customerPrice(product: SupplierProduct): number {
    return roundQuotePrice(this.salePrice(product) * (1 + this.taxRate()));
  }

  protected availability(product: SupplierProduct): string {
    if (product.stock_quantity === null) return product.stock_text ?? 'Consultar';
    return product.stock_is_at_least ? String(product.stock_quantity) + '+' : String(product.stock_quantity);
  }

  protected async saveQuote(): Promise<void> {
    this.quoteError.set(null);
    this.savedQuoteFolio.set(null);
    if (this.selected().length === 0) {
      this.quoteError.set('Agrega al menos un producto a la proforma');
      return;
    }
    if (this.hasInvalidBuild()) { this.quoteError.set('Resuelve las incompatibilidades del armado antes de guardar'); return; }
    if (this.buildReports().length && !this.reviewAccepted()) { this.quoteError.set('Revisa y reconoce los pendientes técnicos antes de guardar el borrador'); return; }
    const drafts: SalesQuoteItemDraft[] = this.selected().map((item) => {
      return {
          supplier_product_id: item.product.id,
          description: item.product.name,
          build_key: item.buildKey,
          specification_snapshot: item.product.technical_attributes,
          quantity: item.quantity,
          unit_cost_usd: item.frozenPricing?.unitCostUsd ?? Number(item.product.distribution_price_usd ?? 0),
          unit_cost_pen: item.frozenPricing?.unitCostPen ?? this.costInSoles(item.product),
          unit_price_pen: item.frozenPricing?.unitPricePen ?? this.salePrice(item.product),
          compatibility_status: item.buildKey ? 'review' : 'unchecked',
          compatibility_notes: item.buildKey ? this.buildReports().find((b) => b.key === item.buildKey)?.result.reasons.join('\n') ?? null : null,
      };
    });
    this.savingQuote.set(true);
    try {
      const quoteInput = {
        customer_name: this.customerName().trim() || null,
        customer_phone: this.customerPhone().trim() || null,
        exchange_rate: this.exchangeRate(),
        margin_rate: this.marginRate(),
        tax_rate: this.taxRate(),
        valid_until: this.validUntil() || null,
        notes: this.quoteNotes().trim() || null,
      };
      const quote = this.editingQuoteId
        ? await this.quotesService.updateDraft(this.editingQuoteId, { ...quoteInput, items: drafts })
        : await this.quotesService.create(quoteInput);
      if (!this.editingQuoteId) for (const draft of drafts) await this.quotesService.addItem(quote.id, draft);
      this.savedQuoteFolio.set(quote.folio);
      if (!this.editingQuoteId) {
        this.selected.set([]);
        this.builds.set(['PC 1']); this.activeBuild.set('PC 1');
        this.customerName.set('');
        this.customerPhone.set('');
        this.quoteNotes.set('');
      }
      this.quoteRefresh.update((value) => value + 1);
    } catch (error) {
      this.quoteError.set(error instanceof Error ? error.message : 'No se pudo guardar la proforma');
    } finally {
      this.savingQuote.set(false);
    }
  }

  protected async changeQuoteStatus(id: string, status: SalesQuoteStatus): Promise<void> {
    try {
      await this.quotesService.changeStatus(id, status);
      this.quoteRefresh.update((value) => value + 1);
    } catch (error) {
      this.quoteError.set(error instanceof Error ? error.message : 'No se pudo cambiar el estado');
    }
  }

  protected async duplicateQuote(id: string): Promise<void> {
    try {
      const copy = await this.quotesService.duplicate(id);
      await this.router.navigate(['/proformas', copy.id, 'edit']);
    } catch (error) {
      this.quoteError.set(error instanceof Error ? error.message : 'No se pudo duplicar la proforma');
    }
  }

  protected setExchangeRate(value: number): void {
    if (Number.isFinite(value) && value > 0) {
      this.exchangeRateTouched.set(true);
      this.exchangeRate.set(value);
    }
  }

  protected setCatalogGroup(value: SupplierCatalogGroup | 'all'): void {
    this.technicalFilters.set({});
    this.catalogGroup.set(value);
    if (value !== 'pc_parts') this.componentCategory.set('all');
  }

  protected setComponentCategory(value: SupplierComponentCategory | 'all'): void {
    this.technicalFilters.set({});
    this.componentCategory.set(value);
  }

  protected setMarginPercent(value: number): void {
    if (Number.isFinite(value) && value >= 0 && value <= 500) this.marginRate.set(value / 100);
  }

  protected setTaxPercent(value: number): void {
    if (Number.isFinite(value) && value >= 0 && value <= 100) this.taxRate.set(value / 100);
  }

  private defaultValidUntil(): string {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().slice(0, 10);
  }
}
