import { comparePrices } from '../../../shared/priceComparison.js';
import { matchProduct } from './matching.js';

async function boundedSearch(provider, query, timeoutMs) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      provider.search(query, { signal: controller.signal }),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('Se agotó el tiempo de consulta.'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export async function searchProducts(query, registry = [], timeoutMs = 12000) {
  const settled = await Promise.allSettled(registry.map((p) => boundedSearch(p, query, timeoutMs)));
  const results = settled.map((entry, i) => {
    const provider = registry[i];
    const base = { provider: provider.name, source: provider.source };
    if (entry.status === 'rejected')
      return {
        ...base,
        status: 'unavailable',
        message:
          entry.reason?.message === 'Se agotó el tiempo de consulta.'
            ? entry.reason.message
            : 'No se pudo leer el catálogo del proveedor.',
        products: [],
      };
    const products = entry.value.products
      .map((p) => ({ ...p, ...matchProduct(query, p) }))
      .filter((p) => p.score >= 70)
      .map((p) => ({
        ...p,
        status: p.stock === false ? 'out_of_stock' : p.score >= 90 ? 'match' : 'possible',
      }))
      .sort((a, b) => b.score - a.score || (a.price ?? Infinity) - (b.price ?? Infinity));
    return {
      ...base,
      status: entry.value.emptyCatalog ? 'no_catalog' : products.length ? 'ok' : 'not_found',
      products,
      truncated: entry.value.truncated || false,
    };
  });
  const { best, cheaperPossible } = comparePrices(results);
  return { query, results, best, cheaperPossible, searchedAt: new Date().toISOString() };
}
