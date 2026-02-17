// ============================================
// Xtream Codes API Service
// ============================================
// - Native (Capacitor APK): Direct fetch — no CORS, no proxy needed
// - Vercel (web): Uses /api/proxy serverless function
// - Localhost (dev): Falls back to public CORS proxies
// - Full debug logging — open browser console (F12)

const MOCK_DELAY = 800;

// ============================================
// ENVIRONMENT DETECTION
// ============================================
const _hostname = typeof window !== 'undefined' ? window.location.hostname : '';

// Capacitor native app detection (Android/iOS APK)
const IS_NATIVE = typeof window !== 'undefined' && (
    window.Capacitor !== undefined ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'ionic:' ||
    window.location.hostname === 'localhost' && window.Capacitor !== undefined ||
    navigator.userAgent.includes('CapacitorJS')
);

const IS_LOCALHOST = !IS_NATIVE && (_hostname === 'localhost' || _hostname === '127.0.0.1' || _hostname === '');
const IS_VERCEL = !IS_NATIVE && !IS_LOCALHOST && (
    _hostname.endsWith('.vercel.app') ||
    _hostname.endsWith('.vercel.sh') ||
    !IS_LOCALHOST
);

console.log(`[API] 🌐 Environment: hostname=${_hostname}, IS_NATIVE=${IS_NATIVE}, IS_LOCALHOST=${IS_LOCALHOST}, IS_VERCEL=${IS_VERCEL}`);
if (IS_NATIVE) {
    console.log('[API] 📱 Running as NATIVE APP — direct fetch, no proxy needed!');
}

// ============================================
// PROXY CONFIGURATION
// ============================================

// Vercel serverless proxy — only works when deployed on Vercel
function getVercelProxyUrl(url) {
    return `/api/proxy?url=${encodeURIComponent(url)}`;
}

// Public CORS proxies (fallback — only for web)
const PUBLIC_PROXIES = [
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

// Track which proxy method works (cached after first success)
let _proxyMode = IS_NATIVE ? 'direct' : null; // Native = always direct

// ============================================
// URL VALIDATION
// ============================================
function validateXtreamUrl(baseUrl, username, password) {
    const errors = [];

    if (!baseUrl) errors.push('Server URL is empty');
    if (!username) errors.push('Username is empty');
    if (!password) errors.push('Password is empty');

    if (baseUrl) {
        try {
            const parsed = new URL(baseUrl);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                errors.push(`Invalid protocol "${parsed.protocol}" — must be http: or https:`);
            }
        } catch (e) {
            errors.push(`Invalid URL format: ${e.message}. Expected: http://server.com:port`);
        }
    }

    return errors;
}

