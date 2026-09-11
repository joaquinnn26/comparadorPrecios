import React from 'react';
import { money } from './ProviderResult.jsx';
export default function Comparison({ products, onClear }) {
  if (!products.length)
    return (
      <div className="compare-hint">
        <strong>Seleccioná productos para comparar</strong>
      </div>
    );
  const fields = [
    ['Producto', (p) => p.name],
    ['Marca', (p) => p.brand || 'No informada'],
    ['Código del proveedor', (p) => p.code || 'No informado'],
    ['Precio', (p) => (p.price == null ? 'No disponible' : money(p.price, p.currency))],
    [
      'IVA',
      (p) =>
        p.tax === 'included' ? 'Incluido' : p.tax === 'excluded' ? 'No incluido' : 'No informado',
    ],
    ['Presentación', (p) => p.measure || 'No informada'],
    [
      'Disponibilidad',
      (p) => (p.stock === true ? 'En stock' : p.stock === false ? 'Sin stock' : 'A consultar'),
    ],
    ['Similitud con tu búsqueda', (p) => `${p.score}% · ${p.score >= 90 ? 'Alta' : 'Revisar'}`],
  ];
  return (
    <section className="comparison" aria-label="Productos elegidos">
      <div className="comparison-heading">
        <h2>Tu comparación · {products.length} proveedores</h2>
        <button className="secondary" onClick={onClear}>
          Limpiar selección
        </button>
      </div>
      <p className="note">Verificá modelo, medida y presentación.</p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Detalle</th>
              {products.map((p) => (
                <th scope="col" key={p.provider}>
                  {p.provider}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map(([label, read]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {products.map((p) => (
                  <td key={p.provider}>{read(p)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
