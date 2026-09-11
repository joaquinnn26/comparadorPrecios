import { readFile, mkdir, writeFile, rename, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { providerStore } from './providerStore.js';
import { createCloudCatalogStore } from './cloudStore.js';
export const initialProviders = [
  { id: 'macons', name: 'Macons', url: 'https://macons.com.ar' },
  { id: 'berger', name: 'Berger', url: 'https://www.rodolfoberger.com.ar' },
  { id: 'lekons', name: 'Lekons', url: 'https://www.lekons.com.ar' },
];
export function createCatalogStore(
  directory = process.env.COMPARADOR_DATA_DIR
    ? join(process.env.COMPARADOR_DATA_DIR, 'catalogs')
    : fileURLToPath(new URL('../../local-data/catalogs/', import.meta.url)),
) {
  let queue = Promise.resolve();
  function path(id) {
    if (!/^[a-z0-9-]{1,60}$/.test(id)) throw Error('Proveedor inválido.');
    return join(directory, id + '.json');
  }
  async function read(id) {
    try {
      return JSON.parse(await readFile(path(id), 'utf8'));
    } catch (e) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  }
  return {
    read,
    replace(id, catalog) {
      const operation = queue.then(async () => {
        const target = path(id);
        await mkdir(directory, { recursive: true });
        try {
          await writeFile(target + '.tmp', JSON.stringify(catalog), 'utf8');
          await rename(target + '.tmp', target);
        } finally {
          await unlink(target + '.tmp').catch(() => {});
        }
      });
      queue = operation.catch(() => {});
      return operation;
    },
  };
}
export const catalogStore =
  process.env.COMPARADOR_STORAGE === 'netlify' ? createCloudCatalogStore() : createCatalogStore();
export async function allProviders() {
  return [...initialProviders, ...(await providerStore.list())];
}
export async function providerSummary() {
  return Promise.all(
    (await allProviders()).map(async (p) => {
      const catalog = await catalogStore.read(p.id);
      return {
        ...p,
        catalog: catalog
          ? {
              filename: catalog.filename,
              updatedAt: catalog.updatedAt,
              count: catalog.products.length,
              settings: catalog.settings,
            }
          : null,
      };
    }),
  );
}
export async function localRegistry() {
  return (await allProviders()).map((p) => ({
    ...p,
    source: 'excel',
    async search() {
      const catalog = await catalogStore.read(p.id);
      return {
        products:
          catalog?.products.map((product) => ({
            ...product,
            provider: p.name,
            source: 'excel',
            url: p.url || null,
            updatedAt: catalog.updatedAt,
          })) || [],
        emptyCatalog: !catalog,
      };
    },
  }));
}
