import { describe, expect, it } from 'vitest';
import { parseDeltronHtml } from './deltron-html.parser';

describe('Deltron HTML parser', () => {
  it('preserves the authoritative header, source data and exchange rate', () => {
    const html = `
      <html><body>
        <h3>TIPO DE CAMBIO 3.370</h3>
        <p>PRECIOS NO INCLUYEN IGV</p>
        <table>
          <tr><td>CODIGO</td><td>CPU AMD RYZEN 5 SAM5 7XXX</td><td>STOCK DSP</td><td>PRECIO</td><td>FLETE</td><td>PGE</td><td>Exon IGV</td><td>GARAN</td><td>MARCA</td></tr>
          <tr>
            <td><a href="http://deltron.test/postsql.php?item_number=CPAM5R57600">CPAM5R57600</a><br>mini-código: 408080</td>
            <td>PROC AMD RYZEN 5 7600 3.80GHZ<br><font>Procesador AMD Ryzen 5 7600, AM5, 65W.</font></td>
            <td>&gt;20</td><td>US $189.50</td><td>consultar</td><td></td><td></td><td>W</td><td>AMD</td>
          </tr>
        </table>
      </body></html>`;

    const result = parseDeltronHtml(html);
    expect(result.exchange_rate).toBe(3.37);
    expect(result.tax_included).toBe(false);
    expect(result.products).toHaveLength(1);
    expect(result.products[0]).toMatchObject({
      supplier_code: 'CPAM5R57600',
      stock_quantity: 20,
      stock_is_at_least: true,
      distribution_price_usd: 189.5,
      category: 'CPU AMD RYZEN 5 SAM5 7XXX',
    });
    expect(result.products[0].technical_description).toContain('AM5');
    expect(result.products[0]).not.toHaveProperty('technical_attributes');
  });

  it('leaves classification and search aliases to the database', () => {
    const html = `
      <html><body><table>
        <tr><td>CODIGO</td><td>MEMORIAS DDR4</td></tr>
        <tr>
          <td><a href="http://deltron.test/postsql.php?item_number=MEMDDR48">MEMDDR48</a></td>
          <td>MEMORIA 8GB DDR4 3200MHZ</td>
          <td>5</td><td>US $20.00</td><td></td><td></td><td></td><td>W</td><td>KINGSTON</td>
        </tr>
      </table></body></html>`;

    const product = parseDeltronHtml(html).products[0];
    expect(product).toMatchObject({
      category: 'MEMORIAS DDR4',
      stock_quantity: 5,
    });
    expect(product).not.toHaveProperty('search_terms');
  });

  it('preserves cooler headers without guessing from CPU in the name', () => {
    const html = `
      <html><body><table>
        <tr><td>CODIGO</td><td>COOLER CPU</td></tr>
        <tr>
          <td><a href="http://deltron.test/postsql.php?item_number=COOLER8165">COOLER8165</a></td>
          <td>COOLER PARA CPU TE-8165N AIRE</td>
          <td>20</td><td>US $11.00</td><td></td><td></td><td></td><td>W</td><td>TEROS</td>
        </tr>
      </table></body></html>`;

    const product = parseDeltronHtml(html).products[0];
    expect(product.category).toBe('COOLER CPU');
    expect(product.name).toContain('CPU');
    expect(product).not.toHaveProperty('component_category');
  });
});
