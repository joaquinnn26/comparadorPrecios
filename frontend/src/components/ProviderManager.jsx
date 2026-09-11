import React, { useEffect, useState } from 'react';
import ExcelImporter from './ExcelImporter.jsx';
import Modal from './Modal.jsx';
export default function ProviderManager({ onCatalogChange }) {
  const [open, setOpen] = useState(false),
    [rows, setRows] = useState([]),
    [name, setName] = useState(''),
    [url, setUrl] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState(''),
    [importing, setImporting] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  async function reload() {
    const r = await fetch('/api/providers');
    if (!r.ok) throw Error('No se pudo cargar la lista de proveedores.');
    setRows(await r.json());
  }
  useEffect(() => {
    reload().catch((e) => setError(e.message));
  }, []);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url }),
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.error);
      await reload();
      setName('');
      setUrl('');
      setOpen(false);
      setSuccess(`${body.name} agregado. Ahora podés cargar su Excel.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function imported() {
    setImporting(null);
    setSuccess('Catálogo actualizado. La lista anterior fue reemplazada.');
    onCatalogChange();
    try {
      await reload();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <section className="provider-manager" aria-label="Proveedores y listas de precios">
      <div className="comparison-heading">
        <div>
          <strong>Proveedores y listas de precios</strong>
          <p className="note">
            {rows.filter((p) => p.catalog).length} de {rows.length} proveedores con catálogo cargado
          </p>
        </div>
        <button className="secondary" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Cerrar formulario' : '+ Agregar proveedor'}
        </button>
      </div>
      {success && <p role="status">{success}</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {open && (
        <Modal title="Agregar proveedor" busy={busy} onClose={() => setOpen(false)}>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <form onSubmit={save}>
            <label htmlFor="provider-name">Nombre del proveedor</label>
            <input
              id="provider-name"
              autoFocus
              required
              minLength={2}
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <label htmlFor="provider-url">Sitio web (opcional)</label>
            <input
              id="provider-url"
              type="url"
              maxLength={500}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://proveedor.com.ar"
            />
            <div className="modal-actions">
              <button disabled={busy}>{busy ? 'Guardando…' : 'Guardar proveedor'}</button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}
      <div className="catalog-list">
        {rows.map((p) => (
          <div className="catalog-row" key={p.id}>
            <div>
              <strong>{p.name}</strong>
              <p className="note">
                {p.catalog
                  ? `${p.catalog.count} productos · ${p.catalog.filename} · Actualizado ${new Date(p.catalog.updatedAt).toLocaleString('es-AR')}`
                  : 'Todavía no cargaste una lista de precios'}
              </p>
            </div>
            <button
              className="secondary"
              disabled={!!importing}
              onClick={() => {
                setImporting(p);
                setSuccess('');
              }}
            >
              {p.catalog ? 'Actualizar Excel' : 'Cargar Excel'}
            </button>
          </div>
        ))}
      </div>
      {importing && (
        <Modal
          title={`${importing.catalog ? 'Actualizar' : 'Cargar'} Excel · ${importing.name}`}
          wide
          busy={importBusy}
          onClose={() => setImporting(null)}
        >
          <ExcelImporter
            provider={importing}
            onDone={imported}
            onBusyChange={setImportBusy}
            onCancel={() => setImporting(null)}
          />
        </Modal>
      )}
    </section>
  );
}
