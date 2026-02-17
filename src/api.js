// Xtream Codes API Service
// Handles authentication and data fetching for Live TV, Movies, and Series
// Now with CORS proxy support for browser-based access

const MOCK_DELAY = 800;

// ============================================
// CORS PROXY — Bypass browser CORS restrictions
// ============================================
// Xtream servers don't set CORS headers, so browser blocks fetch().
// We try direct first, then fallback to CORS proxies.

const CORS_PROXIES = [
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

let activeCorsProxy = null; // Cache working proxy

async function fetchWithCorsProxy(url, timeoutMs = 12000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // 1. Try direct fetch first (works if server has CORS headers or same-origin)
    try {
        const resp = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (resp.ok) {
            activeCorsProxy = null; // Direct works
            return resp;
        }
    } catch (e) {
        clearTimeout(timeoutId);
        // CORS blocked or network error — try proxies
    }

    // 2. If we have a cached working proxy, try it first
    if (activeCorsProxy) {
        try {
            const controller2 = new AbortController();
            const tid2 = setTimeout(() => controller2.abort(), timeoutMs);
            const proxyUrl = activeCorsProxy(url);
            const resp = await fetch(proxyUrl, { signal: controller2.signal });
            clearTimeout(tid2);
            if (resp.ok) return resp;
        } catch (e) {
            activeCorsProxy = null; // Cached proxy failed
        }
    }

    // 3. Try each proxy in order
    for (const proxyFn of CORS_PROXIES) {
        try {
            const controller3 = new AbortController();
            const tid3 = setTimeout(() => controller3.abort(), timeoutMs);
            const proxyUrl = proxyFn(url);
            const resp = await fetch(proxyUrl, { signal: controller3.signal });
            clearTimeout(tid3);
            if (resp.ok) {
                activeCorsProxy = proxyFn; // Cache for future calls
                console.log('[API] CORS proxy found and cached');
                return resp;
            }
        } catch (e) {
            // Try next proxy
            continue;
        }
    }

    throw new Error(`All CORS proxies failed for: ${url}`);
}

// ============================================
// Mock Data for fallback/demo purposes
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
            info: {
                name: 'Stranger Things',
                cover: '',
                plot: 'When a young boy disappears, his mother, a police chief and his friends must confront terrifying supernatural forces in order to get him back.',
                director: 'The Duffer Brothers',
                cast: 'Millie Bobby Brown, Finn Wolfhard, Winona Ryder',
                genre: 'Sci-Fi, Horror, Drama',
                releaseDate: '2016-07-15',
                rating: '8.7',
                backdrop_path: '',
            },
            seasons: {
                '1': [
                    { id: '1001', episode_num: 1, title: 'Chapter One: The Vanishing of Will Byers', container_extension: 'mp4', info: { duration: '48 min' } },
                    { id: '1002', episode_num: 2, title: 'Chapter Two: The Weirdo on Maple Street', container_extension: 'mp4', info: { duration: '55 min' } },
                    { id: '1003', episode_num: 3, title: 'Chapter Three: Holly, Jolly', container_extension: 'mp4', info: { duration: '51 min' } },
                    { id: '1004', episode_num: 4, title: 'Chapter Four: The Body', container_extension: 'mp4', info: { duration: '50 min' } },
                    { id: '1005', episode_num: 5, title: 'Chapter Five: The Flea and the Acrobat', container_extension: 'mp4', info: { duration: '52 min' } },
                ],
                '2': [
                    { id: '2001', episode_num: 1, title: 'Chapter One: MADMAX', container_extension: 'mp4', info: { duration: '48 min' } },
                    { id: '2002', episode_num: 2, title: 'Chapter Two: Trick or Treat, Freak', container_extension: 'mp4', info: { duration: '56 min' } },
                    { id: '2003', episode_num: 3, title: 'Chapter Three: The Pollywog', container_extension: 'mp4', info: { duration: '51 min' } },
                ],
            }
        },
        202: {
            info: {
                name: 'Game of Thrones',
                cover: '',
                plot: 'Nine noble families fight for control over the lands of Westeros, while an ancient enemy returns after being dormant for millennia.',
                director: 'David Benioff, D.B. Weiss',
                cast: 'Emilia Clarke, Peter Dinklage, Kit Harington',
                genre: 'Fantasy, Drama, Adventure',
                releaseDate: '2011-04-17',
                rating: '9.3',
                backdrop_path: '',
            },
            seasons: {
                '1': [
                    { id: '3001', episode_num: 1, title: 'Winter Is Coming', container_extension: 'mkv', info: { duration: '62 min' } },
                    { id: '3002', episode_num: 2, title: 'The Kingsroad', container_extension: 'mkv', info: { duration: '56 min' } },
                    { id: '3003', episode_num: 3, title: 'Lord Snow', container_extension: 'mkv', info: { duration: '58 min' } },
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
    _authenticated: false, // Track if we actually verified creds
    _serverInfo: null,     // Cache server info from auth response

    init(url, user, pass) {
        // Normalize URL: remove trailing slash
        this.baseUrl = (url || '').replace(/\/+$/, '');
        this.username = user || '';
        this.password = pass || '';
        this._authenticated = false;
        this._serverInfo = null;
    },

    // Build the player_api.php base URL
    _apiBase() {
        return `${this.baseUrl}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`;
    },

    // Build stream URL for the player (direct - no proxy needed for media streams)
    getStreamUrl(streamId, type = 'live', containerExtension = null) {
        if (!this.baseUrl) {
            if (type === 'live') {
                return 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
            }
            return 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
        }

        if (type === 'live') {
            const ext = containerExtension || 'ts';
            return `${this.baseUrl}/live/${this.username}/${this.password}/${streamId}.${ext}`;
        }

        const ext = containerExtension || 'mp4';
        const prefix = type === 'movie' ? 'movie' : 'series';
        return `${this.baseUrl}/${prefix}/${this.username}/${this.password}/${streamId}.${ext}`;
    },

    // Returns an array of fallback URLs for live streams (tried in order)
    getLiveStreamUrls(streamId) {
        if (!this.baseUrl) {
            return ['https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'];
        }
        return [
            `${this.baseUrl}/live/${this.username}/${this.password}/${streamId}.ts`,
            `${this.baseUrl}/live/${this.username}/${this.password}/${streamId}.m3u8`,
            `${this.baseUrl}/${this.username}/${this.password}/${streamId}.ts`,
            `${this.baseUrl}/${this.username}/${this.password}/${streamId}.m3u8`,
        ];
    },

    // ============================================
    // AUTHENTICATE — Actually verify credentials
    // ============================================
    async authenticate() {
        if (!this.baseUrl) {
            // No URL = demo mode, auto-pass
            this._authenticated = true;
            return true;
        }

        const url = this._apiBase();
        console.log('[API] Authenticating with:', this.baseUrl);

        try {
            const response = await fetchWithCorsProxy(url, 15000);
            const data = await response.json();

            // Xtream API returns user_info with auth status
            if (data && data.user_info) {
                const userInfo = data.user_info;
                if (userInfo.auth === 1 || userInfo.auth === '1' || userInfo.status === 'Active') {
                    console.log('[API] ✅ Authentication successful:', userInfo.username);
                    this._authenticated = true;
                    this._serverInfo = data.server_info || null;
                    return true;
                } else {
                    console.warn('[API] ❌ Auth failed — account not active:', userInfo.status);
                    return false;
                }
            }

            // Some servers return differently — if we got a JSON response, consider it OK
            if (data && typeof data === 'object') {
                console.log('[API] ✅ Got response from server (non-standard format)');
                this._authenticated = true;
                return true;
            }

            return false;
        } catch (error) {
            console.error('[API] ❌ Authentication failed:', error.message);
            return false;
        }
    },

    // ============================================
    // GET CATEGORIES
    // ============================================
    async getCategories(type = 'live') {
        let action = 'get_live_categories';
        let mockKey = 'liveCategories';

        if (type === 'movie') {
            action = 'get_vod_categories';
            mockKey = 'vodCategories';
        } else if (type === 'series') {
            action = 'get_series_categories';
            mockKey = 'seriesCategories';
        }

        if (!this.baseUrl) return MOCK_DATA[mockKey];

        try {
            const url = `${this._apiBase()}&action=${action}`;
            console.log(`[API] Fetching categories: ${action}`);
            const response = await fetchWithCorsProxy(url);
            const data = await response.json();

            if (Array.isArray(data) && data.length > 0) {
                console.log(`[API] ✅ Got ${data.length} categories`);
                return data;
            }

            console.warn('[API] Categories response was empty or invalid, using mock');
            return MOCK_DATA[mockKey];
        } catch (error) {
            console.warn('[API] Categories fetch failed, using mock:', error.message);
            return MOCK_DATA[mockKey];
        }
    },

    // ============================================
    // GET STREAMS
    // ============================================
    async getStreams(type = 'live', categoryId = null) {
        let action = 'get_live_streams';
        let mockKey = 'liveStreams';

        if (type === 'movie') {
            action = 'get_vod_streams';
            mockKey = 'vodStreams';
        } else if (type === 'series') {
            action = 'get_series';
            mockKey = 'series';
        }

        if (!this.baseUrl) {
            let data = MOCK_DATA[mockKey];
            if (categoryId && categoryId !== 'All') {
                data = data.filter(item => item.category_id === categoryId);
            }
            return data;
        }

        try {
            let url = `${this._apiBase()}&action=${action}`;
            if (categoryId && categoryId !== 'All') {
                url += `&category_id=${categoryId}`;
            }
            console.log(`[API] Fetching streams: ${action}${categoryId ? ` (cat: ${categoryId})` : ''}`);
            const response = await fetchWithCorsProxy(url);
            const data = await response.json();

            if (Array.isArray(data) && data.length > 0) {
                console.log(`[API] ✅ Got ${data.length} streams`);
                return data;
            }

            console.warn('[API] Streams response was empty or invalid');
            // Don't fall back to mock if we have a real server — just show empty
            return [];
        } catch (error) {
            console.warn('[API] Streams fetch failed:', error.message);
            // Return empty rather than mock when real server is configured
            return [];
        }
    },

    // ============================================
    // GET SERIES INFO
    // ============================================
    async getSeriesInfo(seriesId) {
        if (!this.baseUrl) {
            const mockInfo = MOCK_DATA.seriesInfo[seriesId];
            if (mockInfo) {
                return new Promise(resolve => setTimeout(() => resolve(mockInfo), MOCK_DELAY));
            }
            return new Promise(resolve => setTimeout(() => resolve({
                info: {
                    name: 'Unknown Series',
                    plot: 'No description available.',
                    director: 'N/A',
                    cast: 'N/A',
                    genre: 'N/A',
                    releaseDate: 'N/A',
                    rating: 'N/A',
                    cover: '',
                },
                seasons: {
                    '1': [
                        { id: '9001', episode_num: 1, title: 'Episode 1', container_extension: 'mp4', info: { duration: '45 min' } },
                        { id: '9002', episode_num: 2, title: 'Episode 2', container_extension: 'mp4', info: { duration: '45 min' } },
                    ]
                }
            }), MOCK_DELAY));
        }

        try {
            const url = `${this._apiBase()}&action=get_series_info&series_id=${seriesId}`;
            console.log(`[API] Fetching series info: ${seriesId}`);
            const response = await fetchWithCorsProxy(url);
            const data = await response.json();
            return {
                info: data.info || {},
                seasons: data.episodes || {},
            };
        } catch (error) {
            console.warn('[API] Series info fetch failed:', error.message);
            const mockInfo = MOCK_DATA.seriesInfo[seriesId];
            return mockInfo || { info: {}, seasons: {} };
        }
    },

    // ============================================
    // GET ACCOUNT INFO (Server + User details)
    // ============================================
    async getAccountInfo() {
        if (!this.baseUrl) return null;
        try {
            const url = this._apiBase();
            const response = await fetchWithCorsProxy(url);
            return await response.json();
        } catch (error) {
            console.warn('[API] Account info fetch failed:', error.message);
            return null;
        }
    }
};