function buildApiUrl(baseUrl, username, password, action = null) {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    let url = `${cleanUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    if (action) {
        url += `&action=${action}`;
    }
    return url;
}

// ============================================
// HELPER — try a single fetch, log status
// ============================================
async function tryFetch(label, fetchUrl, timeoutMs) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const resp = await fetch(fetchUrl, { signal: controller.signal });
        clearTimeout(tid);

        if (resp.ok) {
            console.log(`[API] ✅ ${label} → HTTP ${resp.status} OK`);
            return { success: true, response: resp };
        }

        // Not OK — log the exact status and try to read error body
        let errorBody = '';
        let isProxyError = false;
        let isFirewallBlock = false;
        let proxyErrorMsg = '';
        try { errorBody = await resp.text(); } catch (_) { }

        console.warn(`[API] ⚠️ ${label} → HTTP ${resp.status} ${resp.statusText}`);
        if (errorBody) {
            console.warn(`[API] ⚠️ ${label} response body: ${errorBody.substring(0, 400)}`);
            // Check if the error body is a JSON proxy error
            try {
                const errJson = JSON.parse(errorBody);
                if (errJson.proxyError) {
                    isProxyError = true;
                    proxyErrorMsg = errJson.error || `Proxy error (HTTP ${resp.status})`;
                    if (errJson.firewallBlock) {
                        isFirewallBlock = true;
                        console.error(`[API] 🚫 FIREWALL BLOCK (HTTP 456) detected!`);
                    }
                    if (errJson.suggestion) console.info(`[API] 💡 ${errJson.suggestion}`);
                }
            } catch (_) { /* not JSON */ }
        }

        // Also detect raw 456 even without JSON body
        if (resp.status === 456) {
            isFirewallBlock = true;
            isProxyError = true;
            if (!proxyErrorMsg) proxyErrorMsg = 'Server Firewall Block (HTTP 456): The IPTV server is blocking this connection.';
            console.error(`[API] 🚫 HTTP 456 — Server firewall is blocking the request`);
        }

        return {
            success: false,
            status: resp.status,
            statusText: resp.statusText,
            body: errorBody,
            isProxyError,
            isFirewallBlock,
            proxyErrorMsg,
        };

    } catch (e) {
        clearTimeout(tid);
        const isAbort = e.name === 'AbortError';
        const isMixed = e.message && e.message.includes('Mixed Content');
        console.warn(`[API] ⚠️ ${label} → ${isAbort ? 'TIMEOUT' : isMixed ? 'MIXED CONTENT BLOCKED' : e.message}`);
        return { success: false, error: e.message, isTimeout: isAbort, isMixedContent: isMixed, isProxyError: true, isFirewallBlock: false, proxyErrorMsg: e.message };
    }
}

// ============================================
// SMART FETCH — Tries strategies in priority order
// ============================================
async function smartFetch(targetUrl, timeoutMs = 15000) {
    console.log(`[API] ─────────────────────────────────────`);
    console.log(`[API] 📡 smartFetch: ${targetUrl}`);

    let lastError = null;

    // ── Strategy 1: Vercel Proxy (SKIP on localhost) ──
    if (!IS_LOCALHOST && (_proxyMode === null || _proxyMode === 'vercel')) {
        const proxyUrl = getVercelProxyUrl(targetUrl);
        console.log(`[API] 🔀 [1/3] Vercel proxy: ${proxyUrl.substring(0, 80)}...`);

        const result = await tryFetch('Vercel proxy', proxyUrl, timeoutMs);
        if (result.success) {
            _proxyMode = 'vercel';
            return result.response;
        }

        lastError = result;

        // If 404 → proxy route doesn't exist on this deployment
        if (result.status === 404) {
            console.warn('[API] ⚠️ /api/proxy returned 404. Is the api/proxy.js file deployed?');
            console.warn('[API] ⚠️ Check: your repo must have api/proxy.js in the root (not src/)');
        }
        // If 500/502/504 → proxy exists but the upstream server failed
        else if (result.status >= 500) {
            console.warn(`[API] ⚠️ Vercel proxy responded but upstream failed (HTTP ${result.status})`);
            // Parse the structured error if possible
            if (result.body) {
                try {
                    const errData = JSON.parse(result.body);
                    if (errData.error) console.error(`[API] 🔴 Proxy error: ${errData.error}`);
                    if (errData.suggestion) console.info(`[API] 💡 ${errData.suggestion}`);
                } catch (_) { }
            }
        }
    } else if (IS_LOCALHOST) {
        console.log('[API] 🏠 Localhost detected — skipping Vercel proxy');
    }

    // ── Strategy 2: Direct fetch (works if IPTV server has CORS headers) ──
    if (_proxyMode === null || _proxyMode === 'direct') {
        console.log(`[API] 🔀 [2/3] Direct fetch: ${targetUrl.substring(0, 60)}...`);

        const result = await tryFetch('Direct fetch', targetUrl, timeoutMs);
        if (result.success) {
            _proxyMode = 'direct';
            return result.response;
        }
        lastError = result;

        if (result.isMixedContent) {
            console.error('[API] 🔴 MIXED CONTENT: HTTPS page cannot fetch from HTTP server.');
            console.error('[API] 🔴 Fix: Deploy with Vercel proxy OR use an HTTPS IPTV server URL.');
        }
    }

    // ── Strategy 3: Public CORS proxies (always available) ──
    for (let i = 0; i < PUBLIC_PROXIES.length; i++) {
        const proxyFn = PUBLIC_PROXIES[i];
        const proxyUrl = proxyFn(targetUrl);
        console.log(`[API] 🔀 [3/3] Public proxy #${i + 1}: ${proxyUrl.substring(0, 65)}...`);

        const result = await tryFetch(`Public proxy #${i + 1}`, proxyUrl, timeoutMs);
        if (result.success) {
            _proxyMode = 'public';
            return result.response;
        }
        lastError = result;
    }

    // ── All strategies exhausted ──
    const lastStatus = lastError?.status ? ` (last HTTP status: ${lastError.status})` : '';
    const lastDetail = lastError?.error ? ` (${lastError.error})` : '';

    const errMsg = IS_LOCALHOST
        ? `All CORS proxies failed${lastStatus}${lastDetail}. Public proxies may be down or IPTV server is unreachable.`
        : `All proxies failed${lastStatus}${lastDetail}. Ensure api/proxy.js is deployed and the IPTV server is reachable.`;

    console.error(`[API] 🔴 ═══ ALL FETCH STRATEGIES FAILED ═══`);
    console.error(`[API] 🔴 Target: ${targetUrl}`);
    console.error(`[API] 🔴 Env: localhost=${IS_LOCALHOST}, proxyMode=${_proxyMode}`);
    console.error(`[API] 🔴 ${errMsg}`);

    throw new Error(errMsg);
}

