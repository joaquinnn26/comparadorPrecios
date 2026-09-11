import React, { useEffect, useState } from 'react';
import SearchPage from './App.jsx';
import ProviderManager from './components/ProviderManager.jsx';
const currentPage = () => (location.hash === '#/proveedores' ? 'providers' : 'search');
export default function Shell() {
  const [page, setPage] = useState(currentPage),
    [catalogVersion, setCatalogVersion] = useState(0);
  useEffect(() => {
    const changed = () => setPage(currentPage());
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  useEffect(() => {
    document.title =
      page === 'providers' ? 'Proveedores · Comparador' : 'Comparar precios · Comparador';
  }, [page]);
  return (
    <>
      <header className="app-header">
        <a className="app-brand" href="#/comparar">
          Comparador <span>de precios</span>
        </a>
        <nav aria-label="Navegación principal">
          <a href="#/comparar" aria-current={page === 'search' ? 'page' : undefined}>
            Comparar precios
          </a>
          <a href="#/proveedores" aria-current={page === 'providers' ? 'page' : undefined}>
            Administrar proveedores
          </a>
        </nav>
      </header>
      <div hidden={page !== 'search'}>
        <SearchPage key={catalogVersion} />
      </div>
      <main hidden={page !== 'providers'}>
        <div className="eyebrow">ADMINISTRACIÓN</div>
        <h1>Proveedores</h1>
        <p className="intro">
          Administrá tus proveedores y mantené sus listas de precios actualizadas.
        </p>
        <ProviderManager onCatalogChange={() => setCatalogVersion((v) => v + 1)} />
      </main>
    </>
  );
}
