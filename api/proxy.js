// Vercel Serverless Function — CORS Proxy for Xtream API
// Runs server-side → bypasses CORS + Mixed Content
//
// Usage:  GET /api/proxy?url=http://server.com:port/player_api.php?username=x&password=y
//
// IMPORTANT: Uses ESM export default (package.json has "type": "module")
// IMPORTANT: Mimics IPTV Smarters / real player User-Agent to avoid firewall blocks (456)

export default async function handler(req, res) {
    // ── CORS headers on EVERY response ──
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
    res.setHeader('Access-Control-Expose-Headers', 'X-Proxy-Status, X-Proxy-Host');
    res.setHeader('Access-Control-Max-Age', '86400');

    // Preflight
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

    // ── Validate URL (using modern new URL() constructor) ──
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
    console.log(`[Proxy] → ${req.method} ${hostLabel}${parsedUrl.pathname}`);

    // ── Fetch from the real IPTV server ──
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        // ── CRITICAL: Mimic a real IPTV player ──
        // Many Xtream servers have firewall rules that block requests
        // from cloud/proxy User-Agents. These UAs are known to work:
        const PLAYER_USER_AGENTS = [
            // IPTV Smarters Pro (most common, highest success rate)
            'IPTVSmarters/1.0.0 (Mobile; Android 12; SM-G991B)',
            // TiviMate (popular alternative)
            'TiviMate/4.7.0 (Mobile; Android 13)',
            // Qt embedded (used by STBs and many IPTV boxes)
            'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
            // VLC media player
            'VLC/3.0.18 LibVLC/3.0.18',
        ];

        // Use the first (IPTV Smarters) by default — highest compatibility
        const userAgent = PLAYER_USER_AGENTS[0];

        const fetchHeaders = {
            // ── Identity: Pretend to be IPTV Smarters ──
            'User-Agent': userAgent,

            // ── Standard browser-like headers ──
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',

            // ── Xtream-specific: some panels check these ──
            'X-Requested-With': 'com.nst.iptvsmarterstvbox',
        };

        // Forward Authorization if the client sent one
        if (req.headers['authorization']) {
            fetchHeaders['Authorization'] = req.headers['authorization'];
        }

        const fetchOptions = {
            method: req.method === 'POST' ? 'POST' : 'GET',
            signal: controller.signal,
            headers: fetchHeaders,
            redirect: 'follow',
        };

        // Forward POST body
        if (req.method === 'POST' && req.body) {
            fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            fetchHeaders['Content-Type'] = req.headers['content-type'] || 'application/x-www-form-urlencoded';
        }

        const upstream = await fetch(targetUrl, fetchOptions);
        clearTimeout(timeoutId);

        const body = await upstream.text();
        const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';

        // ── Handle specific error codes ──
        if (upstream.status === 456) {
            console.error(`[Proxy] ← 456 FIREWALL BLOCK from ${hostLabel}`);
            // Still return the status so the frontend can show a specific message
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('X-Proxy-Status', '456');
            res.setHeader('X-Proxy-Host', parsedUrl.hostname);
            return res.status(456).json({
                ok: false,
                proxyError: true,
                firewallBlock: true,
                error: `Server Firewall Block (HTTP 456): The IPTV server at ${hostLabel} is actively blocking this connection.`,
                suggestion: 'Try using a different server port, check if the server allows web-based players, or contact your IPTV provider.',
                upstreamStatus: 456,
            });
        }

        // Set response headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('X-Proxy-Status', upstream.status.toString());
        res.setHeader('X-Proxy-Host', parsedUrl.hostname);

        // Forward cache headers
        const cacheControl = upstream.headers.get('cache-control');
        if (cacheControl) {
            res.setHeader('Cache-Control', cacheControl);
        }

        console.log(`[Proxy] ← ${upstream.status} ${upstream.statusText} (${body.length} bytes, UA: ${userAgent.substring(0, 30)}...)`);

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
                suggestion: 'The IPTV server may be down, unreachable, or blocking cloud IPs.',
            });
        }

        return res.status(502).json({
            ok: false,
            proxyError: true,
            error: `Bad Gateway — could not connect to ${hostLabel}.`,
            detail: `${error.name}: ${error.message}`,
            targetHost: parsedUrl.hostname,
            targetPort: parsedUrl.port || '80',
            suggestion: 'Verify the server URL/port. The server may be offline or blocking cloud provider IPs.',
        });
    }
}
