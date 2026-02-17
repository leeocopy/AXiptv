import React, { useRef, useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import Hls from 'hls.js';
import { xtreamService } from './api';

// --- Player SVG Icons (minimalist) ---
const PlayIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
);
const PauseIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
);
const VolumeIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
);
const VolumeMuteIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
        <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
    </svg>
);
const FullscreenIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
        <polyline points="21 3 14 10" /><polyline points="3 21 10 14" />
    </svg>
);
const ExitFullscreenIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" />
        <line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" />
    </svg>
);
const SkipBackIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 19 2 12 11 5 11 19" fill="currentColor" stroke="none" />
        <text x="15" y="16" fontSize="9" fill="currentColor" fontWeight="700" fontFamily="sans-serif">10</text>
    </svg>
);
const SkipForwardIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 19 22 12 13 5 13 19" fill="currentColor" stroke="none" />
        <text x="2" y="16" fontSize="9" fill="currentColor" fontWeight="700" fontFamily="sans-serif">10</text>
    </svg>
);
const GearIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);
const NextEpisodeIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
        <polygon points="4 4 15 12 4 20 4 4" /><rect x="17" y="4" width="3" height="16" rx="1" />
    </svg>
);
const CloseIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

function formatTime(seconds) {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VideoPlayer({ streamUrl, title, logo, isLive, onClose, onNextEpisode }) {
    const videoRef = useRef(null);
    const hlsRef = useRef(null);
    const containerRef = useRef(null);
    const hideTimerRef = useRef(null);

    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [qualities, setQualities] = useState([]);
    const [currentQuality, setCurrentQuality] = useState(-1);
    const [showSettings, setShowSettings] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const [retryCount, setRetryCount] = useState(0);
    const [serverStatus, setServerStatus] = useState(null); // null | 'checking' | 'reachable' | 'unreachable'
    const fallbackIndexRef = useRef(0); // Track which fallback URL we're trying

    // --- Detect stream type from URL ---
    const isHlsUrl = (url) => {
        if (!url) return false;
        const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
        return cleanUrl.endsWith('.m3u8') || cleanUrl.endsWith('.m3u');
    };

    // Detect mixed content: HTTP stream served on HTTPS page
    const isMixedContent = (url) => {
        if (!url) return false;
        return window.location.protocol === 'https:' && url.startsWith('http:');
    };

    // --- Stream Setup (with multi-format fallback for Live TV) ---
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !streamUrl) return;

        setIsLoading(true);
        setError(null);
        setQualities([]);
        setCurrentQuality(-1);
        setServerStatus(null);

        // Cleanup previous HLS instance
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        // --- Mixed content check ---
        if (isMixedContent(streamUrl)) {
            console.warn('[IPTV Player] Mixed Content blocked:', streamUrl);
            setError('MIXED_CONTENT');
            setIsLoading(false);
            return;
        }

        // Build list of URLs to try for live streams
        let urlsToTry;
        if (isLive) {
            // Extract stream ID from the URL (last path segment before extension)
            const streamId = streamUrl.split('/').pop()?.split('.')[0];
            urlsToTry = xtreamService.getLiveStreamUrls(streamId);
            console.log(`[IPTV Player] Live stream ID: ${streamId}, will try ${urlsToTry.length} URL formats`);
        } else {
            urlsToTry = [streamUrl];
        }

        let currentUrlIndex = fallbackIndexRef.current;
        let streamLoaded = false;
        let cleanupFns = [];

        // --- 15-second timeout (longer for live to allow fallback attempts) ---
        const timeoutId = setTimeout(() => {
            if (!streamLoaded) {
                console.warn('[IPTV Player] Stream timeout:', urlsToTry[currentUrlIndex] || streamUrl);
                // Check server reachability before showing offline
                checkServerAndShowError();
            }
        }, isLive ? 15000 : 10000);

        const markLoaded = () => {
            streamLoaded = true;
            clearTimeout(timeoutId);
        };

        const checkServerAndShowError = async () => {
            setServerStatus('checking');
            const result = await xtreamService.checkServerReachable();
            if (result.reachable) {
                setServerStatus('reachable');
                setError('STREAM_OFFLINE');
            } else {
                setServerStatus('unreachable');
                setError('SERVER_UNREACHABLE');
            }
            setIsLoading(false);
        };

        // --- Try loading a URL ---
        const tryLoadUrl = (url) => {
            console.log(`[IPTV Player] Trying: ${url}`);

            // Clean up previous attempt
            cleanupFns.forEach(fn => fn());
            cleanupFns = [];

            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
            video.removeAttribute('src');
            video.load();

            // ---- HLS.js path: for .m3u8 URLs ----
            if (isHlsUrl(url)) {
                if (Hls.isSupported()) {
                    const hls = new Hls({
                        enableWorker: true,
                        lowLatencyMode: isLive,
                        backBufferLength: isLive ? 0 : 30,
                        maxBufferLength: isLive ? 10 : 30,
                        liveSyncDurationCount: isLive ? 2 : 3,
                        maxMaxBufferLength: isLive ? 20 : 60,
                        // ABR: Adaptive Bitrate
                        abrEwmaFastLive: 3.0,
                        abrEwmaSlowLive: 9.0,
                        abrBandWidthFactor: 0.95,
                        abrBandWidthUpFactor: 0.7,
                        startLevel: -1, // Auto quality selection
                        // Faster failure detection
                        manifestLoadingTimeOut: 6000,
                        manifestLoadingMaxRetry: 1,
                        levelLoadingTimeOut: 6000,
                        fragLoadingTimeOut: 8000,
                        // CORS workaround: try without credentials
                        xhrSetup: (xhr) => {
                            xhr.withCredentials = false;
                        },
                    });

                    hls.loadSource(url);
                    hls.attachMedia(video);
                    hlsRef.current = hls;

                    hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
                        markLoaded();
                        setIsLoading(false);
                        const levels = data.levels.map((level, idx) => ({
                            index: idx,
                            height: level.height,
                            bitrate: level.bitrate,
                            label: level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)}k`,
                        }));
                        if (levels.length > 1) {
                            setQualities([{ index: -1, label: 'Auto' }, ...levels]);
                        }
                        setCurrentQuality(-1);
                        video.play().then(() => setPlaying(true)).catch(() => { });
                    });

                    hls.on(Hls.Events.ERROR, (_, data) => {
                        if (data.fatal) {
                            console.warn('[IPTV Player] HLS error:', data.type, data.details, 'on URL:', url);
                            hls.destroy();
                            hlsRef.current = null;
                            // Try next URL in fallback list
                            tryNextUrl();
                        }
                    });

                    cleanupFns.push(() => {
                        hls.destroy();
                        hlsRef.current = null;
                    });
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    // Native HLS (Safari)
                    video.src = url;
                    const onMeta = () => {
                        markLoaded();
                        setIsLoading(false);
                        video.play().then(() => setPlaying(true)).catch(() => { });
                    };
                    const onErr = () => tryNextUrl();
                    video.addEventListener('loadedmetadata', onMeta);
                    video.addEventListener('error', onErr);
                    cleanupFns.push(() => {
                        video.removeEventListener('loadedmetadata', onMeta);
                        video.removeEventListener('error', onErr);
                    });
                } else {
                    tryNextUrl();
                }
                return;
            }

            // ---- Direct video path: for .ts, .mp4 and other URLs ----
            // CRITICAL: Native <video> element does NOT have CORS restrictions,
            // so .ts streams from Xtream servers work without proxy
            video.src = url;

            const onCanPlay = () => {
                markLoaded();
                setIsLoading(false);
                video.play().then(() => setPlaying(true)).catch(() => { });
            };

            const onError = () => {
                console.warn('[IPTV Player] Direct playback failed:', url, video.error?.message);
                // Try next URL
                tryNextUrl();
            };

            video.addEventListener('canplay', onCanPlay);
            video.addEventListener('error', onError);
            cleanupFns.push(() => {
                video.removeEventListener('canplay', onCanPlay);
                video.removeEventListener('error', onError);
            });
        };

        // --- Try next fallback URL ---
        const tryNextUrl = () => {
            currentUrlIndex++;
            if (currentUrlIndex < urlsToTry.length) {
                console.log(`[IPTV Player] Falling back to URL ${currentUrlIndex + 1}/${urlsToTry.length}`);
                tryLoadUrl(urlsToTry[currentUrlIndex]);
            } else {
                // All URLs exhausted
                markLoaded();
                checkServerAndShowError();
            }
        };

        // Start with first URL (or non-live URL)
        if (isLive) {
            currentUrlIndex = 0;
            tryLoadUrl(urlsToTry[0]);
        } else {
            tryLoadUrl(streamUrl);
        }

        return () => {
            clearTimeout(timeoutId);
            cleanupFns.forEach(fn => fn());
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [streamUrl, isLive, retryCount]);

    // --- Video event listeners ---
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const onTimeUpdate = () => {
            setCurrentTime(video.currentTime);
            if (video.buffered.length > 0) {
                setBuffered(video.buffered.end(video.buffered.length - 1));
            }
        };
        const onDurationChange = () => setDuration(video.duration);
        const onPlay = () => setPlaying(true);
        const onPause = () => setPlaying(false);
        const onWaiting = () => setIsLoading(true);
        const onPlaying = () => setIsLoading(false);

        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('durationchange', onDurationChange);
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('waiting', onWaiting);
        video.addEventListener('playing', onPlaying);

        return () => {
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('durationchange', onDurationChange);
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('waiting', onWaiting);
            video.removeEventListener('playing', onPlaying);
        };
    }, []);

    // --- Controls auto-hide ---
    const resetHideTimer = useCallback(() => {
        setShowControls(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
            if (playing) setShowControls(false);
        }, 3000);
    }, [playing]);

    useEffect(() => {
        resetHideTimer();
        return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
    }, [playing, resetHideTimer]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKey = (e) => {
            const video = videoRef.current;
            if (!video) return;
            resetHideTimer();

            switch (e.key) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    if (!isLive) video.currentTime = Math.max(0, video.currentTime - 10);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    if (!isLive) video.currentTime = Math.min(duration, video.currentTime + 10);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setVolume(v => { const nv = Math.min(1, v + 0.1); video.volume = nv; return nv; });
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setVolume(v => { const nv = Math.max(0, v - 0.1); video.volume = nv; return nv; });
                    break;
                case 'f':
                    toggleFullscreen();
                    break;
                case 'm':
                    toggleMute();
                    break;
                case 'Escape':
                    if (isFullscreen) toggleFullscreen();
                    else onClose();
                    break;
                default:
                    break;
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [playing, duration, isLive, isFullscreen, resetHideTimer]);

    // Auto-play next episode when current ends
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !onNextEpisode) return;
        const onEnded = () => onNextEpisode();
        video.addEventListener('ended', onEnded);
        return () => video.removeEventListener('ended', onEnded);
    }, [onNextEpisode]);

    // Fullscreen change listener
    useEffect(() => {
        const handler = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handler);
        return () => document.removeEventListener('fullscreenchange', handler);
    }, []);

    // --- Player Controls ---
    const togglePlay = () => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) video.play().catch(() => { });
        else video.pause();
    };

    const toggleMute = () => {
        const video = videoRef.current;
        if (!video) return;
        video.muted = !video.muted;
        setMuted(video.muted);
    };

    const toggleFullscreen = () => {
        const container = containerRef.current;
        if (!container) return;
        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(() => { });
        } else {
            document.exitFullscreen().catch(() => { });
        }
    };

    const handleSeek = (e) => {
        if (isLive) return;
        const video = videoRef.current;
        if (!video) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        video.currentTime = pct * duration;
    };

    const handleVolumeChange = (e) => {
        const video = videoRef.current;
        if (!video) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        video.volume = pct;
        setVolume(pct);
        if (pct > 0 && muted) {
            video.muted = false;
            setMuted(false);
        }
    };

    const skip = (seconds) => {
        const video = videoRef.current;
        if (!video || isLive) return;
        video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
    };

    const changeQuality = (idx) => {
        if (hlsRef.current) {
            hlsRef.current.currentLevel = idx;
            setCurrentQuality(idx);
        }
        setShowSettings(false);
    };

    const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
    const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

    if (!document.body) return null;

    return ReactDOM.createPortal(
        <div
            ref={containerRef}
            className={`player-container ${showControls ? 'controls-visible' : ''}`}
            onMouseMove={resetHideTimer}
            onClick={(e) => {
                // Only toggle play on the video area, not on controls
                if (e.target === videoRef.current || e.target.classList.contains('player-click-area')) {
                    togglePlay();
                    resetHideTimer();
                }
            }}
        >
            {/* Video Element */}
            <video
                ref={videoRef}
                className="player-video"
                playsInline
                autoPlay
            />

            {/* Click Area Overlay */}
            <div className="player-click-area" />

            {/* Loading Spinner */}
            {isLoading && (
                <div className="player-loading">
                    <div className="player-spinner"></div>
                </div>
            )}

            {/* Error Overlay */}
            {error && (
                <div className="player-error">
                    {error === 'STREAM_OFFLINE' ? (
                        <>
                            <div className="offline-icon">📡</div>
                            <h3 className="offline-title">Stream Offline</h3>
                            <p>This channel is currently unavailable. All URL formats were tried.</p>
                            {serverStatus === 'reachable' && (
                                <div className="server-status-badge reachable">
                                    <span className="status-dot green">●</span> Server is reachable — stream may be down
                                </div>
                            )}
                            <div className="error-buttons">
                                <button className="retry-btn" onClick={() => { setError(null); fallbackIndexRef.current = 0; setRetryCount(c => c + 1); }}>
                                    ↻ Retry
                                </button>
                                <button onClick={onClose}>Go Back</button>
                            </div>
                        </>
                    ) : error === 'SERVER_UNREACHABLE' ? (
                        <>
                            <div className="offline-icon">🔌</div>
                            <h3 className="offline-title" style={{ color: '#f87171' }}>Server Unreachable</h3>
                            <p>Cannot connect to the IPTV server. Check your internet connection or server URL.</p>
                            <div className="server-status-badge unreachable">
                                <span className="status-dot red">●</span> Server is not responding
                            </div>
                            <div className="error-buttons">
                                <button className="retry-btn" onClick={() => { setError(null); fallbackIndexRef.current = 0; setRetryCount(c => c + 1); }}>
                                    ↻ Retry
                                </button>
                                <button onClick={onClose}>Go Back</button>
                            </div>
                        </>
                    ) : error === 'MIXED_CONTENT' ? (
                        <>
                            <div className="offline-icon">🔒</div>
                            <h3 className="offline-title" style={{ color: '#60a5fa' }}>Mixed Content Blocked</h3>
                            <p>This stream uses HTTP but your app is on HTTPS. Browsers block this for security.</p>
                            <div className="mixed-content-help">
                                <strong>How to fix:</strong>
                                <ul>
                                    <li>Access this app via <code>http://</code> instead of <code>https://</code></li>
                                    <li>Or in Chrome: click the 🔒 icon → Site Settings → Insecure Content → Allow</li>
                                    <li>Or use an IPTV provider that supports HTTPS streams</li>
                                </ul>
                            </div>
                            <div className="error-buttons">
                                <button onClick={onClose}>Go Back</button>
                            </div>
                        </>
                    ) : (
                        <>
                            <p>⚠ {error}</p>
                            <div className="error-buttons">
                                <button className="retry-btn" onClick={() => { setError(null); fallbackIndexRef.current = 0; setRetryCount(c => c + 1); }}>
                                    ↻ Retry
                                </button>
                                <button onClick={onClose}>Go Back</button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Top Bar */}
            <div className={`player-top-bar ${showControls ? 'visible' : ''}`}>
                <button className="player-close-btn" onClick={onClose}>
                    <CloseIcon />
                </button>
                <div className="player-title-area">
                    {logo && <img src={logo} alt="" className="player-title-logo" />}
                    <div>
                        <h2 className="player-title">{title || 'Untitled'}</h2>
                        {isLive && <span className="live-badge">● LIVE</span>}
                    </div>
                </div>
                <div style={{ width: 40 }} /> {/* Spacer for symmetry */}
            </div>

            {/* Bottom Controls */}
            <div className={`player-controls ${showControls ? 'visible' : ''}`}>
                {/* Progress bar (only for VOD) */}
                {!isLive && (
                    <div className="player-progress-wrapper" onClick={handleSeek}>
                        <div className="player-progress-track">
                            <div className="player-progress-buffered" style={{ width: `${bufferedPct}%` }} />
                            <div className="player-progress-fill" style={{ width: `${progressPct}%` }}>
                                <div className="player-progress-thumb" />
                            </div>
                        </div>
                    </div>
                )}

                <div className="player-controls-row">
                    {/* Left controls */}
                    <div className="player-controls-left">
                        <button className="player-btn" onClick={togglePlay}>
                            {playing ? <PauseIcon /> : <PlayIcon />}
                        </button>

                        {!isLive && (
                            <>
                                <button className="player-btn small" onClick={() => skip(-10)}>
                                    <SkipBackIcon />
                                </button>
                                <button className="player-btn small" onClick={() => skip(10)}>
                                    <SkipForwardIcon />
                                </button>
                                {onNextEpisode && (
                                    <button className="player-btn small next-ep-btn" onClick={onNextEpisode} title="Next Episode">
                                        <NextEpisodeIcon />
                                    </button>
                                )}
                            </>
                        )}

                        {/* Volume */}
                        <button className="player-btn small" onClick={toggleMute}>
                            {muted || volume === 0 ? <VolumeMuteIcon /> : <VolumeIcon />}
                        </button>
                        <div className="player-volume-wrapper" onClick={handleVolumeChange}>
                            <div className="player-volume-track">
                                <div className="player-volume-fill" style={{ width: `${(muted ? 0 : volume) * 100}%` }} />
                            </div>
                        </div>

                        {/* Time */}
                        {!isLive ? (
                            <span className="player-time">
                                {formatTime(currentTime)} / {formatTime(duration)}
                            </span>
                        ) : (
                            <span className="player-time live-time">
                                <span className="live-dot">●</span> LIVE
                            </span>
                        )}
                    </div>

                    {/* Right controls */}
                    <div className="player-controls-right">
                        {/* Settings / Quality */}
                        {qualities.length > 1 && (
                            <div className="player-settings-wrap">
                                <button className="player-btn small" onClick={() => setShowSettings(!showSettings)}>
                                    <GearIcon />
                                </button>
                                {showSettings && (
                                    <div className="player-settings-menu">
                                        <div className="settings-header">Quality</div>
                                        {qualities.map(q => (
                                            <button
                                                key={q.index}
                                                className={`settings-item ${currentQuality === q.index ? 'active' : ''}`}
                                                onClick={() => changeQuality(q.index)}
                                            >
                                                {q.label}
                                                {currentQuality === q.index && <span className="check-mark">✓</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <button className="player-btn small" onClick={toggleFullscreen}>
                            {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
        , document.body);
}
