const http = require('http');
const https = require('https');

module.exports = async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({ error: 'Missing URL parameter' });
    }

    try {
        const parsedUrl = new URL(targetUrl);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;

        // هادو هما الـ Headers اللي غايخليو السيرفر يثيق فينا
        const options = {
            method: 'GET',
            headers: {
                'User-Agent': 'IPTVSmarters/1.0.0', // التنكر في صورة Smarters
                'Accept': '*/*',
                'Connection': 'keep-alive',
                'Accept-Encoding': 'identity'
            }
        };

        const proxyReq = protocol.request(targetUrl, options, (proxyRes) => {
            // إضافة CORS باش الـ Frontend يقدر يقرا البيانات
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'application/json');

            proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
            console.error('Proxy Error:', err.message);
            res.status(500).json({ error: 'Proxy failed to connect to IPTV server', details: err.message });
        });

        proxyReq.end();

    } catch (error) {
        res.status(500).json({ error: 'Invalid URL provided', details: error.message });
    }
};
