import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MapSearch } from './components/MapSearch';
import { ResultsTable } from './components/ResultsTable';
import { ExportButtons } from './components/ExportButtons';
import type { BusinessResult } from './types';

export function App() {
    const location = useLocation();
    const [results, setResults] = useState<BusinessResult[]>([]);
    const [onlyNoWebsite, setOnlyNoWebsite] = useState<boolean>(false);

    const filteredResults = useMemo(() => {
        return onlyNoWebsite ? results.filter(r => !r.website) : results;
    }, [results, onlyNoWebsite]);

    return (
        <div className="app">
            <header className="app-header">
                <div className="header-row">
                    <div>
                        <h1>Client Finder</h1>
                        <p>Find local businesses with missing websites.</p>
                    </div>
                    <nav className="header-nav">
                        <Link className={location.pathname === '/' ? 'active' : ''} to="/">Search</Link>
                        <Link className={location.pathname === '/notes' ? 'active' : ''} to="/notes">Notes</Link>
                    </nav>
                </div>
            </header>
            <main className="container">
                <section className="card">
                    <MapSearch onResults={setResults} />
                </section>
                <section className="card">
                    <div className="table-toolbar">
                        <label className="checkbox">
                            <input
                                type="checkbox"
                                checked={onlyNoWebsite}
                                onChange={(e) => setOnlyNoWebsite(e.target.checked)}
                            />
                            <span>Show only businesses without website</span>
                        </label>
                        <ExportButtons data={filteredResults} />
                    </div>
                    <ResultsTable results={filteredResults} />
                </section>
            </main>
            <footer className="footer">Powered by Google Maps Places</footer>
        </div>
    );
}


