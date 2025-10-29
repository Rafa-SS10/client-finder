Client Finder

Clean React + TypeScript app to find local businesses via Google Maps Places, filter for those without websites, and export to CSV/PDF.

Setup

1) Enable APIs in Google Cloud: Maps JavaScript API and Places API.
2) Create a browser API key and restrict by HTTP referrers.
3) Create a .env file in project root with:

VITE_GOOGLE_MAPS_API_KEY=your_api_key_here

4) Install and run:

npm install
npm run dev

Build

npm run build
npm run preview

Notes persistence (Vercel KV)

1) In Vercel, add KV (Upstash) integration to your project.
2) Set the following Environment Variables in Vercel Project Settings → Environment Variables:

- KV_URL (if provided by integration)
- KV_REST_API_URL
- KV_REST_API_TOKEN
- KV_REST_API_READ_ONLY_TOKEN (optional)

3) Deploy. The app uses /api/notes serverless endpoints to store notes keyed by Google place_id.

Local development fallback

- During local dev (Vite), /api/notes is not executed. The app transparently falls back to localStorage for create/list/edit/delete. On Vercel, it uses the serverless function with KV.

