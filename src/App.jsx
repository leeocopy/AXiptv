import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { xtreamService } from './api';
import VideoPlayer from './VideoPlayer';
import { extractDominantColor, colorToAmbientGradient } from './colorExtract';
import {
  getFavorites, toggleFavorite, isFavorite,
  getContinueWatching, updateWatchProgress, removeFromWatching,
  setActiveAccount, getActiveAccount, clearActiveAccount,
  saveAccount, getAllAccounts, removeAccount,
  migrateFromLegacy, addRecentStream, getRecentStreams, touchAccount
} from './userStore';
import './App.css';
import './VideoPlayer.css';

// --- SVGs ---
const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="input-icon">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);
const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="input-icon">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
);
const GlobeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="input-icon">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="2" y1="12" x2="22" y2="12"></line>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
  </svg>
);
const ListIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="input-icon">
    <line x1="8" y1="6" x2="21" y2="6"></line>
    <line x1="8" y1="12" x2="21" y2="12"></line>
    <line x1="8" y1="18" x2="21" y2="18"></line>
    <line x1="3" y1="6" x2="3.01" y2="6"></line>
    <line x1="3" y1="12" x2="3.01" y2="12"></line>
    <line x1="3" y1="18" x2="3.01" y2="18"></line>
  </svg>
);
const TvIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="card-icon">
    <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
    <polyline points="17 2 12 7 7 2"></polyline>
  </svg>
);
const MovieIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="card-icon">
    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
    <line x1="7" y1="2" x2="7" y2="22"></line>
    <line x1="17" y1="2" x2="17" y2="22"></line>
    <line x1="2" y1="12" x2="22" y2="12"></line>
    <line x1="2" y1="7" x2="7" y2="7"></line>
    <line x1="2" y1="17" x2="7" y2="17"></line>
    <line x1="17" y1="17" x2="22" y2="17"></line>
    <line x1="17" y1="7" x2="22" y2="7"></line>
  </svg>
);
const SeriesIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="card-icon">
    <polygon points="5 3 19 3 19 21 5 21 5 3"></polygon>
    <line x1="9" y1="3" x2="9" y2="21"></line>
  </svg>
);
const EpgIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="btn-icon">
    <line x1="8" y1="6" x2="21" y2="6"></line>
    <line x1="8" y1="12" x2="21" y2="12"></line>
    <line x1="8" y1="18" x2="21" y2="18"></line>
    <rect x="3" y="4" width="4" height="16" rx="1"></rect>
  </svg>
);
const MultiScreenIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="btn-icon">
    <rect x="3" y="3" width="7" height="7"></rect>
    <rect x="14" y="3" width="7" height="7"></rect>
    <rect x="14" y="14" width="7" height="7"></rect>
    <rect x="3" y="14" width="7" height="7"></rect>
  </svg>
);
const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="btn-icon">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
);
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon search-icon">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);
const NotificationIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
  </svg>
);
const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);
const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const UsersIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

// --- Performance Components ---

// LazyImage: Only loads the image when it scrolls into view
function LazyImage({ src, alt, className }) {
  const imgRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className={`lazy-img-wrapper ${className || ''}`}>
      {isInView && src ? (
        <img
          src={src}
          alt={alt || ''}
          className={`lazy-img ${isLoaded ? 'loaded' : ''}`}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      ) : null}
      {(!isInView || !isLoaded) && (
        <div className="lazy-img-placeholder">
          <span>{(alt || '?').substring(0, 2).toUpperCase()}</span>
        </div>
      )}
    </div>
  );
}

// useDebounce hook for search
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// VirtualGrid: Only renders items visible in the scrollable viewport
function VirtualGrid({ items, renderItem, itemHeight, itemMinWidth, gap, className, onEndReached }) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  // Calculate number of columns from container width
  const columns = useMemo(() => {
    if (containerWidth <= 0) return 1;
    return Math.max(1, Math.floor((containerWidth + gap) / (itemMinWidth + gap)));
  }, [containerWidth, itemMinWidth, gap]);

  const totalRows = Math.ceil(items.length / columns);
  const rowHeight = itemHeight + gap;
  const totalHeight = totalRows * rowHeight;

  // How many extra rows to render above/below viewport (overscan)
  const overscan = 3;

  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleRows = Math.ceil(containerHeight / rowHeight) + 2 * overscan;
  const endRow = Math.min(totalRows, startRow + visibleRows);

  const startIndex = startRow * columns;
  const endIndex = Math.min(items.length, endRow * columns);
  const visibleItems = items.slice(startIndex, endIndex);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);

    // Infinite Scroll trigger
    const { scrollTop, clientHeight, scrollHeight } = e.target;
    if (onEndReached && scrollHeight - scrollTop - clientHeight < 800) {
      onEndReached();
    }
  }, [onEndReached]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      setContainerHeight(container.clientHeight);
      setContainerWidth(container.clientWidth);
    };
    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Column width calculation for the grid
  const colWidth = containerWidth > 0
    ? (containerWidth - (columns - 1) * gap) / columns
    : itemMinWidth;

  return (
    <div
      ref={containerRef}
      className={`virtual-grid-container ${className || ''}`}
      onScroll={handleScroll}
    >
      <div className="virtual-grid-inner" style={{ height: totalHeight }}>
        <div
          className="virtual-grid-visible"
          style={{
            position: 'absolute',
            top: startRow * rowHeight,
            left: 0,
            right: 0,
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: `${gap}px`,
          }}
        >
          {visibleItems.map((item, i) => renderItem(item, startIndex + i))}
        </div>
      </div>
    </div>
  );
}


// --- Components ---

function Clock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="digital-clock">
      <span className="time">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      <span className="date">{time.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</span>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p>Loading content...</p>
    </div>
  );
}

