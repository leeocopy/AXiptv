// ============================================
// User Data Store — Full LocalStorage Persistence
// Handles: Active Account, Multi-User, Favorites,
//          Recent Streams, Continue Watching
// Backend: localStorage (Firebase-swap-ready)
// ============================================

const STORE_PREFIX = 'iptv_user_';
const ACCOUNTS_KEY = 'iptv_accounts';       // Array of all saved accounts
const ACTIVE_ACCOUNT_KEY = 'activeAccount';  // Currently active account object

// ============================================
// LOW-LEVEL HELPERS (synchronous for speed)
// ============================================

function getStoreKey(username, suffix) {
    return `${STORE_PREFIX}${username}_${suffix}`;
}

function readStore(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function writeStore(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn('[UserStore] Write failed:', e);
    }
}

function removeStore(key) {
    try {
        localStorage.removeItem(key);
    } catch (e) {
        console.warn('[UserStore] Remove failed:', e);
    }
}

// ============================================
// ACTIVE ACCOUNT — Single active session
// ============================================

/**
 * Save the active account to localStorage.
 * @param {Object} data - { playlistName, username, password, portalUrl }
 */
export function setActiveAccount(data) {
    writeStore(ACTIVE_ACCOUNT_KEY, data);
}

/**
 * Get the currently active account. Returns null if none.
 * @returns {Object|null}
 */
export function getActiveAccount() {
    return readStore(ACTIVE_ACCOUNT_KEY);
}

/**
 * Clear the active account (logout).
 */
export function clearActiveAccount() {
    removeStore(ACTIVE_ACCOUNT_KEY);
}

// ============================================
// MULTI-USER ACCOUNT MANAGEMENT
// ============================================

/**
 * Get all saved accounts.
 * @returns {Array}
 */
export function getAllAccounts() {
    return readStore(ACCOUNTS_KEY) || [];
}

/**
 * Add or update an account in the accounts list.
 * Uses username + portalUrl as unique key.
 * @param {Object} account - { playlistName, username, password, portalUrl }
 * @returns {Array} updated accounts list
 */
export function saveAccount(account) {
    const accounts = getAllAccounts();
    const idx = accounts.findIndex(
        a => a.username === account.username && a.portalUrl === account.portalUrl
    );

    const entry = {
        ...account,
        savedAt: Date.now(),
        lastUsed: Date.now(),
    };

    if (idx >= 0) {
        // Update existing — preserve savedAt, update lastUsed
        entry.savedAt = accounts[idx].savedAt || Date.now();
        accounts[idx] = entry;
    } else {
        accounts.unshift(entry);
    }

    writeStore(ACCOUNTS_KEY, accounts);
    return accounts;
}

/**
 * Remove an account from the saved list.
 * @param {string} username
 * @param {string} portalUrl
 * @returns {Array} updated accounts list
 */
export function removeAccount(username, portalUrl) {
    const accounts = getAllAccounts();
    const updated = accounts.filter(
        a => !(a.username === username && a.portalUrl === portalUrl)
    );
    writeStore(ACCOUNTS_KEY, updated);
    return updated;
}

/**
 * Mark an account as last used (moves it up and updates timestamp).
 * @param {string} username
 * @param {string} portalUrl
 */
export function touchAccount(username, portalUrl) {
    const accounts = getAllAccounts();
    const idx = accounts.findIndex(
        a => a.username === username && a.portalUrl === portalUrl
    );
    if (idx >= 0) {
        accounts[idx].lastUsed = Date.now();
        writeStore(ACCOUNTS_KEY, accounts);
    }
}

// ============================================
// FAVORITES (per user)
// ============================================

export function getFavorites(username) {
    return readStore(getStoreKey(username, 'favorites')) || [];
}

export function addFavorite(username, item) {
    const favs = getFavorites(username);
    const id = item.stream_id || item.series_id;
    if (favs.some(f => (f.stream_id || f.series_id) === id)) return favs;
    const updated = [
        {
            stream_id: item.stream_id,
            series_id: item.series_id,
            name: item.name || item.title,
            stream_icon: item.stream_icon || item.cover || '',
            cover: item.cover || item.stream_icon || '',
            rating: item.rating || '',
            category_id: item.category_id || '',
            container_extension: item.container_extension || '',
            type: item.series_id ? 'series' : (item.container_extension ? 'movie' : 'live'),
            addedAt: Date.now(),
        },
        ...favs,
    ];
    writeStore(getStoreKey(username, 'favorites'), updated);
    return updated;
}

