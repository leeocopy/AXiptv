import http from 'http';
import https from 'https';

export default function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
    }

    const targetUrl = req.query.url;

    if (!targetUrl) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Missing URL parameter' }));
        return;
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(targetUrl);
    } catch (e) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Invalid URL', details: e.message }));
        return;
    }

    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
        method: 'GET',
        headers: {
            'User-Agent': 'IPTVSmarters/1.0.0',
            'Accept': '*/*',
            'Connection': 'keep-alive',
            'Accept-Encoding': 'identity'
        },
        timeout: 25000
    };

    console.log('[Proxy] ->', parsedUrl.hostname, parsedUrl.pathname);

    const proxyReq = protocol.request(targetUrl, options, (proxyRes) => {
        console.log('[Proxy] <-', proxyRes.statusCode, proxyRes.headers['content-type']);

        res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'application/json');
        res.statusCode = proxyRes.statusCode;

        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        console.error('[Proxy] ERROR:', err.message);
        if (!res.headersSent) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                error: 'Proxy failed to connect to IPTV server',
                details: err.message
            }));
        }
    });

    proxyReq.on('timeout', () => {
        proxyReq.destroy();
        if (!res.headersSent) {
            res.statusCode = 504;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Gateway Timeout' }));
        }
    });

    proxyReq.end();
}
