import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { ProformasShell } from './proformas-shell';
import { SupplierSpecEditor } from './supplier-spec-editor';
import { SupplierCatalogService } from './supplier-catalog.service';
import { SalesQuotesService } from './sales-quotes.service';
import type { SupplierProduct } from './proformas.models';

function product(id: string, kind: string, attributes: Record<string, string>): SupplierProduct {
  return { id, supplier_code: id, name: id, category: kind, component_category: kind,
    technical_attributes: attributes, specification_overrides: {}, stock_quantity: 10,
    is_quote_candidate: true, distribution_price_usd: 10 } as SupplierProduct;
}
const catalog = { listProducts: vi.fn().mockResolvedValue([]), listImports: vi.fn().mockResolvedValue([]), setSpecifications: vi.fn() };
const quotes = { list: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: 'QUOTE', folio: 1 }), addItem: vi.fn().mockResolvedValue({}) };

describe('PC builder UI', () => {
  it('isolates builds, replaces a slot and removes its restrictions', async () => {
    await TestBed.configureTestingModule({ imports: [ProformasShell], providers: [provideRouter([]),
      { provide: SupplierCatalogService, useValue: catalog },
      { provide: SalesQuotesService, useValue: quotes },
    ] }).compileComponents();
    const fixture = TestBed.createComponent(ProformasShell);
    const shell = fixture.componentInstance;
    await fixture.whenStable();
    shell['buildMode'].set(true);
    const am4 = product('AM4-BOARD', 'motherboard', { socket: 'AM4' });
    const am5 = product('AM5-BOARD', 'motherboard', { socket: 'AM5' });
    const cpu = product('AM4-CPU', 'processor', { socket: 'AM4' });
    shell['addProduct'](am5);
    expect(shell['candidateCheck'](cpu).status).toBe('incompatible');
    shell['newBuild']();
    expect(shell['candidateCheck'](cpu).status).toBe('unchecked');
    shell['addProduct'](am4);
    shell['addProduct'](cpu);
    expect(shell['selected']()).toHaveLength(3);
    shell['activeBuild'].set('PC 1');
    shell['addProduct'](am4);
    expect(shell['currentItems']()).toHaveLength(1);
    expect(shell['candidateCheck'](cpu).status).toBe('review');
    shell['removeProduct'](shell['currentItems']()[0].key);
    expect(shell['candidateCheck'](cpu).status).toBe('unchecked');
    shell['activeBuild'].set('PC 2');
    expect(shell['currentItems']()).toHaveLength(2);
    shell['buildMode'].set(false);
    shell['addProduct'](am5);
    expect(shell['currentItems']()).toHaveLength(1);
    expect(shell['buildReports']()).toHaveLength(1);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Armar PC');
    await shell['saveQuote']();
    expect(quotes.create).not.toHaveBeenCalled();
    shell['reviewAccepted'].set(true);
    await shell['saveQuote']();
    expect(quotes.addItem).toHaveBeenCalledWith('QUOTE', expect.objectContaining({
      build_key: 'PC 2', specification_snapshot: { socket: 'AM4' }, compatibility_status: 'review',
    }));
    expect(quotes.addItem).toHaveBeenCalledWith('QUOTE', expect.objectContaining({
      build_key: null, compatibility_status: 'unchecked',
    }));
  });

  it('renders dynamic Signal Forms and saves only explicit overrides', async () => {
    await TestBed.configureTestingModule({ imports: [SupplierSpecEditor], providers: [
      { provide: SupplierCatalogService, useValue: catalog },
    ] }).compileComponents();
    const fixture = TestBed.createComponent(SupplierSpecEditor);
    const board = product('BOARD', 'motherboard', { socket: 'AM4', memory_type: 'DDR4' });
    fixture.componentRef.setInput('product', board);
    await fixture.whenStable();
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#spec-socket')!;
    expect(input.value).toBe('AM4');
    input.value = 'AM5'; input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    catalog.setSpecifications.mockResolvedValue(board);
    await fixture.componentInstance['save']();
    expect(catalog.setSpecifications).toHaveBeenLastCalledWith('BOARD', { socket: 'AM5' });
  });
});
