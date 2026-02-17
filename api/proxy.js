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
    const hostPort = `${parsedUrl.hostname}:${parsedUrl.port || (parsedUrl.protocol === 'https:' ? '443' : '80')}`;

    // Aggressive device mimicking headers
    const options = {
        method: 'GET',
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        headers: {
            'User-Agent': 'IPTVSmarters/1.0.0 (Linux; Android 13; Google Pixel 6)',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'identity',
            'Connection': 'keep-alive',
            'X-Requested-With': 'com.nst.iptvsmarterstvbox',
            'Origin': `${parsedUrl.protocol}//${hostPort}`,
            'Referer': `${parsedUrl.protocol}//${hostPort}/`,
        },
        timeout: 25000
    };

    console.log(`[Proxy] -> ${hostPort}${parsedUrl.pathname}`);

    const proxyReq = protocol.request(options, (proxyRes) => {
        const statusCode = proxyRes.statusCode;
        const contentType = proxyRes.headers['content-type'] || 'application/json';

        console.log(`[Proxy] <- ${statusCode} ${contentType}`);

        // If NOT 200, collect body and return it as diagnostic info
        if (statusCode !== 200) {
            let bodyChunks = [];
            proxyRes.on('data', (chunk) => bodyChunks.push(chunk));
            proxyRes.on('end', () => {
                const rawBody = Buffer.concat(bodyChunks).toString('utf-8');
                const preview = rawBody.substring(0, 200);
                console.log(`[Proxy] ERROR body: ${preview}`);

                res.statusCode = statusCode;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                    proxyError: true,
                    firewallBlock: statusCode === 456,
                    upstreamStatus: statusCode,
                    error: `IPTV server returned HTTP ${statusCode}`,
                    bodyPreview: preview,
                    host: hostPort,
                    suggestion: statusCode === 456
                        ? 'Server firewall block. The server may be banning cloud/datacenter IPs (Vercel). Try a residential proxy or VPN.'
                        : `Server rejected with status ${statusCode}. Check credentials and server status.`
                }));
            });
            return;
        }

        // 200 OK — pipe through
        res.setHeader('Content-Type', contentType);
        res.statusCode = 200;
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        console.error('[Proxy] ERROR:', err.message);
        if (!res.headersSent) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                proxyError: true,
                error: 'Proxy failed to connect',
                details: err.message,
                host: hostPort
            }));
        }
    });

    proxyReq.on('timeout', () => {
        proxyReq.destroy();
        if (!res.headersSent) {
            res.statusCode = 504;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                proxyError: true,
                error: 'Gateway Timeout (25s)',
                host: hostPort
            }));
        }
    });

    proxyReq.end();
}