// ============================================
// Mock Data for fallback/demo
// ============================================
const MOCK_DATA = {
    liveCategories: [
        { category_id: '1', category_name: 'Sports' },
        { category_id: '2', category_name: 'Entertainment' },
        { category_id: '3', category_name: 'News' },
        { category_id: '4', category_name: 'Kids' },
        { category_id: '5', category_name: 'Movies' },
    ],
    liveStreams: [
        { stream_id: 1, name: 'Sky Sports Main Event', stream_icon: '', category_id: '1' },
        { stream_id: 2, name: 'CNN International', stream_icon: '', category_id: '3' },
        { stream_id: 3, name: 'BBC One', stream_icon: '', category_id: '2' },
        { stream_id: 4, name: 'Cartoon Network', stream_icon: '', category_id: '4' },
        { stream_id: 5, name: 'HBO', stream_icon: '', category_id: '5' },
        { stream_id: 6, name: 'ESPN', stream_icon: '', category_id: '1' },
    ],
    vodCategories: [
        { category_id: '10', category_name: 'Action' },
        { category_id: '11', category_name: 'Comedy' },
        { category_id: '12', category_name: 'Drama' },
    ],
    vodStreams: [
        { stream_id: 101, name: 'Inception', stream_icon: '', rating: '8.8', category_id: '10', container_extension: 'mp4' },
        { stream_id: 102, name: 'The Dark Knight', stream_icon: '', rating: '9.0', category_id: '10', container_extension: 'mp4' },
        { stream_id: 103, name: 'Superbad', stream_icon: '', rating: '7.6', category_id: '11', container_extension: 'mkv' },
        { stream_id: 104, name: 'The Godfather', stream_icon: '', rating: '9.2', category_id: '12', container_extension: 'mp4' },
    ],
    seriesCategories: [
        { category_id: '20', category_name: 'Netflix Originals' },
        { category_id: '21', category_name: 'HBO' },
    ],
    series: [
        { series_id: 201, name: 'Stranger Things', cover: '', rating: '8.7', category_id: '20', container_extension: 'mp4' },
        { series_id: 202, name: 'Game of Thrones', cover: '', rating: '9.3', category_id: '21', container_extension: 'mkv' },
    ],
    seriesInfo: {
        201: {
            info: { name: 'Stranger Things', cover: '', plot: 'When a young boy disappears...', director: 'The Duffer Brothers', cast: 'Millie Bobby Brown, Finn Wolfhard', genre: 'Sci-Fi, Horror', releaseDate: '2016-07-15', rating: '8.7', backdrop_path: '' },
            seasons: {
                '1': [
                    { id: '1001', episode_num: 1, title: 'The Vanishing of Will Byers', container_extension: 'mp4', info: { duration: '48 min' } },
                    { id: '1002', episode_num: 2, title: 'The Weirdo on Maple Street', container_extension: 'mp4', info: { duration: '55 min' } },
                    { id: '1003', episode_num: 3, title: 'Holly, Jolly', container_extension: 'mp4', info: { duration: '51 min' } },
                ],
                '2': [
                    { id: '2001', episode_num: 1, title: 'MADMAX', container_extension: 'mp4', info: { duration: '48 min' } },
                    { id: '2002', episode_num: 2, title: 'Trick or Treat, Freak', container_extension: 'mp4', info: { duration: '56 min' } },
                ],
            }
        },
        202: {
            info: { name: 'Game of Thrones', cover: '', plot: 'Nine noble families fight...', director: 'David Benioff', cast: 'Emilia Clarke, Peter Dinklage', genre: 'Fantasy, Drama', releaseDate: '2011-04-17', rating: '9.3', backdrop_path: '' },
            seasons: {
                '1': [
                    { id: '3001', episode_num: 1, title: 'Winter Is Coming', container_extension: 'mkv', info: { duration: '62 min' } },
                    { id: '3002', episode_num: 2, title: 'The Kingsroad', container_extension: 'mkv', info: { duration: '56 min' } },
                ],
                '2': [
                    { id: '4001', episode_num: 1, title: 'The North Remembers', container_extension: 'mkv', info: { duration: '53 min' } },
                    { id: '4002', episode_num: 2, title: 'The Night Lands', container_extension: 'mkv', info: { duration: '54 min' } },
                ],
            }
        }
    }
};

