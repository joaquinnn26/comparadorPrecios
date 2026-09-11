import React from 'react';
export const money = (value, currency = 'ARS') =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(value);
export default function ProviderResult({ result, best, selected, onSelect }) {
  const [page, setPage] = React.useState(0);
  const listRef = React.useRef(null);
  const pageSize = 3,
    pages = Math.max(1, Math.ceil(result.products.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = result.products.slice(current * pageSize, (current + 1) * pageSize);
  function go(next) {
    setPage(next);
    listRef.current?.scrollTo({ top: 0 });
  }
  return (
    <section className="provider provider-paged">
      <header>
        <h2>{result.provider}</h2>
        <span className={`tag ${result.source}`}>Lista de precios</span>
      </header>
      <p className="note" aria-live="polite">
        {result.products.length
          ? `${current * pageSize + 1}–${Math.min((current + 1) * pageSize, result.products.length)} de ${result.products.length} productos`
          : 'Sin resultados con estos filtros'}
      </p>
      {selected && (
        <p className="selection-note">
          Seleccionado: <strong>{selected.name}</strong>
        </p>
      )}
      <div
        className="provider-products"
        ref={listRef}
        role="region"
        aria-label={`Resultados de ${result.provider}`}
        tabIndex={0}
      >
        {result.status === 'unavailable' ? (
          <p role="status">Proveedor no disponible. {result.message}</p>
        ) : result.status === 'not_found' ? (
          <p>No encontrado: probá otra marca o una descripción más corta.</p>
        ) : !result.products.length ? (
          <p>Ningún producto cumple estos filtros.</p>
        ) : (
          visible.map((p) => (
            <article
              key={p.id}
              className={
                selected?.id === p.id
                  ? 'selected'
                  : best?.provider === p.provider && best?.id === p.id
                    ? 'winner'
                    : ''
              }
            >
              {best?.provider === p.provider && best?.id === p.id && (
                <strong className="best-label">Mejor precio</strong>
              )}
              <h3>{p.name}</h3>
              <p className="price">
                {p.price === null ? 'Precio no disponible' : money(p.price, p.currency)}
              </p>
              <p>
                <span className={`tag ${p.score >= 90 ? 'match' : 'possible'}`}>
                  {p.score >= 90 ? 'Similitud alta' : 'Revisar producto'}
                </span>{' '}
                <strong>{p.score}%</strong>
              </p>
              <p className="note">
                {p.stock === true
                  ? 'En stock'
                  : p.stock === false
                    ? 'Sin stock'
                    : 'Stock no informado'}
                {p.code && ` · Código ${p.code}`}
              </p>
              <details className="product-details">
                <summary>Detalles del producto</summary>
                {p.source === 'excel' && (
                  <p className="note">
                    {p.tax === 'included'
                      ? 'IVA incluido'
                      : p.tax === 'excluded'
                        ? 'Sin IVA'
                        : 'IVA no informado'}{' '}
                    · {p.measure || 'Presentación no informada'} · Fila {p.row}
                    <br />
                    Lista actualizada {new Date(p.updatedAt).toLocaleDateString('es-AR')}
                  </p>
                )}
                {p.reasons?.length > 0 && <p className="note">{p.reasons.join('. ')}</p>}
                {p.url && (
                  <a href={p.url} target="_blank" rel="noreferrer">
                    Sitio del proveedor ↗
                  </a>
                )}
              </details>
              <button
                className="choose"
                aria-pressed={selected?.id === p.id}
                onClick={() => onSelect(p)}
              >
                {selected?.id === p.id ? 'Quitar de comparación' : 'Elegir para comparar'}
              </button>
            </article>
          ))
        )}
      </div>
      {pages > 1 && (
        <nav className="product-pagination" aria-label={`Páginas de ${result.provider}`}>
          <button
            className="secondary"
            disabled={current === 0}
            onClick={() => go(current - 1)}
            aria-label={`Página anterior de ${result.provider}`}
          >
            ←
          </button>
          <label>
            Página{' '}
            <select
              aria-label={`Página de ${result.provider}`}
              value={current}
              onChange={(e) => go(Number(e.target.value))}
            >
              {Array.from({ length: pages }, (_, i) => (
                <option key={i} value={i}>
                  {i + 1}
                </option>
              ))}
            </select>{' '}
            de {pages}
          </label>
          <button
            className="secondary"
            disabled={current === pages - 1}
            onClick={() => go(current + 1)}
            aria-label={`Página siguiente de ${result.provider}`}
          >
            →
          </button>
        </nav>
      )}
      {result.truncated && (
        <p className="note">
          El proveedor tiene más resultados que los consultados. Precisá marca, modelo o medida para
          acotar la búsqueda.
        </p>
      )}
    </section>
  );
}
