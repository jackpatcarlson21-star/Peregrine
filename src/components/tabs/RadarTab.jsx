import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const RAINVIEWER_API = 'https://api.rainviewer.com/public/weather-maps.json';
const TILE_BASE = 'https://tilecache.rainviewer.com';
const COLOR_SCHEME = 2;   // standard NWS-style reflectivity colors
const SMOOTH = 1;
const SNOW = 0;
const OPACITY = 0.75;
const ANIM_INTERVAL_MS = 600;

const formatUtc = (ts) => {
  const d = new Date(ts * 1000);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}${mm}Z`;
};

const RadarTab = () => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef([]);
  const animRef = useRef(null);

  const [frames, setFrames] = useState([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Init map once
  useEffect(() => {
    if (mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [38.5, -96],
      zoom: 4,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    // Minimal attribution in corner
    L.control.attribution({ prefix: false, position: 'bottomright' })
      .addAttribution('<span style="color:#555;font-size:10px">© CartoDB · RainViewer</span>')
      .addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const fetchFrames = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(RAINVIEWER_API);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      const past = data.radar.past ?? [];
      if (past.length === 0) throw new Error('No frames available');
      setFrames(past);
      setFrameIndex(past.length - 1);
    } catch (e) {
      setError('Failed to load radar data.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => { fetchFrames(); }, [fetchFrames]);

  // Build/rebuild tile layers when frames change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || frames.length === 0) return;

    // Remove old layers
    layersRef.current.forEach(l => map.removeLayer(l));

    // Pre-create one layer per frame (invisible by default)
    layersRef.current = frames.map(frame =>
      L.tileLayer(
        `${TILE_BASE}${frame.path}/256/{z}/{x}/{y}/${COLOR_SCHEME}/${SMOOTH}_${SNOW}.png`,
        { opacity: 0, zIndex: 10, maxZoom: 15 }
      ).addTo(map)
    );
  }, [frames]);

  // Show only the current frame
  useEffect(() => {
    layersRef.current.forEach((layer, i) => {
      layer.setOpacity(i === frameIndex ? OPACITY : 0);
    });
  }, [frameIndex, frames]);

  // Animation loop
  useEffect(() => {
    if (animRef.current) clearInterval(animRef.current);
    if (playing && frames.length > 0) {
      animRef.current = setInterval(() => {
        setFrameIndex(i => (i + 1) % frames.length);
      }, ANIM_INTERVAL_MS);
    }
    return () => clearInterval(animRef.current);
  }, [playing, frames.length]);

  const handleScrub = (e) => {
    setPlaying(false);
    setFrameIndex(Number(e.target.value));
  };

  const currentTime = frames[frameIndex] ? formatUtc(frames[frameIndex].time) : '----Z';
  const isNewest = frameIndex === frames.length - 1;

  return (
    <div className="flex flex-col gap-3" style={{ height: 'calc(100vh - 130px)' }}>

      {/* Controls bar */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <button
          onClick={() => setPlaying(p => !p)}
          disabled={loading || !!error}
          className="px-3 py-1.5 text-xs font-bold tracking-wider uppercase rounded border border-amber-400 text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {playing ? '⏸ PAUSE' : '▶ PLAY'}
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <input
            type="range"
            min={0}
            max={Math.max(0, frames.length - 1)}
            value={frameIndex}
            onChange={handleScrub}
            disabled={loading || !!error}
            className="flex-1 accent-amber-400 disabled:opacity-40"
          />
          <span className={`text-xs font-bold font-mono w-14 shrink-0 ${isNewest ? 'text-amber-400' : 'text-gray-400'}`}>
            {loading ? '…' : currentTime}
          </span>
        </div>

        <button
          onClick={fetchFrames}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-bold tracking-wider uppercase rounded border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          ↺ REFRESH
        </button>
      </div>

      {/* Map */}
      <div className="relative flex-1 rounded border border-gray-700 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950 z-20">
            <span className="text-xs text-gray-500 tracking-widest uppercase animate-pulse">Loading radar…</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950 z-20">
            <span className="text-xs text-red-500 tracking-widest uppercase">{error}</span>
          </div>
        )}
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* Footer */}
      <p className="text-xs text-gray-600 shrink-0">
        Source: RainViewer · NEXRAD composite reflectivity · {frames.length > 0 ? `${frames.length} frames` : ''}
      </p>
    </div>
  );
};

export default RadarTab;
