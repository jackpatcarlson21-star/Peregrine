import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const NWS_API   = 'https://api.weather.gov/radar/stations';
const RIDGE2    = (id) => `https://opengeo.ncep.noaa.gov/geoserver/${id.toLowerCase()}/wms`;
const RIDGE2_CAPS = (id) =>
  `https://opengeo.ncep.noaa.gov/geoserver/${id.toLowerCase()}/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`;

const PRODUCTS = [
  { id: 'sr_bref', label: 'REFLECTIVITY' },
  { id: 'sr_bvel', label: 'VELOCITY' },
];

const ANIM_MS   = 700;
const RADAR_OPQ = 0.85;

const parseTimes = (xmlText) => {
  try {
    const doc  = new DOMParser().parseFromString(xmlText, 'text/xml');
    const dims = doc.querySelectorAll('Dimension[name="time"]');
    for (const dim of dims) {
      const raw = dim.textContent.trim();
      if (!raw) continue;
      if (raw.includes(',')) return raw.split(',').map(t => t.trim()).filter(Boolean);
      if (raw.includes('/')) {
        const [start, end, period] = raw.split('/');
        const m = period.match(/PT?(\d+)M/);
        if (!m) return [start, end].filter(Boolean);
        const step = parseInt(m[1]) * 60000;
        const times = [];
        let t = new Date(start).getTime();
        const endT = new Date(end).getTime();
        while (t <= endT && times.length < 60) {
          times.push(new Date(t).toISOString().replace('.000Z', 'Z'));
          t += step;
        }
        return times;
      }
      return [raw];
    }
  } catch (_) {}
  return [];
};

const fmtUtc = (iso) => {
  if (!iso) return '----Z';
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2,'0')}${String(d.getUTCMinutes()).padStart(2,'0')}Z`;
};

// ─────────────────────────────────────────────────────────────────────────────

const RadarTab = () => {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const frameLayersRef = useRef([]);   // one WMS layer per frame, all pre-loaded
  const animRef      = useRef(null);

  const [stations,     setStations]     = useState([]);
  const [selected,     setSelected]     = useState(null);
  const [product,      setProduct]      = useState('sr_bref');
  const [frames,       setFrames]       = useState([]);
  const [frameIdx,     setFrameIdx]     = useState(0);
  const [playing,      setPlaying]      = useState(false);
  const [radarLoading, setRadarLoading] = useState(false);
  const [search,       setSearch]       = useState('');

  // ── init map ────────────────────────────────────────────────────────────────
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

  // ── load stations ───────────────────────────────────────────────────────────
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

  // ── load radar (pre-build all frame layers) ─────────────────────────────────
  const loadRadar = useCallback(async (stn, prod) => {
    const map = mapRef.current;
    if (!map) return;

    setRadarLoading(true);
    setPlaying(false);
    setFrames([]);

    // Remove existing frame layers
    frameLayersRef.current.forEach(l => map.removeLayer(l));
    frameLayersRef.current = [];

    map.setView([stn.lat, stn.lng], 7, { animate: true });

    try {
      const res   = await fetch(RIDGE2_CAPS(stn.id));
      const xml   = await res.text();
      const times = parseTimes(xml);
      if (!times.length) throw new Error('no frames');

      const layerName = `${stn.id.toLowerCase()}_${prod}`;

      // Pre-create one layer per frame — all added at opacity 0 so tiles start loading
      const layers = times.map((time, i) =>
        L.tileLayer.wms(RIDGE2(stn.id), {
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

  // ── show only current frame (just toggle opacity — no tile re-requests) ──────
  useEffect(() => {
    frameLayersRef.current.forEach((l, i) =>
      l.setOpacity(i === frameIdx ? RADAR_OPQ : 0)
    );
  }, [frameIdx]);

  // ── animation loop ──────────────────────────────────────────────────────────
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

  // ── filtered station list ───────────────────────────────────────────────────
  const filtered = search.trim()
    ? stations.filter(s =>
        s.id.toLowerCase().includes(search.toLowerCase()) ||
        s.name.toLowerCase().includes(search.toLowerCase())
      )
    : stations;

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">

      {/* controls bar */}
      <div className="flex items-center gap-3 flex-wrap shrink-0">
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
              className="px-3 py-1.5 text-xs font-bold tracking-wider uppercase rounded border border-amber-400 text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 transition-all">
              {playing ? '⏸ PAUSE' : '▶ PLAY'}
            </button>
            <div className="flex items-center gap-2 flex-1 min-w-32">
              <input type="range" min={0} max={frames.length - 1} value={frameIdx}
                onChange={e => { setPlaying(false); setFrameIdx(Number(e.target.value)); }}
                className="flex-1 accent-amber-400" />
              <span className="text-xs font-mono text-gray-400 w-12 shrink-0 text-right">
                {fmtUtc(frames[frameIdx])}
              </span>
            </div>
          </>
        )}

        {selected && (
          <span className="text-xs font-mono text-amber-400 border border-amber-400/30 bg-amber-400/5 px-2 py-1 rounded shrink-0 ml-auto">
            {selected.id} — {selected.name}
          </span>
        )}
      </div>

      {/* map + station list */}
      <div className="flex gap-3" style={{ height: '70vh' }}>

        {/* station list */}
        <div className="flex flex-col w-52 shrink-0 bg-gray-900 border border-gray-700 rounded overflow-hidden">
          <div className="p-2 border-b border-gray-700 shrink-0">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter stations…"
              className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs font-mono px-2 py-1.5 rounded placeholder-gray-600 focus:outline-none focus:border-amber-400/60 transition-colors"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.map(stn => {
              const isSel = selected?.id === stn.id;
              return (
                <button
                  key={stn.id}
                  onClick={() => setSelected(stn)}
                  className={`w-full text-left px-3 py-2 border-b border-gray-800/60 last:border-0 transition-colors ${
                    isSel
                      ? 'bg-amber-400/10 border-l-2 border-l-amber-400'
                      : 'hover:bg-gray-800'
                  }`}
                >
                  <div className={`text-xs font-bold font-mono ${isSel ? 'text-amber-400' : 'text-gray-300'}`}>
                    {stn.id}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{stn.name}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* map */}
        <div className="relative flex-1 rounded border border-gray-700 overflow-hidden">
          {!selected && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <p className="text-xs text-gray-600 tracking-widest uppercase">Select a station from the list</p>
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
      </div>

      <p className="text-xs text-gray-600 shrink-0">
        Source: NOAA/NWS RIDGE2 · WSR-88D
        {selected ? ` · ${selected.id}` : ''}
        {frames.length > 0 ? ` · ${frames.length} frames` : ''}
      </p>
    </div>
  );
};

export default RadarTab;
