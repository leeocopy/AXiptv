// Vercel Serverless Function — CORS Proxy for Xtream API
// This runs server-side, so it bypasses:
//   1. CORS (browser blocks cross-origin requests)
//   2. Mixed Content (HTTPS page can't fetch HTTP resources)
//
// Usage: GET /api/proxy?url=http://server.com:port/player_api.php?username=x&password=y&action=...

export default async function handler(req, res) {
    // Allow all origins (or restrict to your domain)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({
            error: 'Missing "url" query parameter',
            usage: '/api/proxy?url=http://server.com:port/player_api.php?username=x&password=y&action=get_live_categories'
        });
    }

    // Validate URL format
    try {
        const parsed = new URL(targetUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return res.status(400).json({ error: 'URL must use http or https protocol' });
        }
    } catch (e) {
        return res.status(400).json({ error: `Invalid URL: ${e.message}` });
    }

    console.log(`[Proxy] Fetching: ${targetUrl}`);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

        const response = await fetch(targetUrl, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'User-Agent': 'IPTVStream/1.0',
                'Accept': 'application/json, text/plain, */*',
            },
        });

        clearTimeout(timeoutId);

        const contentType = response.headers.get('content-type') || '';
        const body = await response.text();

        // Forward the response
        res.setHeader('Content-Type', contentType || 'application/json');
        res.setHeader('X-Proxy-Status', response.status.toString());
        return res.status(response.status).send(body);

    } catch (error) {
        console.error(`[Proxy] Error: ${error.message}`);

        const isTimeout = error.name === 'AbortError';
        const statusCode = isTimeout ? 504 : 502;

        return res.status(statusCode).json({
            error: isTimeout ? 'Request timed out (20s)' : `Proxy fetch failed: ${error.message}`,
            targetUrl,
            suggestion: isTimeout
                ? 'The IPTV server may be down or unreachable from this region.'
                : 'Check if the server URL and port are correct.',
        });
    }
}
