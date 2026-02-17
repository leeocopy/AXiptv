// Vercel Serverless Function — CORS Proxy for Xtream API
// Runs server-side → bypasses CORS + Mixed Content
//
// Usage:  GET /api/proxy?url=http://server.com:port/player_api.php?username=x&password=y
// Vercel auto-maps: /api/proxy → api/proxy.js (this file)
//
// NOTE: package.json has "type": "module" → we MUST use ESM export default

export default async function handler(req, res) {
    // ── CORS headers on EVERY response (including errors) ──
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
    res.setHeader('Access-Control-Expose-Headers', 'X-Proxy-Status, X-Proxy-Host');
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
            proxyError: true,
            error: 'Missing "url" query parameter.',
            usage: '/api/proxy?url=http://server.com:port/player_api.php?username=USER&password=PASS',
        });
    }

    // ── Validate URL ──
    let parsedUrl;
    try {
        parsedUrl = new URL(targetUrl);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return res.status(400).json({
                ok: false,
                proxyError: true,
                error: `Invalid protocol "${parsedUrl.protocol}". Must be http: or https:.`,
            });
        }
    } catch (e) {
        return res.status(400).json({
            ok: false,
            proxyError: true,
            error: `Invalid URL format: ${e.message}`,
        });
    }

    const hostLabel = `${parsedUrl.hostname}:${parsedUrl.port || (parsedUrl.protocol === 'https:' ? '443' : '80')}`;
    console.log(`[Proxy] → ${req.method} ${hostLabel}${parsedUrl.pathname}${parsedUrl.search ? '?' + parsedUrl.search.substring(1, 50) + '...' : ''}`);

    // ── Fetch from the real IPTV server ──
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        // Forward relevant headers from the client request to the upstream server
        const forwardHeaders = {
            'User-Agent': req.headers['user-agent'] || 'IPTVStreamProxy/2.0',
            'Accept': req.headers['accept'] || '*/*',
            'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
            'Accept-Encoding': 'identity', // Don't request gzip from upstream (we need to read the body)
        };

        // Forward Authorization header if present
        if (req.headers['authorization']) {
            forwardHeaders['Authorization'] = req.headers['authorization'];
        }

        // Forward Content-Type for POST requests
        if (req.headers['content-type']) {
            forwardHeaders['Content-Type'] = req.headers['content-type'];
        }

        const fetchOptions = {
            method: req.method === 'POST' ? 'POST' : 'GET',
            signal: controller.signal,
            headers: forwardHeaders,
            redirect: 'follow',
        };

        // Forward POST body
        if (req.method === 'POST' && req.body) {
            fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        }

        const upstream = await fetch(targetUrl, fetchOptions);
        clearTimeout(timeoutId);

        const body = await upstream.text();
        const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';

        // Set response headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('X-Proxy-Status', upstream.status.toString());
        res.setHeader('X-Proxy-Host', parsedUrl.hostname);

        // Forward cache headers from upstream
        const cacheControl = upstream.headers.get('cache-control');
        if (cacheControl) {
            res.setHeader('Cache-Control', cacheControl);
        }

        console.log(`[Proxy] ← ${upstream.status} ${upstream.statusText} (${body.length} bytes, ${contentType.split(';')[0]})`);

        return res.status(upstream.status).send(body);

    } catch (error) {
        console.error(`[Proxy] ERROR fetching ${hostLabel}: ${error.name}: ${error.message}`);

        if (error.name === 'AbortError') {
            return res.status(504).json({
                ok: false,
                proxyError: true,
                error: `Gateway Timeout — ${hostLabel} did not respond within 25 seconds.`,
                targetHost: parsedUrl.hostname,
                targetPort: parsedUrl.port || '80',
                suggestion: 'The IPTV server may be down, unreachable, or blocking requests from cloud providers.',
            });
        }

        // DNS failure, connection refused, network error, etc.
        return res.status(502).json({
            ok: false,
            proxyError: true,
            error: `Bad Gateway — could not connect to ${hostLabel}.`,
            detail: `${error.name}: ${error.message}`,
            targetHost: parsedUrl.hostname,
            targetPort: parsedUrl.port || '80',
            suggestion: 'Verify the server URL/port. The server may be offline or blocking cloud IPs.',
        });
    }
}
