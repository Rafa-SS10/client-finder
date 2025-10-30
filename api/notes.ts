export const config = { runtime: 'edge' };
// TS in Edge runtime: declare minimal process typing
declare const process: any;

type NoteRecord = {
    placeId: string;
    name?: string;
    address?: string;
    note?: string;
    status?: 'new' | 'contacted' | 'follow_up' | 'won' | 'lost';
    updatedAt?: string;
};

function json(status: number, data: unknown) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'content-type': 'application/json',
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
            'access-control-allow-headers': 'content-type',
        },
    });
}

function join(...parts: string[]) {
    return parts
        .filter(Boolean)
        .map((p, i) => (i === 0 ? p.replace(/\/$/, '') : p.replace(/^\//, '')))
        .join('/');
}

async function kvCommand(path: string, method: 'GET' | 'POST' = 'GET') {
    const base = (process.env as any).KV_REST_API_URL as string;
    const token = (process.env as any).KV_REST_API_TOKEN as string;
    if (!base || !token) throw new Error('KV env vars missing');
    const url = join(base, path);
    const res = await fetch(url, {
        method,
        headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export default async function handler(req: Request) {
    if (req.method === 'OPTIONS') return json(200, {});
    try {
        const url = new URL(req.url);
        if (req.method === 'GET') {
            const placeId = url.searchParams.get('placeId');
            if (placeId) {
                const r = await kvCommand(`get/${encodeURIComponent('note:' + placeId)}`);
                return json(200, r?.result ? JSON.parse(r.result) : {});
            }
            const ids = await kvCommand('smembers/notes:index');
            const members: string[] = ids?.result || [];
            if (members.length === 0) return json(200, []);
            const keysPath = members.map((id) => encodeURIComponent('note:' + id)).join('/');
            const mget = await kvCommand(`mget/${keysPath}`);
            const list = (mget?.result || [])
                .filter(Boolean)
                .map((s: string) => {
                    try { return JSON.parse(s); } catch { return null; }
                })
                .filter(Boolean);
            return json(200, list);
        }

        if (req.method === 'POST') {
            const body = (await req.json()) as NoteRecord;
            if (!body?.placeId) return json(400, { error: 'placeId is required' });
            const record: NoteRecord = {
                placeId: body.placeId,
                name: body.name || '',
                address: body.address || '',
                note: body.note || '',
                status: (body.status as any) || 'new',
                updatedAt: new Date().toISOString(),
            };
            const value = encodeURIComponent(JSON.stringify(record));
            await kvCommand(`set/${encodeURIComponent('note:' + record.placeId)}/${value}`);
            await kvCommand(`sadd/notes:index/${encodeURIComponent(record.placeId)}`);
            return json(200, record);
        }

        if (req.method === 'DELETE') {
            const placeId = url.searchParams.get('placeId');
            if (!placeId) return json(400, { error: 'placeId is required' });
            await kvCommand(`del/${encodeURIComponent('note:' + placeId)}`);
            await kvCommand(`srem/notes:index/${encodeURIComponent(placeId)}`);
            return json(200, { ok: true });
        }

        return json(405, { error: 'Method not allowed' });
    } catch (e: any) {
        return json(500, { error: e.message || String(e) });
    }
}