export function removeFavorite(username, itemId) {
    const favs = getFavorites(username);
    const updated = favs.filter(f => (f.stream_id || f.series_id) !== itemId);
    writeStore(getStoreKey(username, 'favorites'), updated);
    return updated;
}

export function isFavorite(username, itemId) {
    const favs = getFavorites(username);
    return favs.some(f => (f.stream_id || f.series_id) === itemId);
}

export function toggleFavorite(username, item) {
    const id = item.stream_id || item.series_id;
    if (isFavorite(username, id)) {
        return { favorites: removeFavorite(username, id), isFav: false };
    } else {
        return { favorites: addFavorite(username, item), isFav: true };
    }
}

// ============================================
// RECENT STREAMS (per user)
// Tracks channels/movies/series the user
// has recently opened (not watch progress,
// just "recently played").
// ============================================

/**
 * Get recent streams for a user. Most recent first.
 * @param {string} username
 * @returns {Array}
 */
export function getRecentStreams(username) {
    return readStore(getStoreKey(username, 'recent_streams')) || [];
}

/**
 * Add a stream to recent history. Deduplicates by ID.
 * Keeps last 50 entries.
 * @param {string} username
 * @param {Object} item - stream/movie/series item
 * @returns {Array} updated list
 */
export function addRecentStream(username, item) {
    const recents = getRecentStreams(username);
    const id = item.stream_id || item.series_id || item.id;

    // Remove existing entry if present (will re-add at top)
    const filtered = recents.filter(r => r.id !== id);

    const entry = {
        id,
        name: item.name || item.title,
        stream_icon: item.stream_icon || item.cover || '',
        cover: item.cover || item.stream_icon || '',
        type: item.series_id ? 'series' : (item.container_extension ? 'movie' : 'live'),
        stream_id: item.stream_id,
        series_id: item.series_id,
        container_extension: item.container_extension || '',
        category_id: item.category_id || '',
        playedAt: Date.now(),
    };

    const updated = [entry, ...filtered].slice(0, 50);
    writeStore(getStoreKey(username, 'recent_streams'), updated);
    return updated;
}

/**
 * Clear all recent streams for a user.
 * @param {string} username
 */
export function clearRecentStreams(username) {
    removeStore(getStoreKey(username, 'recent_streams'));
}

// ============================================
// CONTINUE WATCHING (per user)
// ============================================

export function getContinueWatching(username) {
    const data = readStore(getStoreKey(username, 'watching')) || [];
    // Sort by most recent first
    return data.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20);
}

export function updateWatchProgress(username, item, progress, duration) {
    const data = readStore(getStoreKey(username, 'watching')) || [];
    const id = item.stream_id || item.series_id || item.id;
    const idx = data.findIndex(d => d.id === id);

    const entry = {
        id,
        name: item.name || item.title,
        stream_icon: item.stream_icon || item.cover || '',
        cover: item.cover || item.stream_icon || '',
        type: item.series_id ? 'series' : (item.container_extension ? 'movie' : 'live'),
        stream_id: item.stream_id,
        series_id: item.series_id,
        container_extension: item.container_extension || '',
        category_id: item.category_id || '',
        progress: Math.floor(progress),
        duration: Math.floor(duration),
        percent: duration > 0 ? Math.min(100, Math.round((progress / duration) * 100)) : 0,
        updatedAt: Date.now(),
        // Episode info (for series)
        episodeNum: item.episodeNum || null,
        seasonNum: item.seasonNum || null,
        episodeTitle: item.episodeTitle || null,
    };

    if (idx >= 0) {
        data[idx] = entry;
    } else {
        data.unshift(entry);
    }

    // Keep only last 30 items
    writeStore(getStoreKey(username, 'watching'), data.slice(0, 30));
    return entry;
}

export function removeFromWatching(username, itemId) {
    const data = readStore(getStoreKey(username, 'watching')) || [];
    const updated = data.filter(d => d.id !== itemId);
    writeStore(getStoreKey(username, 'watching'), updated);
    return updated;
}

// ============================================
// MIGRATION — One-time upgrade from old keys
// ============================================

/**
 * Migrates from the old 'iptv_credentials' key to
 * the new 'activeAccount' + 'iptv_accounts' system.
 * Call once on app startup.
 */
export function migrateFromLegacy() {
    const oldKey = 'iptv_credentials';
    const oldData = readStore(oldKey);
    if (oldData && !getActiveAccount()) {
        // Migrate: set as active account and add to accounts list
        setActiveAccount(oldData);
        saveAccount(oldData);
        removeStore(oldKey);
        return oldData;
    }
    // Clean up old key even if active account already exists
    if (oldData) {
        removeStore(oldKey);
    }
    return null;
}
