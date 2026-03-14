import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const NWS_API  = 'https://api.weather.gov/radar/stations';
const RIDGE2   = (id) => `https://opengeo.ncep.noaa.gov/geoserver/${id.toLowerCase()}/wms`;

const PRODUCTS = [
  { id: 'sr_bref', label: 'REFLECTIVITY' },
  { id: 'sr_bvel', label: 'VELOCITY' },
  { id: 'bdhc',    label: 'CORRELATION COEF' },  // dual-pol hydrometeor classification
];

const RADAR_OPQ = 0.85;
const ANIM_MS   = 700;

const fmtUtc = (iso) => {
  if (!iso) return '----Z';
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2,'0')}${String(d.getUTCMinutes()).padStart(2,'0')}Z`;
};

// ─────────────────────────────────────────────────────────────────────────────

const RadarTab = () => {
  const containerRef   = useRef(null);
  const mapRef         = useRef(null);
  const frameLayersRef = useRef([]);
  const animRef        = useRef(null);

  const [stations,     setStations]     = useState([]);
  const [selected,     setSelected]     = useState(null);
  const [product,      setProduct]      = useState('sr_bref');
  const [frames,       setFrames]       = useState([]);
  const [frameIdx,     setFrameIdx]     = useState(0);
  const [playing,      setPlaying]      = useState(false);
  const [radarLoading, setRadarLoading] = useState(false);
  const [search,       setSearch]       = useState('');

  // ── init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [38.5, -96], zoom: 4,
      zoomControl: true, attributionControl: false,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 19,
    }).addTo(map);
    setTimeout(() => map.invalidateSize(), 100);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // ── load stations ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(NWS_API, { headers: { Accept: 'application/geo+json' } })
      .then(r => r.json())
      .then(data => {
        const stns = (data.features ?? [])
          .filter(f => f.properties?.stationType === 'WSR-88D')
          .map(f => ({
            id:   f.properties.id,
            name: f.properties.name,
            lat:  f.geometry.coordinates[1],
            lng:  f.geometry.coordinates[0],
          }))
          .sort((a, b) => a.id.localeCompare(b.id));
        setStations(stns);
      })
      .catch(console.error);
  }, []);

  // ── draw station label tiles on map ───────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !stations.length) return;
    map.eachLayer(l => { if (l._isStationMarker) map.removeLayer(l); });

    const visible = search.trim()
      ? stations.filter(s =>
          s.id.toLowerCase().includes(search.toLowerCase()) ||
          s.name.toLowerCase().includes(search.toLowerCase())
        )
      : stations;

    visible.forEach(stn => {
      const isSel = selected?.id === stn.id;
      const icon = L.divIcon({
        html: `<div style="
          background:${isSel ? 'rgba(251,191,36,0.2)' : 'rgba(17,24,39,0.85)'};
          border:1px solid ${isSel ? '#fbbf24' : '#4b5563'};
          color:${isSel ? '#fbbf24' : '#d1d5db'};
          font-size:10px; font-family:monospace; font-weight:bold;
          padding:2px 5px; border-radius:3px; white-space:nowrap;
          cursor:pointer; user-select:none;
          box-shadow:0 1px 4px rgba(0,0,0,0.6); letter-spacing:0.05em;
        ">${stn.id}</div>`,
        className: '', iconAnchor: [20, 10],
      });
      const marker = L.marker([stn.lat, stn.lng], { icon });
      marker._isStationMarker = true;
      marker.on('click', () => setSelected(stn));
      marker.addTo(map);
    });
  }, [stations, selected, search]);

  // ── load radar for selected station ───────────────────────────────────────
  const loadRadar = useCallback(async (stn, prod) => {
    const map = mapRef.current;
    if (!map) return;

    setRadarLoading(true);
    setPlaying(false);
    setFrames([]);

    // Remove old frame layers
    frameLayersRef.current.forEach(l => map.removeLayer(l));
    frameLayersRef.current = [];

    map.setView([stn.lat, stn.lng], 7, { animate: true });

    try {
      // Fetch actual scan timestamps via our server-side proxy (no CORS issue)
      const res   = await fetch(`/api/radar/times?station=${stn.id}`);
      const data  = await res.json();
      const times = data.times ?? [];
      if (!times.length) throw new Error('no frames returned');

      const layerName = `${stn.id.toLowerCase()}_${prod}`;
      const wmsUrl    = RIDGE2(stn.id);

      // Pre-create one layer per frame — all added at opacity 0 so tiles start caching
      const layers = times.map((time, i) =>
        L.tileLayer.wms(wmsUrl, {
          layers:      layerName,
          format:      'image/png',
          transparent: true,
          version:     '1.3.0',
          crs:         L.CRS.EPSG3857,
          TIME:        time,
          opacity:     i === times.length - 1 ? RADAR_OPQ : 0,
          zIndex:      10,
        }).addTo(map)
      );

      frameLayersRef.current = layers;
      setFrames(times);
      setFrameIdx(times.length - 1);
      setPlaying(true);
    } catch (e) {
      console.error('radar load failed', e);
    } finally {
      setRadarLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) loadRadar(selected, product);
  }, [selected, product, loadRadar]);

  // ── show only current frame ────────────────────────────────────────────────
  useEffect(() => {
    frameLayersRef.current.forEach((l, i) =>
      l.setOpacity(i === frameIdx ? RADAR_OPQ : 0)
    );
  }, [frameIdx]);

  // ── animation loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    clearInterval(animRef.current);
    if (playing && frames.length > 1) {
      animRef.current = setInterval(
        () => setFrameIdx(i => (i + 1) % frames.length),
        ANIM_MS
      );
    }
    return () => clearInterval(animRef.current);
  }, [playing, frames.length]);

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">

      {/* controls */}
      <div className="flex items-center gap-3 flex-wrap shrink-0">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter stations…"
          className="bg-gray-900 border border-gray-700 text-gray-200 text-xs font-mono px-3 py-1.5 rounded w-44 placeholder-gray-600 focus:outline-none focus:border-amber-400/60 transition-colors"
        />

        {PRODUCTS.map(p => (
          <button key={p.id} onClick={() => setProduct(p.id)}
            className={`px-3 py-1.5 text-xs font-bold tracking-wider uppercase rounded border transition-all ${
              product === p.id
                ? 'border-amber-400 text-amber-400 bg-amber-400/10'
                : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
            }`}>
            {p.label}
          </button>
        ))}

        {selected && frames.length > 0 && (
          <>
            <button onClick={() => setPlaying(p => !p)}
              className="px-3 py-1.5 text-xs font-bold tracking-wider uppercase rounded border border-amber-400 text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 transition-all shrink-0">
              {playing ? '⏸ PAUSE' : '▶ PLAY'}
            </button>
            <div className="flex items-center gap-2 flex-1 min-w-32">
              <input type="range" min={0} max={frames.length - 1} value={frameIdx}
                onChange={e => { setPlaying(false); setFrameIdx(Number(e.target.value)); }}
                className="flex-1 accent-amber-400" />
              <span className={`text-xs font-mono w-14 shrink-0 text-right ${frameIdx === frames.length - 1 ? 'text-amber-400 font-bold' : 'text-gray-400'}`}>
                {fmtUtc(frames[frameIdx])}
              </span>
            </div>
          </>
        )}

        {selected && (
          <span className="text-xs font-mono text-amber-400 border border-amber-400/30 bg-amber-400/5 px-2 py-1 rounded shrink-0 ml-auto">
            {selected.id}
          </span>
        )}
      </div>

      {/* map */}
      <div className="relative rounded border border-gray-700 overflow-hidden" style={{ height: '70vh' }}>
        {!selected && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <p className="text-xs text-gray-600 tracking-widest uppercase">Click a station label to load radar</p>
          </div>
        )}
        {radarLoading && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-gray-900/90 border border-gray-700 px-3 py-1.5 rounded">
            <span className="text-xs text-gray-400 tracking-widest uppercase animate-pulse">
              Loading {selected?.id}…
            </span>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>

      <p className="text-xs text-gray-600 shrink-0">
        Source: NOAA/NWS RIDGE2 · WSR-88D{selected ? ` · ${selected.id} — ${selected.name}` : ''}
        {frames.length > 0 ? ` · ${frames.length} frames` : ''}
      </p>
    </div>
  );
};

export default RadarTab;
