// Diagnostic endpoint — hit /api/test to verify Vercel sees the api/ folder
// If this returns {"status":"ok"} then Vercel serverless functions are working
// and the issue is specifically with proxy.cjs
//
// Safe to delete after debugging is done.

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        node: process.version,
        method: req.method,
        url: req.url,
        query: req.query,
        message: 'Vercel serverless functions are working! The api/ folder is detected.',
    });
}
