import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { BusinessResult } from '../types';

interface ResultsTableProps {
    results: BusinessResult[];
}

type SortKey = 'name' | 'address' | 'website' | 'phone';

// Check if a note exists for a placeId
function hasNote(placeId: string): boolean {
    try {
        const key = `note:${placeId}`;
        return !!localStorage.getItem(key);
    } catch {
        return false;
    }
}

export function ResultsTable({ results }: ResultsTableProps) {
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortAsc, setSortAsc] = useState<boolean>(true);
    const [notesMap, setNotesMap] = useState<Record<string, boolean>>({});

    // Check for notes whenever results change
    useEffect(() => {
        const updateNotesMap = () => {
            const map: Record<string, boolean> = {};
            results.forEach((r) => {
                map[r.id] = hasNote(r.id);
            });
            setNotesMap(map);
        };

        updateNotesMap();

        // Listen for storage changes (when notes are saved/deleted)
        window.addEventListener('storage', updateNotesMap);

        // Also check periodically (for same-tab updates)
        const interval = setInterval(updateNotesMap, 1000);

        return () => {
            window.removeEventListener('storage', updateNotesMap);
            clearInterval(interval);
        };
    }, [results]);

    const sorted = useMemo(() => {
        const list = [...results];
        list.sort((a, b) => {
            const av = (a[sortKey] || '').toString().toLowerCase();
            const bv = (b[sortKey] || '').toString().toLowerCase();
            if (av < bv) return sortAsc ? -1 : 1;
            if (av > bv) return sortAsc ? 1 : -1;
            return 0;
        });
        return list;
    }, [results, sortKey, sortAsc]);

    function toggleSort(key: SortKey) {
        if (key === sortKey) setSortAsc(!sortAsc);
        else {
            setSortKey(key);
            setSortAsc(true);
        }
    }

    return (
        <div className="results-table">
            <table>
                <thead>
                    <tr>
                        <th onClick={() => toggleSort('name')}>Name</th>
                        <th onClick={() => toggleSort('address')}>Address</th>
                        <th onClick={() => toggleSort('phone')}>Phone</th>
                        <th onClick={() => toggleSort('website')}>Website</th>
                        <th>Maps</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((r) => (
                        <tr key={r.id}>
                            <td>{r.name}</td>
                            <td>{r.address}</td>
                            <td>{r.phone || '—'}</td>
                            <td>
                                {r.website ? (
                                    <a href={r.website} target="_blank" rel="noreferrer">
                                        {new URL(r.website).hostname}
                                    </a>
                                ) : (
                                    <span className="badge">No website</span>
                                )}
                            </td>
                            <td>
                                {r.googleMapsUrl ? (
                                    <a href={r.googleMapsUrl} target="_blank" rel="noreferrer">Open</a>
                                ) : (
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + ' ' + r.address)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Open
                                    </a>
                                )}
                            </td>
                            <td>
                                {notesMap[r.id] ? (
                                    <span className="badge" style={{ backgroundColor: 'rgba(34, 211, 238, 0.2)', color: 'var(--accent)' }}>Has note</span>
                                ) : (
                                    <Link className="ghost" to={`/notes?placeId=${encodeURIComponent(r.id)}&name=${encodeURIComponent(r.name)}&address=${encodeURIComponent(r.address)}`}>Add note</Link>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {sorted.length === 0 && <div className="empty">No results yet.</div>}
        </div>
    );
}