// --- Channel Card with EPG (memoized) ---
const ChannelCard = React.memo(({ item, onClick, isFav, onToggleFav, onHover }) => {
  // Simulated EPG: generate a pseudo-random progress for each channel (deterministic by stream_id)
  const epgProgress = useMemo(() => {
    const seed = (item.stream_id || 1) * 13 + Date.now() / 60000;
    return Math.round((((seed * 9301 + 49297) % 233280) / 233280) * 100);
  }, [item.stream_id]);

  const epgNow = item.epg_now || 'Live Program';
  const epgNext = item.epg_next || 'Coming Up Next';

  return (
    <div className="channel-card" onClick={() => onClick && onClick(item)} onMouseEnter={() => onHover && onHover(item.stream_icon)} tabIndex={0}>
      <div className="channel-logo">
        {item.stream_icon ? (
          <LazyImage src={item.stream_icon} alt={item.name} className="channel-logo-img" />
        ) : (
          <span>{item.name ? item.name.substring(0, 3) : 'TV'}</span>
        )}
      </div>
      <div className="channel-name">{item.name}</div>
      {/* EPG Progress Bar */}
      <div className="epg-bar">
        <div className="epg-bar-fill" style={{ width: `${epgProgress}%` }} />
      </div>
      {/* EPG Tooltip (visible on hover via CSS) */}
      <div className="epg-tooltip">
        <div className="epg-tooltip-row now">
          <span className="epg-dot live" /> <strong>Now:</strong> {epgNow}
        </div>
        <div className="epg-tooltip-row next">
          <span className="epg-dot" /> <strong>Next:</strong> {epgNext}
        </div>
      </div>
      {/* Favorite Button */}
      {onToggleFav && (
        <button className="card-fav-btn" onClick={(e) => { e.stopPropagation(); onToggleFav(item); }} title="Favorite">
          <HeartIcon filled={isFav} />
        </button>
      )}
      <div className="play-overlay"><span className="play-icon-overlay">▶</span></div>
    </div>
  );
});

// --- Movie Card with Favorite (memoized) ---
const MovieCard = React.memo(({ item, onClick, isFav, onToggleFav, onHover }) => (
  <div className="movie-card" onClick={() => onClick && onClick(item)} onMouseEnter={() => onHover && onHover(item.stream_icon || item.cover)} tabIndex={0}>
    <div className="poster-placeholder">
      {(item.stream_icon || item.cover) ? (
        <LazyImage src={item.stream_icon || item.cover} alt={item.name || item.title} className="poster-img-wrap" />
      ) : (
        <h2>{(item.name || item.title || '?').substring(0, 1)}</h2>
      )}
    </div>
    {item.rating && <div className="rating-badge">{item.rating}</div>}
    {/* Quality Badge */}
    {item.quality && <div className={`quality-badge quality-${item.quality.toLowerCase()}`}>{item.quality}</div>}
    <div className="card-overlay">
      <div className="movie-title">{item.name || item.title}</div>
      <div className="movie-year">{item.added ? new Date(item.added * 1000).getFullYear() : '2023'}</div>
    </div>
    {/* Favorite Button */}
    {onToggleFav && (
      <button className="card-fav-btn" onClick={(e) => { e.stopPropagation(); onToggleFav(item); }} title="Favorite">
        <HeartIcon filled={isFav} />
      </button>
    )}
    <div className="play-overlay"><span className="play-icon-overlay">▶</span></div>
  </div>
));

