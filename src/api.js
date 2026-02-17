// Xtream Codes API Service
// Handles authentication and data fetching for Live TV, Movies, and Series

const MOCK_DELAY = 800;

// Mock Data for fallback/demo purposes
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
    // Mock series info for detail pages
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

export const xtreamService = {
    baseUrl: '',
    username: '',
    password: '',

    init(url, user, pass) {
        this.baseUrl = url;
        this.username = user;
        this.password = pass;
    },

    // Build stream URL for the player
    // Xtream Codes API URL formats:
    //   Live TV:  http://{host}:{port}/live/{username}/{password}/{stream_id}.ts     (most compatible)
    //   Live HLS: http://{host}:{port}/live/{username}/{password}/{stream_id}.m3u8   (HLS adaptive)
    //   Live Alt: http://{host}:{port}/{username}/{password}/{stream_id}              (some panels)
    //   Movies:   http://{host}:{port}/movie/{username}/{password}/{stream_id}.{ext}
    //   Series:   http://{host}:{port}/series/{username}/{password}/{stream_id}.{ext}
    getStreamUrl(streamId, type = 'live', containerExtension = null) {
        if (!this.baseUrl) {
            // Demo/mock mode: return public test streams
            if (type === 'live') {
                return 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
            }
            return 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
        }

        if (type === 'live') {
            // Live TV: use /live/ prefix with .ts as the primary format (most compatible)
            const ext = containerExtension || 'ts';
            return `${this.baseUrl}/live/${this.username}/${this.password}/${streamId}.${ext}`;
        }

        // Movies and Series use the container extension from the API
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
            // 1. Primary: /live/ prefix with .ts (MPEG-TS, most servers)
            `${this.baseUrl}/live/${this.username}/${this.password}/${streamId}.ts`,
            // 2. HLS variant with /live/ prefix
            `${this.baseUrl}/live/${this.username}/${this.password}/${streamId}.m3u8`,
            // 3. Without /live/ prefix (some panels)
            `${this.baseUrl}/${this.username}/${this.password}/${streamId}.ts`,
            // 4. HLS without /live/ prefix
            `${this.baseUrl}/${this.username}/${this.password}/${streamId}.m3u8`,
        ];
    },

    // Check if the IPTV server is reachable
    async checkServerReachable() {
        if (!this.baseUrl) return { reachable: true, mode: 'mock' };
        try {
            // Try to reach the player_api endpoint (lightweight)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(
                `${this.baseUrl}/player_api.php?username=${this.username}&password=${this.password}`,
                { signal: controller.signal, mode: 'no-cors' }
            );
            clearTimeout(timeoutId);
            return { reachable: true, status: response.status };
        } catch (err) {
            return { reachable: false, error: err.message };
        }
    },

    async authenticate() {
        // In a real app, verify credentials here
        return new Promise(resolve => setTimeout(() => resolve(true), MOCK_DELAY));
    },

    async getCategories(type = 'live') {
        // action: get_live_categories, get_vod_categories, get_series_categories
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
            const response = await fetch(`${this.baseUrl}/player_api.php?username=${this.username}&password=${this.password}&action=${action}`);
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.warn('API fetch failed, falling back to mock data', error);
            return MOCK_DATA[mockKey];
        }
    },

    async getStreams(type = 'live', categoryId = null) {
        // action: get_live_streams, get_vod_streams, get_series
        let action = 'get_live_streams';
        let mockKey = 'liveStreams';

        if (type === 'movie') {
            action = 'get_vod_streams';
            mockKey = 'vodStreams';
        } else if (type === 'series') {
            action = 'get_series'; // xtream codes uses get_series, not get_series_streams
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
            let url = `${this.baseUrl}/player_api.php?username=${this.username}&password=${this.password}&action=${action}`;
            if (categoryId && categoryId !== 'All') {
                url += `&category_id=${categoryId}`;
            }
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.warn('API fetch failed, falling back to mock data', error);
            let data = MOCK_DATA[mockKey];
            if (categoryId && categoryId !== 'All') {
                data = data.filter(item => item.category_id === categoryId);
            }
            return data;
        }
    },

    // Fetch detailed series info (seasons + episodes)
    // Xtream API: action=get_series_info&series_id={id}
    async getSeriesInfo(seriesId) {
        if (!this.baseUrl) {
            // Mock data
            const mockInfo = MOCK_DATA.seriesInfo[seriesId];
            if (mockInfo) {
                return new Promise(resolve => setTimeout(() => resolve(mockInfo), MOCK_DELAY));
            }
            // Fallback generic mock
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
            const response = await fetch(
                `${this.baseUrl}/player_api.php?username=${this.username}&password=${this.password}&action=get_series_info&series_id=${seriesId}`
            );
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            return {
                info: data.info || {},
                seasons: data.episodes || {},
            };
        } catch (error) {
            console.warn('Series info fetch failed, using mock', error);
            const mockInfo = MOCK_DATA.seriesInfo[seriesId];
            return mockInfo || { info: {}, seasons: {} };
        }
    }
};

