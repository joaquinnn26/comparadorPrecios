import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudProviderStore, createCloudCatalogStore } from './cloudStore.js';
import { validateProvider } from './providerStore.js';

function memoryStore() {
  const values = new Map();
  let version = 0;
  return {
    async get(key) {
      return values.get(key)?.data || null;
    },
    async getWithMetadata(key) {
      return values.get(key) || null;
    },
    async setJSON(key, data, options = {}) {
      const previous = values.get(key);
      if (
        (options.onlyIfNew && previous) ||
        (options.onlyIfMatch && options.onlyIfMatch !== previous?.etag)
      )
        return { modified: false };
      values.set(key, { data, etag: String(++version) });
      return { modified: true };
    },
  };
}
test('Blobs conserva altas concurrentes y reemplaza solo el catálogo elegido', async () => {
  const storage = memoryStore(),
    providers = createCloudProviderStore(validateProvider, () => storage),
    catalogs = createCloudCatalogStore(() => storage);
  await Promise.all([
    providers.add({ name: 'Proveedor A' }),
    providers.add({ name: 'Proveedor B' }),
  ]);
  assert.equal((await providers.list()).length, 2);
  await assert.rejects(providers.add({ name: 'Proveedor A' }), /agregado/);
  await catalogs.replace('a', { products: [{ price: 100 }] });
  await catalogs.replace('b', { products: [{ price: 200 }] });
  await catalogs.replace('a', { products: [{ price: 50 }] });
  assert.equal((await catalogs.read('a')).products[0].price, 50);
  assert.equal((await catalogs.read('b')).products[0].price, 200);
});