function ContentListing({ category, onBack, username }) {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [activeSubCategory, setActiveSubCategory] = useState({ id: 'All', name: 'All' });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [playerItem, setPlayerItem] = useState(null);
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [favList, setFavList] = useState(() => getFavorites(username || 'guest'));
  const [ambientBg, setAmbientBg] = useState(null);
  const [qualityFilter, setQualityFilter] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [viewReady, setViewReady] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(50);

  const debouncedSearch = useDebounce(searchQuery, 250);

  const getApiType = () => {
    if (category === 'LIVE TV') return 'live';
    if (category === 'MOVIES') return 'movie';
    if (category === 'SERIES') return 'series';
    return 'live';
  };

  useEffect(() => {
    let isMounted = true;
    setViewReady(false);
    const fetchData = async () => {
      setLoading(true);
      const type = getApiType();
      try {
        const cats = await xtreamService.getCategories(type);
        const initialCategories = [{ category_id: 'All', category_name: 'All' }, ...cats];
        if (isMounted) {
          setCategories(initialCategories);
          setActiveSubCategory(initialCategories[0]);
        }
        const streams = await xtreamService.getStreams(type, 'All');
        if (isMounted) setItems(streams);
      } catch (error) {
        console.error("Failed to fetch data", error);
      } finally {
        if (isMounted) {
          setLoading(false);
          requestAnimationFrame(() => setViewReady(true));
        }
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, [category]);

  useEffect(() => {
    let isMounted = true;
    const fetchCategoryItems = async () => {
      setLoading(true);
      const type = getApiType();
      try {
        const streams = await xtreamService.getStreams(type, activeSubCategory.id === 'All' ? null : activeSubCategory.id);
        if (isMounted) setItems(streams || []);
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    if (categories.length > 0) fetchCategoryItems();
    return () => { isMounted = false; };
  }, [activeSubCategory]);

  // Ambient background: extract color when hovering a card image
  const handleCardHover = useCallback(async (imgUrl) => {
    if (!imgUrl) return;
    const color = await extractDominantColor(imgUrl);
    if (color) setAmbientBg(colorToAmbientGradient(color));
  }, []);

  // Favorites
  const handleToggleFav = useCallback((item) => {
    const user = username || 'guest';
    const result = toggleFavorite(user, item);
    setFavList(result.favorites);
  }, [username]);

  const isItemFav = useCallback((item) => {
    const id = item.stream_id || item.series_id;
    return favList.some(f => (f.stream_id || f.series_id) === id);
  }, [favList]);

  // Filtering + Sorting
  const processedItems = useMemo(() => {
    let result = [...items];

    // Search
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(item =>
        (item.name || item.title || '').toLowerCase().includes(q)
      );
    }

    // Quality filter (using name heuristics)
    if (qualityFilter !== 'All') {
      result = result.filter(item => {
        const name = (item.name || item.title || '').toUpperCase();
        if (qualityFilter === '4K') return name.includes('4K') || name.includes('UHD');
        if (qualityFilter === 'FHD') return name.includes('FHD') || name.includes('1080') || name.includes('FULL HD');
        if (qualityFilter === 'HD') return name.includes('HD') && !name.includes('FHD') && !name.includes('4K') && !name.includes('UHD') && !name.includes('SD');
        if (qualityFilter === 'SD') return name.includes('SD') || (!name.includes('HD') && !name.includes('4K') && !name.includes('FHD') && !name.includes('UHD'));
        return true;
      });
    }

    // Sort
    if (sortBy === 'rating') {
      result.sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));
    } else if (sortBy === 'date') {
      result.sort((a, b) => (b.added || 0) - (a.added || 0));
    } else if (sortBy === 'recent') {
      result.sort((a, b) => (b.stream_id || b.series_id || 0) - (a.stream_id || a.series_id || 0));
    } else {
      result.sort((a, b) => (a.name || a.title || '').localeCompare(b.name || b.title || ''));
    }

    return result;
  }, [items, debouncedSearch, qualityFilter, sortBy]);

  // Infinite Scroll: only show subset of processed items
  const displayedItems = useMemo(() => {
    return processedItems.slice(0, displayLimit);
  }, [processedItems, displayLimit]);

  const handleLoadMore = useCallback(() => {
    if (displayLimit < processedItems.length) {
      setDisplayLimit(prev => Math.min(prev + 50, processedItems.length));
    }
  }, [displayLimit, processedItems.length]);

  // Reset limit on category/filter change
  useEffect(() => {
    setDisplayLimit(50);
  }, [category, activeSubCategory, debouncedSearch, qualityFilter, sortBy]);

  const isLive = category === 'LIVE TV';
  const isSeries = category === 'SERIES';

  const ITEM_HEIGHT = isLive ? 180 : 280;
  const ITEM_MIN_WIDTH = isLive ? 180 : 155;
  const GAP = 16;

  const handleItemClick = useCallback((item) => {
    if (isSeries) {
      setSelectedSeries(item);
    } else {
      setPlayerItem(item);
    }
  }, [isSeries]);

  const handleClosePlayer = useCallback(() => {
    setPlayerItem(null);
  }, []);

  const renderChannelCard = useCallback((item, idx) => (
    <ChannelCard
      key={item.stream_id || idx}
      item={item}
      onClick={handleItemClick}
      isFav={isItemFav(item)}
      onToggleFav={handleToggleFav}
      onHover={handleCardHover}
    />
  ), [handleItemClick, isItemFav, handleToggleFav, handleCardHover]);

  const renderMovieCard = useCallback((item, idx) => (
    <MovieCard
      key={item.stream_id || item.series_id || idx}
      item={item}
      onClick={handleItemClick}
      isFav={isItemFav(item)}
      onToggleFav={handleToggleFav}
      onHover={handleCardHover}
    />
  ), [handleItemClick, isItemFav, handleToggleFav, handleCardHover]);

  const apiType = isLive ? 'live' : (category === 'MOVIES' ? 'movie' : 'series');

  if (selectedSeries) {
    return (
      <SeriesDetail
        seriesItem={selectedSeries}
        onBack={() => setSelectedSeries(null)}
        username={username}
      />
    );
  }

  return (
    <div className={`dashboard-container listing-view ${viewReady ? 'view-enter-active' : 'view-enter'}`}>
      {/* Ambient Background Layer */}
      <div className="ambient-bg-layer" style={ambientBg ? { background: ambientBg } : undefined} />

      {/* Video Player */}
      {playerItem && (
        <VideoPlayer
          streamUrl={xtreamService.getStreamUrl(
            playerItem.stream_id || playerItem.series_id,
            apiType,
            playerItem.container_extension
          )}
          title={playerItem.name || playerItem.title}
          logo={playerItem.stream_icon || playerItem.cover}
          isLive={isLive}
          onClose={handleClosePlayer}
        />
      )}
      <header className="listing-header">
        <button className="back-btn" onClick={onBack} tabIndex={0}>
          <BackIcon />
          <span>Back to Home</span>
        </button>
        <div className="search-container">
          <SearchIcon />
          <input
            type="text"
            placeholder={`Search ${category}...`}
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {/* Sort By */}
        {!isLive && (
          <div className="filter-group">
            <label className="filter-label">Sort:</label>
            <select className="filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="name">Name</option>
              <option value="rating">Rating ★</option>
              <option value="date">Release Date</option>
              <option value="recent">Recently Added</option>
            </select>
          </div>
        )}
        <div className="listing-count-info">
          <span className="count-label">{processedItems.length} items</span>
        </div>
        <div className="user-profile">
          <div className="avatar"><UserIcon /></div>
          <span className="username">{username || 'Guest'}</span>
        </div>
      </header>

      <div className="listing-layout">
        <aside className="listing-sidebar">
          <div className="sidebar-header">Categories</div>
          <div className="sidebar-list">
            {categories.map((cat) => (
              <div
                key={cat.category_id}
                className={`sidebar-item ${activeSubCategory.id === cat.category_id ? 'active' : ''}`}
                onClick={() => setActiveSubCategory({ id: cat.category_id, name: cat.category_name })}
                tabIndex={0}
              >
                <span>{cat.category_name}</span>
                <span className="count-badge">{cat.category_id === 'All' ? items.length : '•'}</span>
              </div>
            ))}
          </div>

          {/* Quality Filter */}
          <div className="sidebar-header" style={{ marginTop: '1rem' }}>Quality</div>
          <div className="sidebar-list quality-filters">
            {['All', '4K', 'FHD', 'HD', 'SD'].map((q) => (
              <div
                key={q}
                className={`sidebar-item quality-item ${qualityFilter === q ? 'active' : ''}`}
                onClick={() => setQualityFilter(q)}
                tabIndex={0}
              >
                <span>{q === 'All' ? 'All Qualities' : q}</span>
                {q !== 'All' && <span className={`quality-dot quality-${q.toLowerCase()}`} />}
              </div>
            ))}
          </div>
        </aside>

        <main className="listing-main"
          onMouseLeave={() => setAmbientBg(null)}
        >
          {loading ? (
            <LoadingSpinner />
          ) : processedItems.length === 0 ? (
            <div className="no-results">No {isLive ? 'channels' : 'content'} found</div>
          ) : (
            <VirtualGrid
              items={displayedItems}
              renderItem={isLive ? renderChannelCard : renderMovieCard}
              itemHeight={ITEM_HEIGHT}
              itemMinWidth={ITEM_MIN_WIDTH}
              gap={16}
              className={isLive ? 'grid-live' : 'grid-movies'}
              onEndReached={handleLoadMore}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// --- SVG Icons for Series Detail ---
const StarIcon = () => (
  <svg viewBox="0 0 24 24" fill="#fbbf24" width="16" height="16">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const HeartIcon = ({ filled }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill={filled ? '#f87171' : 'none'} stroke={filled ? '#f87171' : 'currentColor'} strokeWidth="2">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const EpisodePlayIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

// =============================================
// SERIES DETAIL COMPONENT
// =============================================
function SeriesDetail({ seriesItem, onBack }) {
  const [seriesInfo, setSeriesInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSeason, setActiveSeason] = useState(null);
  const [activeTab, setActiveTab] = useState('episodes'); // 'episodes' | 'seasons'
  const [isFavorite, setIsFavorite] = useState(false);
  const [playerEpisode, setPlayerEpisode] = useState(null);
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(-1);

  // Fetch series info on mount
  useEffect(() => {
    let isMounted = true;
    const fetchInfo = async () => {
      setLoading(true);
      try {
        const data = await xtreamService.getSeriesInfo(seriesItem.series_id);
        if (isMounted) {
          setSeriesInfo(data);
          // Auto-select first season
          const seasonKeys = Object.keys(data.seasons || {}).sort((a, b) => Number(a) - Number(b));
          if (seasonKeys.length > 0) setActiveSeason(seasonKeys[0]);
        }
      } catch (err) {
        console.error('Failed to load series info', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchInfo();
    return () => { isMounted = false; };
  }, [seriesItem.series_id]);

  if (loading) {
    return (
      <div className="dashboard-container">
        <LoadingSpinner />
      </div>
    );
  }

  const info = seriesInfo?.info || {};
  const seasons = seriesInfo?.seasons || {};
  const seasonKeys = Object.keys(seasons).sort((a, b) => Number(a) - Number(b));
  const currentEpisodes = activeSeason ? (seasons[activeSeason] || []) : [];

  const handlePlayEpisode = (episode, index) => {
    setPlayerEpisode(episode);
    setCurrentEpisodeIndex(index);
  };

  const handleNextEpisode = () => {
    const nextIndex = currentEpisodeIndex + 1;
    if (nextIndex < currentEpisodes.length) {
      setPlayerEpisode(currentEpisodes[nextIndex]);
      setCurrentEpisodeIndex(nextIndex);
    } else {
      // Move to next season if available
      const currentSeasonIdx = seasonKeys.indexOf(activeSeason);
      if (currentSeasonIdx < seasonKeys.length - 1) {
        const nextSeason = seasonKeys[currentSeasonIdx + 1];
        setActiveSeason(nextSeason);
        const nextSeasonEpisodes = seasons[nextSeason] || [];
        if (nextSeasonEpisodes.length > 0) {
          setPlayerEpisode(nextSeasonEpisodes[0]);
          setCurrentEpisodeIndex(0);
        }
      }
    }
  };

  const handleClosePlayer = () => {
    setPlayerEpisode(null);
    setCurrentEpisodeIndex(-1);
  };

  const hasNextEpisode = () => {
    if (currentEpisodeIndex < currentEpisodes.length - 1) return true;
    const currentSeasonIdx = seasonKeys.indexOf(activeSeason);
    if (currentSeasonIdx < seasonKeys.length - 1) {
      const nextSeason = seasonKeys[currentSeasonIdx + 1];
      return (seasons[nextSeason] || []).length > 0;
    }
    return false;
  };

  return (
    <div className="dashboard-container series-detail-container">
      {/* Video Player overlay */}
      {playerEpisode && (
        <VideoPlayer
          streamUrl={xtreamService.getStreamUrl(
            playerEpisode.id,
            'series',
            playerEpisode.container_extension
          )}
          title={`S${activeSeason}E${playerEpisode.episode_num} - ${playerEpisode.title}`}
          logo={seriesItem.cover || info.cover}
          isLive={false}
          onClose={handleClosePlayer}
          onNextEpisode={hasNextEpisode() ? handleNextEpisode : undefined}
        />
      )}

      {/* Header */}
      <header className="listing-header">
        <button className="back-btn" onClick={onBack}>
          <BackIcon />
          <span>Back to Series</span>
        </button>
        <h1 className="series-header-title">SERIES INFO</h1>
        <div style={{ width: 140 }} />
      </header>

      {/* Main Content */}
      <div className="series-detail-body">
        {/* Info Section: Poster + Metadata */}
        <div className="series-info-section">
          {/* Poster */}
          <div className="series-poster-wrap">
            {(seriesItem.cover || info.cover) ? (
              <img
                src={seriesItem.cover || info.cover}
                alt={info.name || seriesItem.name}
                className="series-poster-img"
              />
            ) : (
              <div className="series-poster-placeholder">
                <span>{(info.name || seriesItem.name || '?').substring(0, 2)}</span>
              </div>
            )}
            {info.rating && (
              <div className="series-rating-badge">
                <StarIcon /> {info.rating}
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="series-meta-wrap">
            <h2 className="series-title">{info.name || seriesItem.name}</h2>

            <div className="series-meta-grid">
              <div className="meta-row">
                <span className="meta-label">Directed By:</span>
                <span className="meta-value">{info.director || 'N/A'}</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Release Date:</span>
                <span className="meta-value">{info.releaseDate || 'N/A'}</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Genre:</span>
                <span className="meta-value">{info.genre || 'N/A'}</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Cast:</span>
                <span className="meta-value">{info.cast || 'N/A'}</span>
              </div>
              <div className="meta-row meta-row-full">
                <span className="meta-label">Plot:</span>
                <span className="meta-value">{info.plot || 'N/A'}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="series-actions">
              <button
                className={`series-action-btn ${activeTab === 'episodes' ? 'active' : ''}`}
                onClick={() => setActiveTab('episodes')}
              >
                <span>📺</span> Episodes
              </button>
              <button
                className={`series-action-btn ${activeTab === 'seasons' ? 'active' : ''}`}
                onClick={() => setActiveTab('seasons')}
              >
                <span>📁</span> Seasons
              </button>
              <button
                className={`series-action-btn fav-btn ${isFavorite ? 'is-fav' : ''}`}
                onClick={() => setIsFavorite(!isFavorite)}
              >
                <HeartIcon filled={isFavorite} />
                {isFavorite ? 'Favorited' : 'Add to Favorite'}
              </button>
            </div>
          </div>
        </div>

        {/* Seasons / Episodes Section */}
        <div className="series-content-section">
          {activeTab === 'seasons' ? (
            <div className="seasons-grid">
              {seasonKeys.map(sKey => (
                <button
                  key={sKey}
                  className={`season-card ${activeSeason === sKey ? 'active' : ''}`}
                  onClick={() => { setActiveSeason(sKey); setActiveTab('episodes'); }}
                >
                  <div className="season-number">Season {sKey}</div>
                  <div className="season-count">{(seasons[sKey] || []).length} Episodes</div>
                </button>
              ))}
            </div>
          ) : (
            <>
              {/* Season Tabs */}
              <div className="season-tabs">
                {seasonKeys.map(sKey => (
                  <button
                    key={sKey}
                    className={`season-tab ${activeSeason === sKey ? 'active' : ''}`}
                    onClick={() => setActiveSeason(sKey)}
                  >
                    Season {sKey}
                  </button>
                ))}
              </div>

              {/* Episodes List */}
              <div className="episodes-list">
                {currentEpisodes.map((ep, idx) => (
                  <div
                    key={ep.id}
                    className={`episode-item ${playerEpisode?.id === ep.id ? 'playing' : ''}`}
                    onClick={() => handlePlayEpisode(ep, idx)}
                  >
                    <div className="episode-play-icon">
                      <EpisodePlayIcon />
                    </div>
                    <div className="episode-info">
                      <div className="episode-number">E{ep.episode_num}</div>
                      <div className="episode-title">{ep.title}</div>
                      {ep.info?.duration && (
                        <div className="episode-duration">{ep.info.duration}</div>
                      )}
                    </div>
                    <div className="episode-ext">{ep.container_extension?.toUpperCase()}</div>
                  </div>
                ))}
                {currentEpisodes.length === 0 && (
                  <div className="no-results">No episodes found for this season</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Dashboard({ user, onSelectCategory, onLogout, onManageUsers, onDeleteAccount }) {
  const [continueWatchingList, setContinueWatchingList] = useState([]);
  const [favoritesList, setFavoritesList] = useState([]);
  const [dashReady, setDashReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const username = user || 'guest';
    setContinueWatchingList(getContinueWatching(username));
    setFavoritesList(getFavorites(username));
    requestAnimationFrame(() => setDashReady(true));
  }, [user]);

  const handleRemoveWatching = (itemId) => {
    const username = user || 'guest';
    const updated = removeFromWatching(username, itemId);
    setContinueWatchingList(updated);
  };

  const categoriesList = [
    { title: 'LIVE TV', icon: <TvIcon />, color: '#4ade80', gradient: 'linear-gradient(135deg, rgba(74, 222, 128, 0.1) 0%, rgba(74, 222, 128, 0) 100%)' },
    { title: 'MOVIES', icon: <MovieIcon />, color: '#f87171', gradient: 'linear-gradient(135deg, rgba(248, 113, 113, 0.1) 0%, rgba(248, 113, 113, 0) 100%)' },
    { title: 'SERIES', icon: <SeriesIcon />, color: '#a78bfa', gradient: 'linear-gradient(135deg, rgba(167, 139, 250, 0.1) 0%, rgba(167, 139, 250, 0) 100%)' },
  ];

  return (
    <div className={`dashboard-container ${dashReady ? 'view-enter-active' : 'view-enter'}`}>
      {/* Ambient Background */}
      <div className="ambient-bg-layer dashboard-ambient" />

      {/* Settings Overlay */}
      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <h2>Settings</h2>
              <button className="settings-close" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            <div className="settings-body">
              <div className="settings-section">
                <h3>Account</h3>
                <div className="settings-info">
                  <span className="settings-label">Active User:</span>
                  <span className="settings-value">{user || 'Guest'}</span>
                </div>
              </div>
              <div className="settings-section">
                <h3>Actions</h3>
                <button className="settings-action-btn" onClick={() => { setShowSettings(false); onManageUsers(); }}>
                  <UsersIcon /> Manage Users / Switch Account
                </button>
                <button className="settings-action-btn" onClick={onLogout}>
                  <LogoutIcon /> Logout (Keep Account Saved)
                </button>
                <button className="settings-action-btn danger" onClick={() => { if (window.confirm('Delete this account from saved list? This cannot be undone.')) { setShowSettings(false); onDeleteAccount(); } }}>
                  <TrashIcon /> Delete Active Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <header className="top-bar">
        <div className="top-left">
          <div className="mini-logo">
            <svg
              width="40" height="40"
              viewBox="0 0 200 200"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="miniGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#c084fc" />
                </linearGradient>
              </defs>
              <path d="M60 50 L100 90 L140 50" stroke="url(#miniGradient)" strokeWidth="12" fill="none" strokeLinecap="round" />
              <rect x="40" y="80" width="120" height="90" rx="20" ry="20" stroke="url(#miniGradient)" strokeWidth="10" fill="none" />
              <path d="M90 110 L120 125 L90 140 Z" fill="url(#miniGradient)" />
            </svg>
            <span className="brand-text">IPTV <span className="highlight">Stream</span></span>
          </div>
          <Clock />
        </div>

        <div className="top-right">
          <div className="nav-item">
            <SearchIcon />
            <span>Search</span>
          </div>
          <div className="nav-item" onClick={onManageUsers} title="Manage Users" tabIndex={0} style={{ cursor: 'pointer' }}>
            <UsersIcon />
          </div>
          <div className="user-profile">
            <div className="avatar">
              <UserIcon />
            </div>
            <span className="username">{user || 'Guest User'}</span>
          </div>
          <div className="nav-item logout-btn" onClick={onLogout} title="Logout" tabIndex={0}>
            <LogoutIcon />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Category Cards */}
        <div className="cards-grid">
          {categoriesList.map((cat, index) => (
            <div
              key={index}
              className="category-card"
              style={{ '--accent-color': cat.color, '--anim-delay': `${index * 80}ms` }}
              onClick={() => onSelectCategory(cat.title)}
              tabIndex={0}
            >
              <div className="card-bg" style={{ background: cat.gradient }}></div>
              <div className="icon-wrapper">
                {cat.icon}
              </div>
              <h2 className="card-title">{cat.title}</h2>
              <div className="card-footer">
                <span className="update-badge">Updated: Just now</span>
              </div>
            </div>
          ))}
        </div>

        {/* Continue Watching Row */}
        {continueWatchingList.length > 0 && (
          <section className="dashboard-section continue-watching-section">
            <h3 className="section-title">
              <span className="section-icon">⏯</span> Continue Watching
            </h3>
            <div className="horizontal-scroll-row">
              {continueWatchingList.map((item) => (
                <div className="cw-card" key={item.id} onClick={() => onSelectCategory(item.type === 'live' ? 'LIVE TV' : item.type === 'series' ? 'SERIES' : 'MOVIES')} tabIndex={0}>
                  <div className="cw-poster">
                    {(item.stream_icon || item.cover) ? (
                      <img src={item.stream_icon || item.cover} alt={item.name} className="cw-poster-img" />
                    ) : (
                      <div className="cw-poster-placeholder">{(item.name || '?')[0]}</div>
                    )}
                    <div className="cw-progress-bar">
                      <div className="cw-progress-fill" style={{ width: `${item.percent || 0}%` }} />
                    </div>
                  </div>
                  <div className="cw-info">
                    <div className="cw-name">{item.name}</div>
                    {item.episodeTitle && <div className="cw-episode">{item.episodeTitle}</div>}
                  </div>
                  <button className="cw-remove" onClick={(e) => { e.stopPropagation(); handleRemoveWatching(item.id); }} title="Remove">✕</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Favorites Row */}
        {favoritesList.length > 0 && (
          <section className="dashboard-section favorites-section">
            <h3 className="section-title">
              <span className="section-icon">❤️</span> Your Favorites
            </h3>
            <div className="horizontal-scroll-row">
              {favoritesList.map((item) => (
                <div className="fav-card" key={item.stream_id || item.series_id} onClick={() => onSelectCategory(item.type === 'live' ? 'LIVE TV' : item.type === 'series' ? 'SERIES' : 'MOVIES')} tabIndex={0}>
                  <div className="fav-poster">
                    {(item.stream_icon || item.cover) ? (
                      <img src={item.stream_icon || item.cover} alt={item.name} className="fav-poster-img" />
                    ) : (
                      <div className="fav-poster-placeholder">{(item.name || '?')[0]}</div>
                    )}
                  </div>
                  <div className="fav-name">{item.name}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Bottom Bar */}
      <footer className="bottom-bar">
        <button className="nav-btn" tabIndex={0}>
          <EpgIcon />
          <span>EPG Guide</span>
        </button>
        <button className="nav-btn" tabIndex={0}>
          <MultiScreenIcon />
          <span>Multi-Screen</span>
        </button>
        <button className="nav-btn" onClick={() => setShowSettings(true)} tabIndex={0}>
          <SettingsIcon />
          <span>Settings</span>
        </button>
      </footer>
    </div>
  );
}

function Login({ onLogin, savedCreds, savedAccounts, onSelectAccount, onDeleteSavedAccount }) {
  const [formData, setFormData] = useState({
    playlistName: '',
    username: '',
    password: '',
    portalUrl: ''
  });
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [showUsers, setShowUsers] = useState(false);

  useEffect(() => {
    if (savedCreds) {
      setFormData(savedCreds);
    }
  }, [savedCreds]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({ ...prevState, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    // Initialize the API service with the entered credentials
    xtreamService.init(formData.portalUrl, formData.username, formData.password);

    try {
      const success = await xtreamService.authenticate();
      if (success) {
        setStatus('success');
        setTimeout(() => onLogin(formData), 800);
      } else {
        // authenticate() returned false = server responded but rejected credentials
        setStatus('error');
        setErrorMsg('Authentication failed. The server rejected your username/password.');
        setTimeout(() => setStatus('idle'), 4000);
      }
    } catch (err) {
      setStatus('error');
      // Check if this is a proxy/connection error vs auth error
      if (err.message && err.message.startsWith('PROXY_ERROR:')) {
        const detail = err.message.replace('PROXY_ERROR: ', '');
        setErrorMsg(`Proxy Connection Error: ${detail}`);
      } else {
        setErrorMsg(`Connection failed: ${err.message}`);
      }
      setTimeout(() => setStatus('idle'), 6000);
    }
  };

  const handleDeleteUser = (e, acc) => {
    e.stopPropagation();
    if (window.confirm(`Delete account "${acc.playlistName || acc.username}"?`)) {
      onDeleteSavedAccount(acc.username, acc.portalUrl);
    }
  };

  const accounts = savedAccounts || [];

  return (
    <div className="app-container login-mode">
      <div className="content-wrapper">
        <div className="branding-section">
          <div className="logo-container">
            <svg className="tv-icon" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                  <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <linearGradient id="tvGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#60a5fa" /><stop offset="100%" stopColor="#c084fc" />
                </linearGradient>
              </defs>
              <path d="M60 50 L100 90 L140 50" stroke="url(#tvGradient)" strokeWidth="8" fill="none" strokeLinecap="round" filter="url(#glow)" />
              <circle cx="60" cy="50" r="6" fill="#60a5fa" filter="url(#glow)" />
              <circle cx="140" cy="50" r="6" fill="#c084fc" filter="url(#glow)" />
              <rect x="40" y="80" width="120" height="90" rx="20" ry="20" stroke="url(#tvGradient)" strokeWidth="6" fill="none" filter="url(#glow)" />
              <path d="M55 100 Q 100 110 145 95" stroke="rgba(255,255,255,0.3)" strokeWidth="3" fill="none" strokeLinecap="round" />
              <path d="M90 110 L120 125 L90 140 Z" fill="url(#tvGradient)" opacity="0.8" filter="url(#glow)" />
            </svg>
            <h1 className="brand-title">IPTV <span className="highlight-text">Stream</span></h1>
          </div>
          <p className="brand-tagline">Experience the Future of Streaming in 4K</p>
        </div>

        <div className="login-section">
          <div className="glass-card">
            {/* Saved Users Toggle */}
            {accounts.length > 0 && (
              <button
                className="saved-users-toggle"
                onClick={() => setShowUsers(!showUsers)}
                type="button"
              >
                <UsersIcon /> {showUsers ? 'New Login' : `Saved Users (${accounts.length})`}
              </button>
            )}

            {/* Saved Users List */}
            {showUsers && accounts.length > 0 ? (
              <div className="saved-users-list">
                <h2 className="login-header">Select Account</h2>
                {accounts.map((acc, idx) => (
                  <div
                    key={`${acc.username}-${acc.portalUrl}-${idx}`}
                    className="saved-user-card"
                    onClick={() => onSelectAccount(acc)}
                    tabIndex={0}
                  >
                    <div className="saved-user-avatar"><UserIcon /></div>
                    <div className="saved-user-info">
                      <div className="saved-user-name">{acc.playlistName || acc.username}</div>
                      <div className="saved-user-url">{acc.portalUrl}</div>
                    </div>
                    <button className="saved-user-delete" onClick={(e) => handleDeleteUser(e, acc)} title="Delete this account">
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              /* Login Form */
              <>
                <h2 className="login-header">Login Details</h2>
                <form onSubmit={handleSubmit}>
                  {['playlistName', 'username', 'password', 'portalUrl'].map((field) => (
                    <div className="input-container" key={field}>
                      {field === 'playlistName' && <ListIcon />}
                      {field === 'username' && <UserIcon />}
                      {field === 'password' && <LockIcon />}
                      {field === 'portalUrl' && <GlobeIcon />}
                      <input
                        type={field === 'password' ? 'password' : 'text'}
                        name={field}
                        placeholder={field === 'portalUrl' ? 'http://server.com:port' : field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        value={formData[field]}
                        onChange={handleChange}
                        className="glass-input with-icon"
                        required
                        disabled={status === 'loading'}
                      />
                    </div>
                  ))}
                  <button type="submit" className={`glow-button ${status === 'loading' ? 'loading' : ''}`} disabled={status === 'loading'}>
                    {status === 'loading' ? 'CONNECTING...' : 'ADD USER'}
                  </button>
                  {status === 'success' && <div className="status-message success">✅ Connected successfully! Loading...</div>}
                  {status === 'error' && <div className="status-message error">❌ {errorMsg || 'Connection failed. Check details.'}</div>}
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================
// MANAGE USERS PAGE
// =============================================
function ManageUsersPage({ accounts, activeUser, onSelectAccount, onDeleteAccount, onBack, onAddNew }) {
  return (
    <div className="dashboard-container manage-users-view">
      <div className="ambient-bg-layer dashboard-ambient" />
      <header className="listing-header">
        <button className="back-btn" onClick={onBack} tabIndex={0}>
          <BackIcon />
          <span>Back to Dashboard</span>
        </button>
        <h1 className="series-header-title">MANAGE USERS</h1>
        <div style={{ width: 140 }} />
      </header>

      <main className="manage-users-content">
        <div className="manage-users-grid">
          {accounts.map((acc, idx) => {
            const isActive = acc.username === activeUser;
            return (
              <div
                key={`${acc.username}-${acc.portalUrl}-${idx}`}
                className={`manage-user-card ${isActive ? 'active' : ''}`}
              >
                <div className="manage-user-top">
                  <div className="manage-user-avatar">
                    <UserIcon />
                  </div>
                  {isActive && <span className="manage-user-active-badge">ACTIVE</span>}
                </div>
                <div className="manage-user-name">{acc.playlistName || acc.username}</div>
                <div className="manage-user-url">{acc.portalUrl}</div>
                <div className="manage-user-meta">
                  <span>User: {acc.username}</span>
                </div>
                <div className="manage-user-actions">
                  {!isActive && (
                    <button className="manage-user-btn switch" onClick={() => onSelectAccount(acc)}>
                      Switch
                    </button>
                  )}
                  <button className="manage-user-btn delete" onClick={() => {
                    if (window.confirm(`Delete "${acc.playlistName || acc.username}" from saved accounts?`)) {
                      onDeleteAccount(acc.username, acc.portalUrl);
                    }
                  }}>
                    <TrashIcon /> Delete
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add New Account Card */}
          <div className="manage-user-card add-new" onClick={onAddNew}>
            <div className="add-new-icon">+</div>
            <div className="manage-user-name">Add New Account</div>
          </div>
        </div>
      </main>
    </div>
  );
}

function SplashScreen({ message }) {
  return (
    <div className="app-container splash-screen">
      <div className="splash-content">
        <svg className="splash-logo" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="splashGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60a5fa" /><stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
          </defs>
          <path d="M60 50 L100 90 L140 50" stroke="url(#splashGrad)" strokeWidth="10" fill="none" strokeLinecap="round" />
          <rect x="40" y="80" width="120" height="90" rx="20" ry="20" stroke="url(#splashGrad)" strokeWidth="8" fill="none" />
          <path d="M90 110 L120 125 L90 140 Z" fill="url(#splashGrad)" />
        </svg>
        <h1 className="splash-title">IPTV <span className="highlight-text">Stream</span></h1>
        <div className="splash-loader">
          <div className="splash-loader-bar" />
        </div>
        <p className="splash-message">{message || 'Loading...'}</p>
      </div>
    </div>
  );
}

function App() {
  const [view, setView] = useState('splash');  // splash | login | dashboard | listing | manageUsers
  const [currentUser, setCurrentUser] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [splashMsg, setSplashMsg] = useState('Initializing...');
  const [accountsList, setAccountsList] = useState([]);

  // ============================================
  // STARTUP: Check activeAccount in localStorage
  // ============================================
  useEffect(() => {
    const startup = async () => {
      // 1. Migrate from old 'iptv_credentials' key if needed
      migrateFromLegacy();

      // 2. Load saved accounts list
      setAccountsList(getAllAccounts());

      // 3. Check for active account
      const active = getActiveAccount();
      if (active && active.username && active.portalUrl) {
        setSplashMsg('Connecting to server...');

        // Initialize API service
        xtreamService.init(active.portalUrl, active.username, active.password);

        // Quick auth check
        try {
          const success = await xtreamService.authenticate();
          if (success) {
            setSplashMsg('Welcome back!');
            touchAccount(active.username, active.portalUrl);
            setCurrentUser(active.username);
            setTimeout(() => setView('dashboard'), 600);
            return;
          }
        } catch (e) {
          console.warn('[App] Auto-auth failed:', e.message);
        }

        // Auth failed but we have saved creds — still go to dashboard
        setSplashMsg('Offline mode — loading saved data...');
        setCurrentUser(active.username);
        setTimeout(() => setView('dashboard'), 800);
        return;
      }

      // No active account — go to login
      setTimeout(() => setView('login'), 400);
    };

    startup();
  }, []);

  // ============================================
  // LOGIN HANDLER
  // ============================================
  const handleLogin = (creds) => {
    setActiveAccount(creds);
    const updatedAccounts = saveAccount(creds);
    setAccountsList(updatedAccounts);
    setCurrentUser(creds.username);
    setView('dashboard');
  };

  // ============================================
  // SELECT SAVED ACCOUNT
  // ============================================
  const handleSelectAccount = async (acc) => {
    setView('splash');
    setSplashMsg(`Connecting as ${acc.playlistName || acc.username}...`);

    xtreamService.init(acc.portalUrl, acc.username, acc.password);

    try {
      const success = await xtreamService.authenticate();
      if (success) {
        setActiveAccount(acc);
        touchAccount(acc.username, acc.portalUrl);
        setCurrentUser(acc.username);
        setSplashMsg('Connected!');
        setTimeout(() => setView('dashboard'), 500);
        return;
      }
    } catch (e) {
      console.warn('[App] Select account auth failed:', e.message);
    }

    // Failed — still try to load (offline mode)
    setActiveAccount(acc);
    setCurrentUser(acc.username);
    setView('dashboard');
  };

  // ============================================
  // DELETE A SAVED ACCOUNT (from accounts list)
  // ============================================
  const handleDeleteSavedAccount = (username, portalUrl) => {
    const updated = removeAccount(username, portalUrl);
    setAccountsList(updated);

    // If we deleted the active account, also clear it
    const active = getActiveAccount();
    if (active && active.username === username && active.portalUrl === portalUrl) {
      clearActiveAccount();
      setCurrentUser(null);
      xtreamService.init('', '', '');
      setView('login');
    }
  };

  // ============================================
  // DELETE ACTIVE ACCOUNT — remove + redirect to login
  // ============================================
  const handleDeleteCurrentAccount = () => {
    const active = getActiveAccount();
    if (active) {
      removeAccount(active.username, active.portalUrl);
    }
    clearActiveAccount();
    setCurrentUser(null);
    xtreamService.init('', '', '');
    setAccountsList(getAllAccounts());
    setView('login');
  };

  // ============================================
  // LOGOUT — Clear active, keep in accounts list
  // ============================================
  const handleLogout = () => {
    clearActiveAccount();
    setCurrentUser(null);
    xtreamService.init('', '', '');
    setAccountsList(getAllAccounts());
    setView('login');
  };

  const handleSelectCategory = (category) => {
    setActiveCategory(category);
    setView('listing');
  };

  const handleBackToDashboard = () => {
    setView('dashboard');
    setActiveCategory(null);
  };

  if (view === 'splash') {
    return <SplashScreen message={splashMsg} />;
  }

  return (
    <>
      {view === 'login' && (
        <Login
          onLogin={handleLogin}
          savedAccounts={accountsList}
          onSelectAccount={handleSelectAccount}
          onDeleteSavedAccount={handleDeleteSavedAccount}
        />
      )}
      {view === 'dashboard' && (
        <Dashboard
          user={currentUser}
          onSelectCategory={handleSelectCategory}
          onLogout={handleLogout}
          onManageUsers={() => setView('manageUsers')}
          onDeleteAccount={handleDeleteCurrentAccount}
        />
      )}
      {view === 'listing' && (
        <ContentListing
          category={activeCategory}
          onBack={handleBackToDashboard}
          username={currentUser}
        />
      )}
      {view === 'manageUsers' && (
        <ManageUsersPage
          accounts={accountsList}
          activeUser={currentUser}
          onSelectAccount={handleSelectAccount}
          onDeleteAccount={handleDeleteSavedAccount}
          onBack={handleBackToDashboard}
          onAddNew={() => { handleLogout(); }}
        />
      )}
    </>
  );
}

export default App;
