export const config = { runtime: 'edge' };

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

async function kvFetch(path: string, init?: RequestInit) {
    const base = process.env.KV_REST_API_URL as string;
    const token = process.env.KV_REST_API_TOKEN as string;
    if (!base || !token) {
        throw new Error('KV env vars missing');
    }
    const res = await fetch(base + path, {
        ...init,
        headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
            ...(init?.headers || {}),
        },
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
                const r = await kvFetch(`/get/note:${encodeURIComponent(placeId)}`);
                return json(200, r?.result || {});
            }
            const ids = await kvFetch('/smembers/notes:index');
            const members: string[] = ids?.result || [];
            if (members.length === 0) return json(200, []);
            const keys = members.map((id) => `note:${id}`);
            const mget = await kvFetch('/mget', {
                method: 'POST',
                body: JSON.stringify(keys),
            });
            const list = (mget?.result || []).filter(Boolean);
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
            await kvFetch(`/set/note:${encodeURIComponent(record.placeId)}`, {
                method: 'POST',
                body: JSON.stringify(record),
            });
            await kvFetch('/sadd/notes:index', {
                method: 'POST',
                body: JSON.stringify([record.placeId]),
            });
            return json(200, record);
        }

        if (req.method === 'DELETE') {
            const placeId = url.searchParams.get('placeId');
            if (!placeId) return json(400, { error: 'placeId is required' });
            await kvFetch(`/del/note:${encodeURIComponent(placeId)}`);
            await kvFetch('/srem/notes:index', {
                method: 'POST',
                body: JSON.stringify([placeId]),
            });
            return json(200, { ok: true });
        }

        return json(405, { error: 'Method not allowed' });
    } catch (e: any) {
        return json(500, { error: e.message || String(e) });
    }
}


