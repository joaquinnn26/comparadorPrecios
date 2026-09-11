import { getStore } from '@netlify/blobs';
import { randomUUID } from 'node:crypto';

const store = () => getStore({ name: 'comparador-data', consistency: 'strong' });
export function createCloudProviderStore(validate, getStorage = store) {
  return {
    async list() {
      return (await getStorage().get('providers', { type: 'json' })) || [];
    },
    async add(input) {
      const storage = getStorage();
      for (let attempt = 0; attempt < 5; attempt++) {
        const current = await storage.getWithMetadata('providers', { type: 'json' });
        const rows = current?.data || [];
        if (rows.length >= 30) throw Error('Se alcanzó el límite de proveedores adicionales.');
        const row = { ...validate(input, rows), id: randomUUID() };
        const result = await storage.setJSON(
          'providers',
          [...rows, row],
          current ? { onlyIfMatch: current.etag } : { onlyIfNew: true },
        );
        if (result.modified) return row;
      }
      throw Error('La lista cambió durante el guardado. Intentá nuevamente.');
    },
  };
}
export function createCloudCatalogStore(getStorage = store) {
  const key = (id) => {
    if (!/^[a-z0-9-]{1,60}$/.test(id)) throw Error('Proveedor inválido.');
    return `catalogs/${id}`;
  };
  return {
    read(id) {
      return getStorage().get(key(id), { type: 'json' });
    },
    async replace(id, catalog) {
      await getStorage().setJSON(key(id), catalog);
    },
  };
}
