import React, { useEffect, useState } from 'react';
import ProviderResult, { money } from './components/ProviderResult.jsx';
import Comparison from './components/Comparison.jsx';
import { comparePrices } from '../../shared/priceComparison.js';
export default function App() {
  const [query, setQuery] = useState(''),
    [data, setData] = useState(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  const [filter, setFilter] = useState('all'),
    [sort, setSort] = useState('similarity'),
    [selected, setSelected] = useState({});
  const [providers, setProviders] = useState([]),
    [excluded, setExcluded] = useState([]),
    [providerError, setProviderError] = useState('');
  useEffect(() => {
    fetch('/api/providers')
      .then(async (r) => {
        if (!r.ok) throw Error();
        setProviders((await r.json()).filter((p) => p.catalog));
      })
      .catch(() =>
        setProviderError('No se pudo cargar el selector de proveedores. Podés buscar igualmente.'),
      );
  }, []);
  function select(product) {
    setSelected((previous) => {
      const next = { ...previous };
      if (next[product.provider]?.id === product.id) delete next[product.provider];
      else next[product.provider] = product;
      return next;
    });
  }
  function toggle(name) {
    setExcluded((old) => (old.includes(name) ? old.filter((n) => n !== name) : [...old, name]));
    setSelected((old) => {
      const next = { ...old };
      delete next[name];
      return next;
    });
  }
  const displayed = (data?.results || [])
    .filter((r) => !excluded.includes(r.provider) && r.products.length > 0)
    .map((r) => ({
      ...r,
      products: r.products
        .filter(
          (p) =>
            filter === 'all' ||
            (filter === 'high' && p.score >= 90) ||
            (filter === 'priced' && p.price != null) ||
            (filter === 'stock' && p.stock === true),
        )
        .sort((a, b) =>
          sort === 'price'
            ? (a.price ?? Infinity) - (b.price ?? Infinity) || b.score - a.score
            : b.score - a.score,
        ),
    }))
    .filter((r) => r.products.length > 0);
  const { best, cheaperPossible } = comparePrices(displayed);
  const chosen = Object.values(selected).filter((p) =>
    displayed.some((r) => r.provider === p.provider && r.products.some((item) => item.id === p.id)),
  );
  const failed = (data?.results || []).filter(
    (r) => r.status === 'unavailable' && !excluded.includes(r.provider),
  );
  async function search(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setData(null);
    setSelected({});
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, {
        signal: AbortSignal.timeout(18000),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setData(body);
    } catch (e) {
      setError(
        e.name === 'TimeoutError'
          ? 'La consulta tardó demasiado. Intentá nuevamente.'
          : e.message || 'No se pudo conectar con el servidor.',
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <main>
      <div className="eyebrow">FERRETERÍA · COMPRAS</div>
      <h1>Comparador de proveedores</h1>
      <form onSubmit={search}>
        <label htmlFor="query">Producto, código, marca o modelo</label>
        <div className="search">
          <input
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            minLength={2}
            maxLength={160}
            required
            placeholder="Ej.: Taladro Bosch GSB 13 RE"
          />
          <button disabled={loading || query.trim().length < 2}>
            {loading ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
      </form>
      <fieldset className="provider-filter">
        <legend>Proveedores a comparar</legend>
        {providerError && <p role="alert">{providerError}</p>}
        <div className="provider-options">
          {providers.map((p) => (
            <label key={p.id}>
              <input
                type="checkbox"
                checked={!excluded.includes(p.name)}
                onChange={() => toggle(p.name)}
              />
              {p.name}
            </label>
          ))}
        </div>
        {providers.length > 0 ? (
          <div className="filter-actions">
            <button className="secondary" onClick={() => setExcluded([])}>
              Seleccionar todos
            </button>
            <button
              className="secondary"
              onClick={() => {
                setExcluded(providers.map((p) => p.name));
                setSelected({});
              }}
            >
              Quitar todos
            </button>
          </div>
        ) : (
          !providerError && (
            <p className="note">
              Cargá una lista en <a href="#/proveedores">Administrar proveedores</a> para empezar.
            </p>
          )
        )}
      </fieldset>
      {loading && <p role="status">Buscando en tus catálogos…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {data && (
        <>
          <div className="summary" aria-live="polite">
            <h2>Resultados para “{data.query}”</h2>
            <p>
              {displayed.length} proveedores con resultados ·{' '}
              {displayed.reduce((n, r) => n + r.products.length, 0)} productos visibles
            </p>
            {best && (
              <p>
                Menor precio de lista:{' '}
                <strong>
                  {best.provider} · {money(best.price)}
                </strong>
                . Revisá stock y presentación.
              </p>
            )}
            {cheaperPossible && (
              <p>
                Posible coincidencia más barata en {cheaperPossible.provider}:{' '}
                {money(cheaperPossible.price)}. Revisá el producto.
              </p>
            )}
            {failed.length > 0 && (
              <p role="status">
                No se pudo leer el catálogo de: {failed.map((r) => r.provider).join(', ')}.
              </p>
            )}
          </div>
          <div className="toolbar">
            <label>
              Mostrar
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">Todos los resultados</option>
                <option value="high">Similitud alta (90% o más)</option>
                <option value="priced">Con precio visible</option>
                <option value="stock">En stock confirmado</option>
              </select>
            </label>
            <label>
              Ordenar por
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="similarity">Mayor similitud</option>
                <option value="price">Menor precio visible</option>
              </select>
            </label>
          </div>
          {displayed.length > 0 ? (
            <>
              <Comparison products={chosen} onClear={() => setSelected({})} />
              <div className="results">
                {displayed.map((r) => (
                  <ProviderResult
                    key={`${data.searchedAt}-${r.provider}-${filter}-${sort}`}
                    result={r}
                    best={best}
                    selected={chosen.find((p) => p.provider === r.provider)}
                    onSelect={select}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="empty" role="status">
              <h2>No hay resultados para mostrar</h2>
              <p>Seleccioná algún proveedor, probá otra búsqueda o ampliá los filtros.</p>
            </div>
          )}
        </>
      )}
      {!data && !loading && (
        <div className="empty">
          <h2>Buscar productos</h2>
          <p>Ingresá un nombre, código o modelo.</p>
        </div>
      )}
    </main>
  );
}
