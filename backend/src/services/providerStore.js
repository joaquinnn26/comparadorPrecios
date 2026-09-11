import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createCloudProviderStore } from './cloudStore.js';

const builtins = ['macons', 'berger', 'lekons'];
const builtinHosts = ['macons.com.ar', 'rodolfoberger.com.ar', 'lekons.com.ar'];
const host = (url) => new URL(url).hostname.replace(/^www\./, '');
function website(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Ingresá una dirección completa, por ejemplo https://proveedor.com.ar.');
  }
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new Error('Usá un sitio HTTPS sin usuario ni contraseña en la dirección.');
  return url.href;
}
export function validateProvider(input, existing = []) {
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  if (name.length < 2 || name.length > 60)
    throw new Error('El nombre debe tener entre 2 y 60 caracteres.');
  if (input.url && (typeof input.url !== 'string' || input.url.length > 500))
    throw new Error('Revisá el sitio del proveedor.');
  const url = input.url?.trim() ? website(input.url.trim()) : '';
  if (
    builtins.includes(name.toLowerCase()) ||
    (url && builtinHosts.includes(host(url))) ||
    existing.some(
      (p) =>
        p.name.toLowerCase() === name.toLowerCase() || (url && p.url && host(p.url) === host(url)),
    )
  )
    throw new Error('Ese proveedor ya está agregado.');
  return { name, url };
}
export function createProviderStore(
  path = process.env.COMPARADOR_DATA_DIR
    ? join(process.env.COMPARADOR_DATA_DIR, 'providers.json')
    : fileURLToPath(new URL('../../local-data/providers.json', import.meta.url)),
) {
  let queue = Promise.resolve();
  async function list() {
    try {
      const rows = JSON.parse(await readFile(path, 'utf8'));
      if (!Array.isArray(rows)) throw Error('Formato inválido');
      return rows;
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }
  return {
    list,
    add(input) {
      const operation = queue.then(async () => {
        const rows = await list();
        if (rows.length >= 30)
          throw new Error('Se alcanzó el límite de 30 proveedores adicionales.');
        const row = { ...validateProvider(input, rows), id: randomUUID() };
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path + '.tmp', JSON.stringify([...rows, row], null, 2), 'utf8');
        await rename(path + '.tmp', path);
        return row;
      });
      queue = operation.catch(() => {});
      return operation;
    },
  };
}
export const providerStore =
  process.env.COMPARADOR_STORAGE === 'netlify'
    ? createCloudProviderStore(validateProvider)
    : createProviderStore();