// ============================================
// XTREAM SERVICE
// ============================================
export const xtreamService = {
    baseUrl: '',
    username: '',
    password: '',
    _authenticated: false,
    _serverInfo: null,

    init(url, user, pass) {
        this.baseUrl = (url || '').replace(/\/+$/, '');
        this.username = user || '';
        this.password = pass || '';
        this._authenticated = false;
        this._serverInfo = null;
        _proxyMode = null; // Reset proxy cache on new init

        // Validate and log
        const errors = validateXtreamUrl(this.baseUrl, this.username, this.password);
        if (errors.length > 0) {
            console.warn('[API] ⚠️ URL Validation issues:', errors);
        } else if (this.baseUrl) {
            console.log(`[API] 🔧 Initialized: ${this.baseUrl} | user: ${this.username}`);
            console.log(`[API] 🔧 API endpoint: ${buildApiUrl(this.baseUrl, this.username, this.password, 'get_live_categories')}`);
        }
    },

    getStreamUrl(streamId, type = 'live', containerExtension = null) {
        if (!this.baseUrl) {
            return type === 'live'
                ? 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'
                : 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
        }

        if (type === 'live') {
            const ext = containerExtension || 'ts';
            return `${this.baseUrl}/live/${this.username}/${this.password}/${streamId}.${ext}`;
        }

        const ext = containerExtension || 'mp4';
        const prefix = type === 'movie' ? 'movie' : 'series';
        return `${this.baseUrl}/${prefix}/${this.username}/${this.password}/${streamId}.${ext}`;
    },

    getLiveStreamUrls(streamId) {
        if (!this.baseUrl) return ['https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'];
        return [
            `${this.baseUrl}/live/${this.username}/${this.password}/${streamId}.ts`,
            `${this.baseUrl}/live/${this.username}/${this.password}/${streamId}.m3u8`,
            `${this.baseUrl}/${this.username}/${this.password}/${streamId}.ts`,
            `${this.baseUrl}/${this.username}/${this.password}/${streamId}.m3u8`,
        ];
    },

    // ============================================
    // AUTHENTICATE
    // ============================================
    async authenticate() {
        if (!this.baseUrl) {
            console.log('[API] Demo mode (no server URL)');
            this._authenticated = true;
            return true;
        }

        const errors = validateXtreamUrl(this.baseUrl, this.username, this.password);
        if (errors.length > 0) {
            console.error('[API] 🔴 Cannot authenticate — validation errors:', errors);
            return false;
        }

        const apiUrl = buildApiUrl(this.baseUrl, this.username, this.password);
        console.log('[API] 🔐 Authenticating...');
        console.log(`[API] 🔐 Full URL: ${apiUrl}`);

        try {
            const response = await smartFetch(apiUrl, 20000);
            const text = await response.text();

            console.log(`[API] 📦 Raw response (first 500 chars): ${text.substring(0, 500)}`);

            // Check if the proxy returned an error JSON
            // (this happens when the proxy itself connected OK but the upstream server failed)
            let data;
            try {
                data = JSON.parse(text);
            } catch (parseErr) {
                console.error(`[API] 🔴 Response is not valid JSON: ${parseErr.message}`);
                console.error(`[API] 🔴 Response text: ${text.substring(0, 200)}`);
                // Not JSON = likely HTML error page from the server
                throw new Error('PROXY_ERROR: Server returned invalid response (not JSON). The IPTV server may be down or the URL is wrong.');
            }

            // Detect proxy error responses (our proxy sets proxyError: true)
            if (data && data.proxyError === true) {
                const msg = data.error || 'Proxy connection failed';
                console.error(`[API] 🔴 Proxy connection error: ${msg}`);
                if (data.suggestion) console.info(`[API] 💡 ${data.suggestion}`);

                // Specific: firewall block (HTTP 456)
                if (data.firewallBlock) {
                    console.error('[API] 🚫 FIREWALL BLOCK — the IPTV server is actively rejecting connections');
                    throw new Error(`FIREWALL_BLOCK: ${msg}`);
                }

                throw new Error(`PROXY_ERROR: ${msg}`);
            }

            // Real Xtream API response
            if (data && data.user_info) {
                const ui = data.user_info;
                console.log('[API] 📋 User info:', JSON.stringify(ui, null, 2));

                if (ui.auth === 1 || ui.auth === '1' || ui.status === 'Active') {
                    console.log(`[API] ✅ Auth SUCCESS — User: ${ui.username}, Status: ${ui.status}, Exp: ${ui.exp_date || 'N/A'}`);
                    this._authenticated = true;
                    this._serverInfo = data.server_info || null;
                    return true;
                } else {
                    // This is a REAL auth failure (wrong username/password)
                    console.error(`[API] 🔴 Auth DENIED — Status: ${ui.status}, Auth: ${ui.auth}`);
                    console.error('[API] 🔴 This means the server responded but rejected your credentials.');
                    return false; // returns false (NOT a throw) = "wrong password" in UI
                }
            }

            // Non-standard response — but it IS valid JSON from the server
            if (data && typeof data === 'object') {
                // Check if it's an error-like object (some servers return {"error": "..."} )
                if (data.error) {
                    console.error(`[API] 🔴 Server error response: ${data.error}`);
                    throw new Error(`PROXY_ERROR: Server returned error: ${data.error}`);
                }
                console.log('[API] ✅ Got JSON response (non-standard format), treating as success');
                this._authenticated = true;
                return true;
            }

            console.error('[API] 🔴 Unexpected response format');
            throw new Error('PROXY_ERROR: Unexpected response format from server.');
        } catch (error) {
            console.error('[API] 🔴 Authentication error:', error.message);
            // Re-throw — the UI handler in App.jsx will check for PROXY_ERROR prefix
            throw error;
        }
    },

    // ============================================
    // GET CATEGORIES
    // ============================================
    async getCategories(type = 'live') {
        let action = 'get_live_categories';
        let mockKey = 'liveCategories';
        if (type === 'movie') { action = 'get_vod_categories'; mockKey = 'vodCategories'; }
        else if (type === 'series') { action = 'get_series_categories'; mockKey = 'seriesCategories'; }

        if (!this.baseUrl) return MOCK_DATA[mockKey];

        const apiUrl = buildApiUrl(this.baseUrl, this.username, this.password, action);
        console.log(`[API] 📂 getCategories(${type}) → ${action}`);

        try {
            const response = await smartFetch(apiUrl);
            const text = await response.text();

            let data;
            try { data = JSON.parse(text); }
            catch (e) {
                console.error(`[API] 🔴 Categories response not JSON: ${text.substring(0, 200)}`);
                return MOCK_DATA[mockKey];
            }

            if (Array.isArray(data) && data.length > 0) {
                console.log(`[API] ✅ Got ${data.length} ${type} categories`);
                return data;
            }

            console.warn(`[API] ⚠️ Empty categories response for ${type}`);
            return MOCK_DATA[mockKey];
        } catch (error) {
            console.error(`[API] 🔴 getCategories(${type}) FAILED: ${error.message}`);
            return MOCK_DATA[mockKey];
        }
    },

    // ============================================
    // GET STREAMS
    // ============================================
    async getStreams(type = 'live', categoryId = null) {
        let action = 'get_live_streams';
        let mockKey = 'liveStreams';
        if (type === 'movie') { action = 'get_vod_streams'; mockKey = 'vodStreams'; }
        else if (type === 'series') { action = 'get_series'; mockKey = 'series'; }

        if (!this.baseUrl) {
            let data = MOCK_DATA[mockKey];
            if (categoryId && categoryId !== 'All') data = data.filter(item => item.category_id === categoryId);
            return data;
        }

        let apiUrl = buildApiUrl(this.baseUrl, this.username, this.password, action);
        if (categoryId && categoryId !== 'All') apiUrl += `&category_id=${categoryId}`;

        console.log(`[API] 📺 getStreams(${type}${categoryId ? ', cat:' + categoryId : ''})`);

        try {
            const response = await smartFetch(apiUrl);
            const text = await response.text();

            let data;
            try { data = JSON.parse(text); }
            catch (e) {
                console.error(`[API] 🔴 Streams response not JSON: ${text.substring(0, 200)}`);
                return [];
            }

            if (Array.isArray(data)) {
                console.log(`[API] ✅ Got ${data.length} ${type} streams`);
                return data;
            }

            console.warn(`[API] ⚠️ Streams response is not an array`);
            return [];
        } catch (error) {
            console.error(`[API] 🔴 getStreams(${type}) FAILED: ${error.message}`);
            return [];
        }
    },

    // ============================================
    // GET SERIES INFO
    // ============================================
    async getSeriesInfo(seriesId) {
        if (!this.baseUrl) {
            const mockInfo = MOCK_DATA.seriesInfo[seriesId];
            return mockInfo || { info: { name: 'Unknown', plot: 'N/A', director: 'N/A', cast: 'N/A', genre: 'N/A', releaseDate: 'N/A', rating: 'N/A' }, seasons: {} };
        }

        const apiUrl = buildApiUrl(this.baseUrl, this.username, this.password, 'get_series_info') + `&series_id=${seriesId}`;
        console.log(`[API] 📺 getSeriesInfo(${seriesId})`);

        try {
            const response = await smartFetch(apiUrl);
            const data = await response.json();
            return { info: data.info || {}, seasons: data.episodes || {} };
        } catch (error) {
            console.error(`[API] 🔴 getSeriesInfo(${seriesId}) FAILED: ${error.message}`);
            return MOCK_DATA.seriesInfo[seriesId] || { info: {}, seasons: {} };
        }
    },

    // ============================================
    // GET ACCOUNT INFO
    // ============================================
    async getAccountInfo() {
        if (!this.baseUrl) return null;
        try {
            const apiUrl = buildApiUrl(this.baseUrl, this.username, this.password);
            const response = await smartFetch(apiUrl);
            return await response.json();
        } catch (error) {
            console.error('[API] 🔴 getAccountInfo FAILED:', error.message);
            return null;
        }
    }
};
