import test from 'node:test';
import assert from 'node:assert/strict';
import { matchProduct, normalize } from './matching.js';
import { searchProducts } from './searchService.js';

test('abreviaturas, tildes y pulgadas', () => {
  assert.equal(
    normalize('LLAVE P/CAÑOS TRAM. 18"'),
    normalize('Llave para caños Tramontina 18 pulgadas'),
  );
  assert.equal(
    matchProduct('Llave para caños Tramontina 18 pulgadas', { name: 'LLAVE P/CAÑOS TRAM. 18"' })
      .score,
    100,
  );
});
test('un modelo o medida distintos no son equivalentes', () => {
  assert.ok(
    matchProduct('Taladro Bosch GSB 13 RE', { name: 'Taladro Bosch GSB 16 RE' }).score < 70,
  );
  assert.ok(
    matchProduct('Llave Tramontina 18 pulgadas', { name: 'Llave Tramontina 14 pulgadas' }).score <
      70,
  );
  assert.ok(matchProduct('taladro', { name: 'Taladro Bosch GSB 16 RE' }).score < 90);
  assert.equal(
    matchProduct('78515000', { name: 'Otra descripción', manufacturerCode: '78515000' }).score,
    100,
  );
});
test('prefijos encuentran productos sin confundir medidas ni confirmar identidad', async () => {
  const p = {
    id: 'taladro',
    name: 'Taladro Bosch GSB 13 RE',
    source: 'excel',
    price: 100,
    currency: 'ARS',
    tax: 'included',
    stock: true,
  };
  for (const q of ['tal', 'tala', 'talad', 'TALA', 'tala bosch']) {
    const r = await searchProducts(q, [
      { name: 'Prueba', search: async () => ({ products: [p] }) },
    ]);
    assert.equal(r.results[0].products.length, 1, q);
    assert.equal(r.best, null, q);
  }
  assert.ok(matchProduct('tala bosch gsb 1', p).score < 70);
  assert.ok(matchProduct('tala makita', p).score < 70);
  assert.ok(matchProduct('torn', { name: 'Taladro Bosch' }).score < 70);
});
test('mejor precio excluye IVA desconocido, posibles y falta de stock', async () => {
  const product = {
    id: '1',
    provider: 'Proveedor',
    name: 'Taladro Bosch GSB 13 RE',
    source: 'excel',
    tax: 'included',
    stock: true,
    currency: 'ARS',
    price: 100,
  };
  const result = await searchProducts(product.name, [
    {
      name: 'Proveedor',
      search: async () => ({
        products: [
          product,
          { ...product, id: '2', tax: 'unknown', price: 1 },
          { ...product, id: '3', stock: false, price: 2 },
          { ...product, id: '4', name: 'Taladro Bosch GSB 13', price: 50 },
        ],
      }),
    },
  ]);
  assert.equal(result.best.id, '1');
  assert.equal(result.cheaperPossible.id, '4');
});
