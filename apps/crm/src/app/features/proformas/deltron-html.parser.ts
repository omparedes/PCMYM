import type { DeltronParseResult, ParsedSupplierProduct } from './proformas.models';

function clean(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}
function money(value: string): number | null {
  const match = value.replace(/,/g, '').match(/(?:US\s*\$|\$)\s*([0-9]+(?:\.[0-9]+)?)/i);
  return match ? Number(match[1]) : null;
}

/** Extract source data only. PostgreSQL owns classification, specifications and aliases. */
export function parseDeltronHtml(html: string): DeltronParseResult {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const products: ParsedSupplierProduct[] = [];
  const warnings: string[] = [];
  let category = '';
  let skippedRows = 0;
  const bodyText = document.body.textContent ?? '';
  const exchangeRate = Number(bodyText.match(/TIPO DE CAMBIO\s+([0-9.]+)/i)?.[1]);
  for (const row of Array.from(document.querySelectorAll('tr'))) {
    const cells = Array.from(row.children).filter((cell) => ['TD', 'TH'].includes(cell.tagName));
    if (cells.length < 2) continue;
    if (clean(cells[0].textContent).toUpperCase() === 'CODIGO') {
      category = clean(cells[1].textContent);
      continue;
    }
    const link = cells[0].querySelector<HTMLAnchorElement>('a[href*="item_number="]');
    if (!link || cells.length < 9) continue;
    const code = link.href.match(/[?&]item_number=([^&]+)/i)?.[1] ?? clean(link.textContent);
    if (!code) { skippedRows++; continue; }
    const name = clean(Array.from(cells[1].childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join(' '));
    const stockText = clean(cells[2].textContent);
    const stock = stockText.match(/^(>)?\s*(\d+)$/);
    products.push({
      supplier_code: code,
      supplier_mini_code: clean(cells[0].textContent).match(/mini-c[oó]digo:\s*([0-9]+)/i)?.[1] ?? null,
      category: category || 'SIN CATEGORÍA',
      name: name || clean(cells[1].textContent),
      technical_description: clean(cells[1].querySelector('font')?.textContent) || null,
      stock_text: stockText || null,
      stock_quantity: stock ? Number(stock[2]) : null,
      stock_is_at_least: stock?.[1] === '>',
      distribution_price_usd: money(cells[3]?.textContent ?? ''),
      freight_text: clean(cells[4]?.textContent) || null,
      pge_price_usd: money(cells[5]?.textContent ?? ''),
      igv_exempt: clean(cells[6]?.textContent).toUpperCase() === 'X',
      warranty_code: clean(cells[7]?.textContent) || null,
      brand: clean(cells[8]?.textContent) || null,
      technical_comment: clean(cells[9]?.textContent) || null,
      source_url: link.href,
    });
  }
  if (!products.length) warnings.push('No se encontraron productos; verifica el HTML completo de Deltron.');
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) warnings.push('El archivo no contiene un tipo de cambio válido.');
  return {
    products, exchange_rate: Number.isFinite(exchangeRate) && exchangeRate > 0 ? exchangeRate : 1,
    tax_included: !/PRECIOS\s+NO\s+INCLUYEN\s+IGV/i.test(bodyText),
    source_date: bodyText.match(/Fecha:\s*([0-9-]{8,10})/i)?.[1] ?? null,
    skipped_rows: skippedRows, warnings,
  };
}
