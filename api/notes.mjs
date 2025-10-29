// Vercel Serverless Function (ESM) - Notes storage via Vercel KV
// Env vars (configure in Vercel project):
//  - KV_REST_API_URL
//  - KV_REST_API_TOKEN
//  - KV_URL (optional)
//  - KV_REST_API_READ_ONLY_TOKEN (optional)

import { kv } from '@vercel/kv';

function json(res, status, data) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return json(res, 200, {});

    try {
        if (req.method === 'GET') {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const placeId = url.searchParams.get('placeId');
            if (placeId) {
                const note = await kv.get(`note:${placeId}`);
                return json(res, 200, note || {});
            }
            const ids = (await kv.smembers('notes:index')) || [];
            if (ids.length === 0) return json(res, 200, []);
            const keys = ids.map((id) => `note:${id}`);
            const values = await kv.mget(...keys);
            return json(res, 200, values.filter(Boolean));
        }

        if (req.method === 'POST') {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) || {};
            if (!body.placeId) return json(res, 400, { error: 'placeId is required' });
            const record = {
                placeId: body.placeId,
                name: body.name || '',
                address: body.address || '',
                note: body.note || '',
                status: body.status || 'new',
                updatedAt: new Date().toISOString(),
            };
            await kv.set(`note:${record.placeId}`, record);
            await kv.sadd('notes:index', record.placeId);
            return json(res, 200, record);
        }

        if (req.method === 'DELETE') {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const placeId = url.searchParams.get('placeId');
            if (!placeId) return json(res, 400, { error: 'placeId is required' });
            await kv.del(`note:${placeId}`);
            await kv.srem('notes:index', placeId);
            return json(res, 200, { ok: true });
        }

        return json(res, 405, { error: 'Method not allowed' });
    } catch (e) {
        return json(res, 500, { error: e.message || String(e) });
    }
}


