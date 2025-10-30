import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

interface NoteRecord {
    placeId: string;
    name?: string;
    address?: string;
    note?: string;
    status?: 'new' | 'contacted' | 'follow_up' | 'won' | 'lost';
    updatedAt?: string;
}

// Dev fallback: if /api route isn't available (Vite dev), use localStorage
function isDevNoApi(): boolean {
    return typeof window !== 'undefined' && window.location.hostname === 'localhost';
}

const LS_INDEX_KEY = 'notes:index';
function lsGetIndex(): string[] {
    try {
        return JSON.parse(localStorage.getItem(LS_INDEX_KEY) || '[]');
    } catch {
        return [];
    }
}
function lsSetIndex(ids: string[]) {
    localStorage.setItem(LS_INDEX_KEY, JSON.stringify(ids));
}
function lsKey(id: string) { return `note:${id}`; }

async function api<T>(path: string, init?: RequestInit): Promise<T> {
    if (!isDevNoApi()) {
        const res = await fetch(path, {
            ...init,
            headers: {
                'Content-Type': 'application/json',
                ...(init?.headers || {}),
            },
        });
        // If server returns non-JSON (e.g., raw file in dev), fall back
        const ct = res.headers.get('Content-Type') || '';
        if (res.ok && ct.includes('application/json')) {
            return res.json();
        }
        if (res.ok && !ct.includes('application/json')) {
            // fallthrough to local storage
        } else if (!res.ok) {
            throw new Error(await res.text());
        }
    }

    // localStorage fallback implementation
    const url = new URL(path, window.location.origin);
    const method = (init?.method || 'GET').toUpperCase();
    if (url.pathname === '/api/notes' && method === 'GET') {
        const placeId = url.searchParams.get('placeId');
        if (placeId) {
            const raw = localStorage.getItem(lsKey(placeId));
            return (raw ? JSON.parse(raw) : {}) as T;
        }
        const ids = lsGetIndex();
        const all = ids
            .map((id) => localStorage.getItem(lsKey(id)))
            .filter(Boolean)
            .map((s) => JSON.parse(s as string));
        return all as T;
    }
    if (url.pathname === '/api/notes' && method === 'POST') {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        if (!body.placeId) throw new Error('placeId is required');
        const record = {
            placeId: body.placeId,
            name: body.name || '',
            address: body.address || '',
            note: body.note || '',
            status: body.status || 'new',
            updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(lsKey(record.placeId), JSON.stringify(record));
        const ids = new Set(lsGetIndex());
        ids.add(record.placeId);
        lsSetIndex(Array.from(ids));
        return record as T;
    }
    if (url.pathname === '/api/notes' && method === 'DELETE') {
        const placeId = url.searchParams.get('placeId');
        if (!placeId) throw new Error('placeId is required');
        localStorage.removeItem(lsKey(placeId));
        const ids = lsGetIndex().filter((id) => id !== placeId);
        lsSetIndex(ids);
        return ({ ok: true } as unknown) as T;
    }

    throw new Error('Unsupported operation in dev fallback');
}

export function NotesPage() {
    const [params] = useSearchParams();
    const presetPlaceId = params.get('placeId') || '';
    const presetName = params.get('name') || '';
    const presetAddress = params.get('address') || '';

    const [records, setRecords] = useState<NoteRecord[]>([]);
    const [search, setSearch] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'updated' | 'name' | 'status'>('updated');
    const [sortAsc, setSortAsc] = useState<boolean>(false);
    const [current, setCurrent] = useState<NoteRecord>({
        placeId: presetPlaceId,
        name: presetName,
        address: presetAddress,
        note: '',
        status: 'new',
    });
    const [saving, setSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadAll();
        // prefill if coming from results
        if (presetPlaceId) {
            setCurrent((c) => ({ ...c, placeId: presetPlaceId, name: presetName, address: presetAddress }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function loadAll() {
        try {
            const data = await api<NoteRecord[]>('/api/notes');
            setRecords(data);
        } catch (e: any) {
            setError(e.message || String(e));
        }
    }

    const filtered = useMemo(() => {
        let list = [...records];

        // Filter by search query
        if (search) {
            const q = search.toLowerCase();
            list = list.filter((r) =>
                [r.name, r.address, r.placeId, r.note]
                    .filter(Boolean)
                    .some((v) => v!.toLowerCase().includes(q))
            );
        }

        // Filter by status
        if (statusFilter !== 'all') {
            list = list.filter((r) => (r.status || 'new') === statusFilter);
        }

        // Sort
        list.sort((a, b) => {
            let aVal: string | number = '';
            let bVal: string | number = '';

            if (sortBy === 'updated') {
                aVal = new Date(a.updatedAt || 0).getTime();
                bVal = new Date(b.updatedAt || 0).getTime();
            } else if (sortBy === 'name') {
                aVal = (a.name || '').toLowerCase();
                bVal = (b.name || '').toLowerCase();
            } else if (sortBy === 'status') {
                aVal = (a.status || 'new').toLowerCase();
                bVal = (b.status || 'new').toLowerCase();
            }

            if (aVal < bVal) return sortAsc ? -1 : 1;
            if (aVal > bVal) return sortAsc ? 1 : -1;
            return 0;
        });

        return list;
    }, [records, search, statusFilter, sortBy, sortAsc]);

    async function saveNote() {
        if (!current.placeId) {
            setError('Place ID is required');
            return;
        }
        setError(null);
        setSaving(true);
        try {
            await api<NoteRecord>('/api/notes', {
                method: 'POST',
                body: JSON.stringify(current),
            });
            await loadAll();
        } catch (e: any) {
            setError(e.message || String(e));
        } finally {
            setSaving(false);
        }
    }

    async function editNote(placeId: string) {
        try {
            const data = await api<NoteRecord>(`/api/notes?placeId=${encodeURIComponent(placeId)}`);
            setCurrent({
                placeId: data.placeId,
                name: data.name,
                address: data.address,
                note: data.note,
                status: data.status || 'new',
            });
        } catch (e: any) {
            setError(e.message || String(e));
        }
    }

    async function deleteNote(placeId: string) {
        try {
            await api(`/api/notes?placeId=${encodeURIComponent(placeId)}`, { method: 'DELETE' });
            await loadAll();
        } catch (e: any) {
            setError(e.message || String(e));
        }
    }

    return (
        <div className="container" style={{ paddingTop: 24 }}>
            <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0 }}>Notes</h2>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button className="ghost" onClick={() => exportCsv(filtered)}>Export CSV</button>
                        <button className="ghost" onClick={() => exportPdf(filtered)}>Export PDF</button>
                        <Link className="ghost" to="/">← Back to search</Link>
                    </div>
                </div>
                <div className="controls" style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div className="field">
                        <label>Search notes</label>
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, address, text" />
                    </div>
                    <div className="field">
                        <label>Filter by status</label>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="all">All</option>
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="follow_up">Follow up</option>
                            <option value="won">Won</option>
                            <option value="lost">Lost</option>
                        </select>
                    </div>
                    <div className="field">
                        <label>Sort by</label>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                            <option value="updated">Updated date</option>
                            <option value="name">Name</option>
                            <option value="status">Status</option>
                        </select>
                    </div>
                    <div className="field" style={{ gridColumn: 'span 3' }}>
                        <label>
                            <input type="checkbox" checked={sortAsc} onChange={(e) => setSortAsc(e.target.checked)} />
                            <span style={{ marginLeft: 8 }}>Sort ascending</span>
                        </label>
                    </div>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ marginTop: 0 }}>Add / Edit Note</h3>
                <div className="controls">
                    <div className="field">
                        <label>Place ID</label>
                        <input value={current.placeId} onChange={(e) => setCurrent({ ...current, placeId: e.target.value })} placeholder="Google place_id" />
                    </div>
                    <div className="field">
                        <label>Name</label>
                        <input value={current.name || ''} onChange={(e) => setCurrent({ ...current, name: e.target.value })} />
                    </div>
                    <div className="field">
                        <label>Address</label>
                        <input value={current.address || ''} onChange={(e) => setCurrent({ ...current, address: e.target.value })} />
                    </div>
                    <div className="field">
                        <label>Status</label>
                        <select value={current.status} onChange={(e) => setCurrent({ ...current, status: e.target.value as any })}>
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="follow_up">Follow up</option>
                            <option value="won">Won</option>
                            <option value="lost">Lost</option>
                        </select>
                    </div>
                    <div className="field">
                        <label>Note</label>
                        <textarea style={{ minHeight: 100, background: '#0b1224', color: 'var(--text)', border: '1px solid rgba(148, 163, 184, 0.16)', borderRadius: '10px', padding: '10px 12px', outline: 'none', fontFamily: 'inherit', resize: 'vertical', width: '100%' }} value={current.note || ''} onChange={(e) => setCurrent({ ...current, note: e.target.value })} />
                    </div>
                    <div>
                        <button className="primary" onClick={saveNote} disabled={saving}>{saving ? 'Saving…' : 'Save note'}</button>
                    </div>
                </div>
                {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
            </div>

            <div className="card">
                <table className="notes-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left', padding: 8, cursor: 'pointer' }} onClick={() => { setSortBy('name'); setSortAsc(!sortAsc); }}>Name {sortBy === 'name' && (sortAsc ? '↑' : '↓')}</th>
                            <th style={{ textAlign: 'left', padding: 8 }}>Address</th>
                            <th style={{ textAlign: 'left', padding: 8, cursor: 'pointer' }} onClick={() => { setSortBy('status'); setSortAsc(!sortAsc); }}>Status {sortBy === 'status' && (sortAsc ? '↑' : '↓')}</th>
                            <th style={{ textAlign: 'left', padding: 8, cursor: 'pointer' }} onClick={() => { setSortBy('updated'); setSortAsc(!sortAsc); }}>Updated {sortBy === 'updated' && (sortAsc ? '↑' : '↓')}</th>
                            <th style={{ textAlign: 'left', padding: 8 }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((r) => (
                            <tr key={r.placeId}>
                                <td style={{ padding: 8 }}>{r.name || '—'}</td>
                                <td style={{ padding: 8 }}>{r.address || '—'}</td>
                                <td style={{ padding: 8 }}>
                                    <span className="badge" style={{
                                        backgroundColor: r.status === 'won' ? 'rgba(34, 197, 94, 0.2)' :
                                            r.status === 'lost' ? 'rgba(239, 68, 68, 0.2)' :
                                                r.status === 'contacted' ? 'rgba(59, 130, 246, 0.2)' :
                                                    r.status === 'follow_up' ? 'rgba(251, 191, 36, 0.2)' :
                                                        'rgba(148, 163, 184, 0.2)',
                                        color: r.status === 'won' ? '#22c55e' :
                                            r.status === 'lost' ? '#ef4444' :
                                                r.status === 'contacted' ? '#3b82f6' :
                                                    r.status === 'follow_up' ? '#fbbf24' :
                                                        'var(--muted)'
                                    }}>{r.status || 'new'}</span>
                                </td>
                                <td style={{ padding: 8 }}>{r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—'}</td>
                                <td style={{ padding: 8 }}>
                                    <button className="ghost" onClick={() => editNote(r.placeId)}>Edit</button>
                                    <button className="ghost" onClick={() => deleteNote(r.placeId)}>Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filtered.length === 0 && <div className="empty">No notes yet.</div>}
            </div>
        </div>
    );
}

function exportCsv(list: NoteRecord[]) {
    const headers = ['Place ID', 'Name', 'Address', 'Status', 'Updated', 'Note'];
    const rows = list.map(n => [
        safe(n.placeId),
        safe(n.name),
        safe(n.address),
        safe(n.status || 'new'),
        safe(n.updatedAt ? new Date(n.updatedAt).toISOString() : ''),
        safe(n.note),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'notes.csv';
    a.click();
    URL.revokeObjectURL(url);
}

function exportPdf(list: NoteRecord[]) {
    // Lazy import to keep initial bundle smaller
    import('jspdf').then(({ default: jsPDF }) => {
        import('jspdf-autotable').then((mod) => {
            const autoTable = (mod as any).default || (mod as any);
            const doc = new jsPDF({ orientation: 'landscape' });
            doc.text('Client Finder - Notes', 14, 14);
            autoTable(doc, {
                head: [['Place ID', 'Name', 'Address', 'Status', 'Updated', 'Note']],
                body: list.map(n => [
                    n.placeId,
                    n.name || '',
                    n.address || '',
                    n.status || 'new',
                    n.updatedAt ? new Date(n.updatedAt).toLocaleString() : '',
                    (n.note || '').slice(0, 120),
                ]),
                styles: { fontSize: 8 },
                startY: 20,
                columnStyles: { 5: { cellWidth: 100 } },
            });
            doc.save('notes.pdf');
        });
    });
}

function safe(v?: string) {
    const s = (v ?? '').toString();
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
    return s;
}


