import express from 'express';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { searchProducts } from './services/searchService.js';
import { providerStore } from './services/providerStore.js';
import {
  allProviders,
  providerSummary,
  catalogStore,
  localRegistry,
} from './services/catalogStore.js';
import { runImport } from './services/runImport.js';
export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '8kb' }));
app.get('/api/providers', async (_req, res) => {
  try {
    res.set('Cache-Control', 'no-store').json(await providerSummary());
  } catch {
    res.status(500).json({ error: 'No se pudo leer la lista de proveedores.' });
  }
});
let importing = false;
app.post(
  '/api/providers/:id/import',
  express.raw({
    type: 'application/octet-stream',
    limit: process.env.COMPARADOR_STORAGE === 'netlify' ? '4mb' : '15mb',
  }),
  async (req, res) => {
    if (importing)
      return res.status(429).json({ error: 'Hay una importación en curso. Esperá a que termine.' });
    importing = true;
    try {
      const provider = (await allProviders()).find((p) => p.id === req.params.id);
      if (!provider) return res.status(404).json({ error: 'Proveedor no encontrado.' });
      if (!Buffer.isBuffer(req.body) || !req.body.length) throw Error('Elegí un archivo Excel.');
      const filename = String(req.query.filename || '');
      if (filename.length > 200 || !/\.(xlsx|xls)$/i.test(filename))
        throw Error('Se admiten archivos .xlsx y .xls, hasta 15 MB.');
      let settings;
      try {
        settings = JSON.parse(String(req.query.settings || '{}'));
      } catch {
        throw Error('Configuración inválida.');
      }
      const result = await runImport(req.body, settings);
      if (req.query.commit === 'true') {
        if (!result.ready || !result.count)
          throw Error(
            'No hay productos válidos. Revisá las columnas antes de reemplazar el catálogo.',
          );
        if (result.skipped && req.query.acceptSkipped !== 'true')
          throw Error('Revisá las filas omitidas y aceptalas antes de importar.');
        await catalogStore.replace(provider.id, {
          filename,
          settings: result.settings,
          products: result.products,
          updatedAt: new Date().toISOString(),
        });
      }
      const { products, ...preview } = result;
      res.json(preview);
    } catch (error) {
      res.status(400).json({
        error: error.code ? 'No se pudo guardar. El catálogo anterior se conserva.' : error.message,
      });
    } finally {
      importing = false;
    }
  },
);
app.post('/api/providers', async (req, res) => {
  try {
    res.status(201).json(await providerStore.add(req.body));
  } catch (error) {
    res
      .status(error.code ? 500 : 400)
      .json({ error: error.code ? 'No se pudo guardar el proveedor.' : error.message });
  }
});
let active = 0;
app.get('/api/search', async (req, res) => {
  const q = req.query.q;
  if (typeof q !== 'string' || q.trim().length < 2 || q.length > 160)
    return res.status(400).json({ error: 'Ingresá entre 2 y 160 caracteres.' });
  if (active >= 8)
    return res.status(429).json({ error: 'Hay muchas consultas en curso. Intentá nuevamente.' });
  active++;
  try {
    res
      .set('Cache-Control', 'no-store')
      .json(await searchProducts(q.trim(), await localRegistry()));
  } catch {
    res.status(500).json({ error: 'No se pudo completar la búsqueda.' });
  } finally {
    active--;
  }
});
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use((error, _req, res, _next) =>
  res.status(error.status || 500).json({
    error:
      error.type === 'entity.too.large'
        ? 'El archivo supera el tamaño permitido.'
        : 'La solicitud no es válida.',
  }),
);
if (process.env.COMPARADOR_STORAGE !== 'netlify')
  app.use(express.static(fileURLToPath(new URL('../../frontend/dist/', import.meta.url))));
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  app.listen(
    Number(process.env.PORT) || 3001,
    process.argv.includes('--lan') ? '0.0.0.0' : '127.0.0.1',
    () =>
      console.log(
        `Comparador disponible en el puerto ${Number(process.env.PORT) || 3001}${process.argv.includes('--lan') ? ' para la red local' : ' en esta computadora'}`,
      ),
  );
