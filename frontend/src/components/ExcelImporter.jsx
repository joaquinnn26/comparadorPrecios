import React, { useState } from 'react';
const maxUploadMB = Number(import.meta.env.VITE_MAX_UPLOAD_MB) || 15;
const fields = {
  name: 'Descripción *',
  price: 'Precio *',
  code: 'Código del proveedor',
  brand: 'Marca',
  model: 'Modelo',
  measure: 'Medida / presentación',
  manufacturerCode: 'Código de fabricante',
  stock: 'Stock',
};
export default function ExcelImporter({ provider, onDone, onCancel, onBusyChange = () => {} }) {
  const [file, setFile] = useState(null),
    [preview, setPreview] = useState(null),
    [settings, setSettings] = useState({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [dirty, setDirty] = useState(false),
    [accept, setAccept] = useState(false);
  function change(patch) {
    setSettings((old) => ({ ...old, ...patch }));
    setDirty(true);
    setAccept(false);
  }
  async function inspect(commit = false, chosen = file, config = settings) {
    if (!chosen) return;
    setBusy(true);
    onBusyChange(true);
    setError('');
    try {
      const params = new URLSearchParams({
        filename: chosen.name,
        settings: JSON.stringify(config),
        commit: String(commit),
        acceptSkipped: String(accept),
      });
      const r = await fetch(`/api/providers/${provider.id}/import?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: chosen,
        signal: AbortSignal.timeout(60000),
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.error);
      if (commit) {
        onDone();
        return;
      }
      setPreview(body);
      setSettings(body.settings);
      setDirty(false);
      setAccept(false);
    } catch (e) {
      setError(
        e.name === 'TimeoutError'
          ? 'El archivo tardó demasiado. Intentá con una hoja más pequeña.'
          : e.message,
      );
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }
  return (
    <section className="importer" aria-label={`Importar lista de ${provider.name}`}>
      <h2>Lista de precios · {provider.name}</h2>
      <p>Seleccioná el archivo y revisá los datos antes de importar.</p>
      <label htmlFor="excel-file">Archivo Excel (.xlsx o .xls, máximo {maxUploadMB} MB)</label>
      <input
        id="excel-file"
        type="file"
        accept=".xlsx,.xls"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files[0];
          setFile(f);
          setPreview(null);
          setSettings({});
          setAccept(false);
          if (f) {
            if (f.size > maxUploadMB * 1024 * 1024) {
              setError(`El archivo supera ${maxUploadMB} MB.`);
              return;
            }
            inspect(false, f, {});
          }
        }}
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {busy && <p role="status">Procesando lista…</p>}
      {preview && (
        <>
          <fieldset disabled={busy}>
            <legend>Organización del archivo</legend>
            <div className="import-grid">
              <label>
                Hoja
                <select
                  value={settings.sheet}
                  onChange={(e) => {
                    setDirty(true);
                    inspect(false, file, { sheet: e.target.value });
                  }}
                >
                  {preview.sheets.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Fila de encabezados
                <input
                  type="number"
                  min="1"
                  max={preview.totalRows}
                  value={settings.header}
                  onChange={(e) =>
                    change({ header: Number(e.target.value), start: Number(e.target.value) + 1 })
                  }
                />
              </label>
              <label>
                Primera fila de productos
                <input
                  type="number"
                  min="1"
                  value={settings.start}
                  onChange={(e) => change({ start: Number(e.target.value) })}
                />
              </label>
              <label>
                Última fila de productos
                <input
                  type="number"
                  min="1"
                  max={preview.totalRows}
                  value={settings.end}
                  onChange={(e) => change({ end: Number(e.target.value) })}
                />
              </label>
            </div>
            <button
              className="secondary"
              onClick={() => inspect(false, file, { ...settings, mapping: undefined })}
            >
              Detectar columnas en esta fila
            </button>
            <p className="note">
              Sin encabezados: incluí la primera fila en el rango de productos.
            </p>
            <div className="table-scroll">
              <table>
                <caption>Contenido del archivo cerca del encabezado</caption>
                <tbody>
                  {preview.rawPreview.map((r) => (
                    <tr key={r.row}>
                      <th>Fila {r.row}</th>
                      {r.values.map((v, i) => (
                        <td key={i}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="import-grid">
              {Object.entries(fields).map(([field, label]) => (
                <label key={field}>
                  {label}
                  <select
                    value={settings.mapping[field] ?? -1}
                    onChange={(e) =>
                      change({ mapping: { ...settings.mapping, [field]: Number(e.target.value) } })
                    }
                  >
                    <option value={-1}>No usar</option>
                    {preview.columns.map((c) => (
                      <option key={c.index} value={c.index}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label>
                Separador decimal en precios de texto
                <select
                  value={settings.decimal}
                  onChange={(e) => change({ decimal: e.target.value })}
                >
                  <option value="auto">Automático: punto o coma decimal</option>
                  <option value=",">Coma: 1.234,56</option>
                  <option value=".">Punto: 1,234.56</option>
                </select>
              </label>
              <label>
                Moneda
                <select
                  value={settings.currency}
                  onChange={(e) => change({ currency: e.target.value })}
                >
                  <option>ARS</option>
                  <option>USD</option>
                </select>
              </label>
              <label>
                Los precios de esta columna
                <select value={settings.tax} onChange={(e) => change({ tax: e.target.value })}>
                  <option value="unknown">IVA no informado</option>
                  <option value="included">Incluyen IVA</option>
                  <option value="excluded">No incluyen IVA</option>
                </select>
              </label>
            </div>
            <button className="secondary" onClick={() => inspect()}>
              Actualizar vista previa
            </button>
          </fieldset>
          {provider.catalog?.settings && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setDirty(true);
                inspect(false, file, { ...provider.catalog.settings, end: undefined });
              }}
            >
              Usar configuración de la lista anterior
            </button>
          )}
          <h3>
            Vista previa: {preview.count} productos válidos · {preview.skipped} filas omitidas
          </h3>
          {dirty && (
            <p role="status">
              Cambiaste la configuración. Actualizá la vista previa antes de guardar.
            </p>
          )}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Producto</th>
                  <th>Código</th>
                  <th>Precio</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((p) => (
                  <tr key={p.id}>
                    <td>{p.row}</td>
                    <td>{p.name}</td>
                    <td>{p.code || '—'}</td>
                    <td>
                      {p.currency} {p.price}
                    </td>
                    <td>{p.stock === null ? 'No informado' : p.stock ? 'Sí' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!!preview.skipped && (
            <>
              <details>
                <summary>Revisar filas omitidas (primeras 30)</summary>
                <ul>
                  {preview.issues.map((i) => (
                    <li key={i.row}>
                      Fila {i.row}: {i.reason}
                    </li>
                  ))}
                </ul>
              </details>
              <label className="check">
                <input
                  type="checkbox"
                  checked={accept}
                  disabled={dirty || busy}
                  onChange={(e) => setAccept(e.target.checked)}
                />
                Acepto importar sin las {preview.skipped} filas omitidas.
              </label>
            </>
          )}
          <p className="note">
            {' '}
            {provider.catalog
              ? 'Esta acción reemplaza completamente la lista anterior de este proveedor.'
              : 'El Excel original no se guardará en el servidor.'}{' '}
            Las fórmulas deben tener un resultado guardado.
          </p>
          <button
            disabled={
              busy || dirty || !preview.ready || !preview.count || (preview.skipped > 0 && !accept)
            }
            onClick={() => inspect(true)}
          >
            {provider.catalog ? 'Reemplazar catálogo anterior' : 'Guardar catálogo'}
          </button>
        </>
      )}
      <button className="secondary" disabled={busy} onClick={onCancel}>
        Cancelar
      </button>
    </section>
  );
}
