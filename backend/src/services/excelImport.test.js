import test from 'node:test';
import assert from 'node:assert/strict';
import XLSX from 'xlsx';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectWorkbook, parsePrice } from './excelImport.js';
import { createCatalogStore } from './catalogStore.js';
import { searchProducts } from './searchService.js';
import { runImport } from './runImport.js';
function workbook(rows, type = 'xlsx') {
  const b = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(b, XLSX.utils.aoa_to_sheet(rows), 'Precios');
  return XLSX.write(b, { type: 'buffer', bookType: type });
}
const rows = [
  ['LISTA SEPTIEMBRE'],
  [],
  ['Código', 'Descripción', 'Marca', 'Precio', 'Stock'],
  ['00012', 'Taladro Bosch GSB 13 RE', 'Bosch', '1.234,50', ''],
  ['00013', 'Taladro Bosch GSB 16 RE', 'Bosch', 2000, 0],
  ['', '', '', ''],
  ['Total', '', '', 3234.5],
  ['004', 'Llave', '', 'Consultar'],
];
test('precios automáticos con punto, coma y miles en el mismo archivo', () => {
  for (const v of [1235.5, '1235.50', '1235,50', '1.235,50', '1,235.50', '$ 1235.50'])
    assert.equal(parsePrice(v), 1235.5, String(v));
  assert.equal(parsePrice('1.235'), null);
  assert.equal(parsePrice('1.235', ','), 1235);
  assert.equal(parsePrice('1.235', '.'), 1.235);
  for (const v of ['1.23.45', 'Consultar', '-100', 'Infinity']) assert.equal(parsePrice(v), null);
  const r = inspectWorkbook(
    workbook([
      ['Producto', 'Precio'],
      ['Taladro A', '1235.50'],
      ['Taladro B', '1235,50'],
      ['Taladro C', 1235.5],
    ]),
  );
  assert.equal(r.count, 3);
  assert.equal(r.skipped, 0);
  assert.ok(r.products.every((p) => p.price === 1235.5));
});
test('detecta encabezados desplazados y normaliza XLSX y XLS', () => {
  for (const type of ['xlsx', 'biff8']) {
    const r = inspectWorkbook(workbook(rows, type));
    assert.equal(r.settings.header, 3);
    assert.equal(r.count, 2);
    assert.equal(r.products[0].code, '00012');
    assert.equal(r.products[0].price, 1234.5);
    assert.equal(r.products[0].stock, null);
    assert.equal(r.products[1].stock, false);
    assert.equal(r.skipped, 2);
  }
});
test('mapeo manual, rango y números internacionales', () => {
  const data = workbook([
    ['Oferta especial'],
    ['Valor proveedor', 'Texto raro'],
    ['1,234.56', 'Taladro'],
    ['9,999.00', 'Resumen'],
  ]);
  const r = inspectWorkbook(data, {
    header: 2,
    start: 3,
    end: 3,
    mapping: { name: 1, price: 0 },
    decimal: '.',
    currency: 'USD',
    tax: 'included',
  });
  assert.equal(r.products[0].price, 1234.56);
  assert.equal(r.count, 1);
  assert.equal(r.products[0].currency, 'USD');
  assert.equal(parsePrice('1.234,50'), 1234.5);
  assert.equal(parsePrice('Consultar'), null);
  assert.equal(parsePrice(-1), null);
  assert.throws(() => inspectWorkbook(data, { mapping: { name: 0, price: 0 } }), /distinta/);
});
test('fórmulas: usa valor guardado, no calcula ni ejecuta', () => {
  const b = XLSX.utils.book_new(),
    sheet = XLSX.utils.aoa_to_sheet([
      ['Producto', 'Precio'],
      ['Taladro', 10],
      ['Llave', 20],
    ]);
  sheet.B2 = { t: 'n', f: '5+5', v: 10 };
  sheet.B3 = { t: 'n', f: '10+10' };
  XLSX.utils.book_append_sheet(b, sheet, 'Precios');
  const r = inspectWorkbook(XLSX.write(b, { type: 'buffer', bookType: 'xlsx' }));
  assert.equal(r.products[0].price, 10);
  assert.ok(r.skipped >= 1);
});
test('lector aislado devuelve vista previa y errores', async () => {
  assert.equal((await runImport(workbook(rows), {})).count, 2);
  await assert.rejects(runImport(workbook(rows), { sheet: 'No existe' }), /hoja/);
});
test('reemplazo: persiste una única versión y elimina productos anteriores', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'excel-catalog-'));
  try {
    const store = createCatalogStore(folder);
    await store.replace('prueba', { products: [{ name: 'Viejo', price: 100 }] });
    await store.replace('prueba', { products: [{ name: 'Nuevo', price: 200 }] });
    assert.deepEqual(await readdir(folder), ['prueba.json']);
    assert.equal((await createCatalogStore(folder).read('prueba')).products[0].name, 'Nuevo');
    await assert.rejects(store.replace('../bad', {}));
    assert.equal((await store.read('prueba')).products[0].name, 'Nuevo');
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
test('comparación local distingue catálogos vacíos e IVA', async () => {
  const product = {
    id: '1',
    name: 'Taladro Bosch GSB 13 RE',
    source: 'excel',
    price: 100,
    currency: 'ARS',
    tax: 'included',
    stock: null,
  };
  const registry = [
    { name: 'A', source: 'excel', search: async () => ({ products: [product] }) },
    { name: 'B', source: 'excel', search: async () => ({ products: [], emptyCatalog: true }) },
  ];
  const r = await searchProducts(product.name, registry);
  assert.equal(r.best.price, 100);
  assert.equal(r.results[1].status, 'no_catalog');
  registry.push({
    name: 'C',
    source: 'excel',
    search: async () => ({ products: [{ ...product, tax: 'excluded', price: 90 }] }),
  });
  assert.equal((await searchProducts(product.name, registry)).best, null);
});
