import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProviderStore, validateProvider } from './providerStore.js';
test('valida sitios y duplicados', () => {
  assert.throws(() => validateProvider({ name: 'Nuevo', url: 'javascript:alert(1)' }));
  assert.throws(() => validateProvider({ name: 'Nuevo', url: 'https://www.macons.com.ar' }));
  assert.deepEqual(validateProvider({ name: 'Nuevo' }), { name: 'Nuevo', url: '' });
  assert.throws(() =>
    validateProvider({ name: 'Nuevo', url: 'https://usuario:clave@ejemplo.com' }),
  );
});
test('persiste al recrear el store y serializa altas duplicadas', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'comparador-providers-'));
  try {
    const path = join(folder, 'providers.json'),
      store = createProviderStore(path);
    const results = await Promise.allSettled([
      store.add({ name: 'Prueba', url: 'https://ejemplo.com' }),
      store.add({ name: 'Prueba', url: 'https://ejemplo.com' }),
    ]);
    assert.deepEqual(
      results.map((r) => r.status),
      ['fulfilled', 'rejected'],
    );
    const rows = await createProviderStore(path).list();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, 'Prueba');
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
