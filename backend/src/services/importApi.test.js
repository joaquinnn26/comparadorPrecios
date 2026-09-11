import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import XLSX from 'xlsx';
test('API: alta, vista previa, importación, reemplazo y búsqueda local', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'comparador-api-'));
  process.env.COMPARADOR_DATA_DIR = folder;
  const { app } = await import('../server.js');
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const create = (rows) => {
    const b = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(b, XLSX.utils.aoa_to_sheet(rows), 'Lista');
    return XLSX.write(b, { type: 'buffer', bookType: 'xlsx' });
  };
  try {
    const response = await fetch(base + '/api/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Proveedor de prueba' }),
    });
    assert.equal(response.status, 201);
    const p = await response.json();
    const upload = async (rows, commit) => {
      const q = new URLSearchParams({
        filename: 'lista.xlsx',
        commit: String(commit),
        settings: JSON.stringify({ tax: 'included' }),
      });
      return fetch(`${base}/api/providers/${p.id}/import?${q}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: create(rows),
      });
    };
    const first = [
      ['Producto', 'Precio'],
      ['Taladro Bosch GSB 13 RE', 1200],
    ];
    assert.equal((await upload(first, false)).status, 200);
    assert.equal(
      (await (await fetch(base + '/api/providers')).json()).find((x) => x.id === p.id).catalog,
      null,
    );
    assert.equal((await upload(first, true)).status, 200);
    let search = await (await fetch(base + '/api/search?q=Taladro%20Bosch%20GSB%2013%20RE')).json();
    assert.equal(search.best.price, 1200);
    assert.equal(
      (
        await upload(
          [
            ['Producto', 'Precio'],
            ['Taladro Bosch GSB 13 RE', 'Consultar'],
          ],
          true,
        )
      ).status,
      400,
    );
    search = await (await fetch(base + '/api/search?q=Taladro%20Bosch%20GSB%2013%20RE')).json();
    assert.equal(search.best.price, 1200);
    assert.equal(
      (
        await upload(
          [
            ['Producto', 'Precio'],
            ['Llave Tramontina 18 pulgadas', 850],
          ],
          true,
        )
      ).status,
      200,
    );
    search = await (await fetch(base + '/api/search?q=Taladro%20Bosch%20GSB%2013%20RE')).json();
    assert.equal(search.results.find((x) => x.provider === p.name).status, 'not_found');
    assert.deepEqual(await readdir(join(folder, 'catalogs')), [p.id + '.json']);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(folder, { recursive: true, force: true });
  }
});
