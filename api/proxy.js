// Vercel Serverless Function — CORS Proxy for Xtream API
// Runs server-side → bypasses CORS + Mixed Content
//
// Usage:  GET /api/proxy?url=http://server.com:port/player_api.php?username=x&password=y
// Vercel auto-maps: /api/proxy → api/proxy.js (this file)
//
// IMPORTANT: Must use module.exports (CommonJS) for Vercel Node.js runtime

module.exports = async function handler(req, res) {
    // ── CORS headers on EVERY response ──
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');

    // Handle preflight (OPTIONS)
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    // ── Extract target URL ──
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({
            ok: false,
            error: 'Missing "url" query parameter.',
            usage: '/api/proxy?url=http://server.com:port/player_api.php?username=USER&password=PASS',
            hint: 'The full Xtream URL (including query params) must be passed as the "url" param.'
        });
    }

    // ── Validate URL ──
    let parsedUrl;
    try {
        parsedUrl = new URL(targetUrl);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return res.status(400).json({
                ok: false,
                error: `Invalid protocol "${parsedUrl.protocol}". Must be http: or https:.`,
                receivedUrl: targetUrl
            });
        }
    } catch (e) {
        return res.status(400).json({
            ok: false,
            error: `Invalid URL format: ${e.message}`,
            receivedUrl: targetUrl,
            hint: 'URL must be a valid http:// or https:// URL.'
        });
    }

    console.log(`[Proxy] → ${req.method} ${parsedUrl.hostname}:${parsedUrl.port || '80'}${parsedUrl.pathname}`);

    // ── Fetch from the real server ──
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

        const fetchOptions = {
            method: req.method === 'POST' ? 'POST' : 'GET',
            signal: controller.signal,
            headers: {
                'User-Agent': 'IPTVStreamProxy/2.0',
                'Accept': '*/*',
            },
        };

        // Forward POST body if needed
        if (req.method === 'POST' && req.body) {
            fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            fetchOptions.headers['Content-Type'] = req.headers['content-type'] || 'application/json';
        }

        const upstream = await fetch(targetUrl, fetchOptions);
        clearTimeout(timeoutId);

        const body = await upstream.text();
        const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';

        // Forward upstream status + headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('X-Proxy-Upstream-Status', upstream.status.toString());
        res.setHeader('X-Proxy-Upstream-Url', parsedUrl.hostname);

        console.log(`[Proxy] ← ${upstream.status} (${body.length} bytes)`);

        return res.status(upstream.status).send(body);

    } catch (error) {
        console.error(`[Proxy] ERROR: ${error.name}: ${error.message}`);

        if (error.name === 'AbortError') {
            return res.status(504).json({
                ok: false,
                error: 'Gateway Timeout — the IPTV server did not respond within 25 seconds.',
                targetHost: parsedUrl.hostname,
                targetPort: parsedUrl.port || '80',
                suggestion: 'The server may be down, blocking requests, or unreachable from Vercel\'s network.'
            });
        }

        // Connection refused, DNS failure, etc.
        return res.status(502).json({
            ok: false,
            error: `Bad Gateway — could not connect to the IPTV server.`,
            detail: `${error.name}: ${error.message}`,
            targetHost: parsedUrl.hostname,
            targetPort: parsedUrl.port || '80',
            suggestion: 'Check that the server URL and port are correct and the server is online.'
        });
    }
};
