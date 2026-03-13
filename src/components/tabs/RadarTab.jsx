import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const NWS_API = 'https://api.weather.gov/radar/stations';
const RIDGE2 = (id) => `https://opengeo.ncep.noaa.gov/geoserver/${id.toLowerCase()}/wms`;
const RIDGE2_CAPS = (id) =>
  `https://opengeo.ncep.noaa.gov/geoserver/${id.toLowerCase()}/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`;

const PRODUCTS = [
  { id: 'bref_raw', label: 'REFLECTIVITY' },
  { id: 'vel_raw',  label: 'VELOCITY' },
];

const ANIM_MS = 650;

// Parse ISO 8601 times out of a WMS GetCapabilities Dimension element
const parseTimes = (xmlText) => {
  try {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    const dims = doc.querySelectorAll('Dimension[name="time"], dimension[name="time"]');
    for (const dim of dims) {
      const raw = dim.textContent.trim();
      if (!raw) continue;
      if (raw.includes(',')) {
        return raw.split(',').map(t => t.trim()).filter(Boolean);
      }
      if (raw.includes('/')) {
        // interval: start/end/period
        const [start, end, period] = raw.split('/');
        const mMatch = period.match(/PT?(\d+)M/);
        if (!mMatch) return [start, end].filter(Boolean);
        const stepMs = parseInt(mMatch[1]) * 60 * 1000;
        const times = [];
        let t = new Date(start).getTime();
        const endT = new Date(end).getTime();
        while (t <= endT && times.length < 60) {
          times.push(new Date(t).toISOString().replace('.000Z', 'Z'));
          t += stepMs;
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

// ── component ────────────────────────────────────────────────────────────────

const RadarTab = () => {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const markersRef   = useRef(null);   // L.layerGroup for station dots
  const radarRef     = useRef(null);   // current WMS tile layer
  const animRef      = useRef(null);

  const [stations,        setStations]        = useState([]);
  const [selected,        setSelected]        = useState(null);
  const [product,         setProduct]         = useState('bref_raw');
  const [frames,          setFrames]          = useState([]);
  const [frameIdx,        setFrameIdx]        = useState(0);
  const [playing,         setPlaying]         = useState(false);
  const [radarLoading,    setRadarLoading]    = useState(false);
  const [search,          setSearch]          = useState('');
  const [showDropdown,    setShowDropdown]    = useState(false);

  // ── init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [38.5, -96],
      zoom: 4,
      zoomControl: true,
      attributionControl: false,
    });
    // Force Leaflet to recalculate container size after paint
    setTimeout(() => map.invalidateSize(), 100);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 19,
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // ── load stations from NWS ──────────────────────────────────────────────────
  useEffect(() => {
    fetch(NWS_API, { headers: { Accept: 'application/geo+json' } })
      .then(r => r.json())
      .then(data => {
        const stns = (data.features ?? [])
          .filter(f => f.properties?.stationType === 'WSR-88D')
          .map(f => ({
            id:   f.properties.stationIdentifier,
            name: f.properties.name,
            lat:  f.geometry.coordinates[1],
            lng:  f.geometry.coordinates[0],
          }))
          .sort((a, b) => a.id.localeCompare(b.id));
        setStations(stns);
      })
      .catch(console.error);
  }, []);

  // ── draw station markers ────────────────────────────────────────────────────
  useEffect(() => {
    if (!markersRef.current || !stations.length) return;
    markersRef.current.clearLayers();
    stations.forEach(stn => {
      const sel = selected?.id === stn.id;
      L.circleMarker([stn.lat, stn.lng], {
        radius:      sel ? 7 : 4,
        fillColor:   sel ? '#fbbf24' : '#6b7280',
        color:       sel ? '#fbbf24' : '#374151',
        weight:      1,
        fillOpacity: sel ? 1 : 0.65,
      })
        .bindTooltip(`<span style="font-family:monospace;font-size:11px"><b>${stn.id}</b> ${stn.name}</span>`, {
          direction: 'top', offset: [0, -6],
        })
        .on('click', () => { setSelected(stn); setSearch(''); setShowDropdown(false); })
        .addTo(markersRef.current);
    });
  }, [stations, selected]);

  // ── load radar when station/product changes ─────────────────────────────────
  const loadRadar = useCallback(async (stn, prod) => {
    if (!mapRef.current) return;
    setRadarLoading(true);
    setPlaying(false);
    setFrames([]);

    // remove old layer
    if (radarRef.current) { mapRef.current.removeLayer(radarRef.current); radarRef.current = null; }

    mapRef.current.setView([stn.lat, stn.lng], 7, { animate: true });

    try {
      const res = await fetch(RIDGE2_CAPS(stn.id));
      if (!res.ok) throw new Error('caps fetch failed');
      const xml = await res.text();
      const times = parseTimes(xml);

      const layer = L.tileLayer.wms(RIDGE2(stn.id), {
        layers:      `${stn.id.toLowerCase()}_${prod}`,
        format:      'image/png',
        transparent: true,
        version:     '1.3.0',
        crs:         L.CRS.EPSG3857,
        TIME:        times.length ? times[times.length - 1] : '',
        opacity:     0.8,
        zIndex:      10,
      });
      layer.addTo(mapRef.current);
      radarRef.current = layer;

      if (times.length) {
        setFrames(times);
        setFrameIdx(times.length - 1);
        setPlaying(true);
      }
    } catch (e) {
      console.error('radar load failed', e);
    } finally {
      setRadarLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) loadRadar(selected, product);
  }, [selected, product, loadRadar]);

  // ── update TIME on frame change ─────────────────────────────────────────────
  useEffect(() => {
    if (radarRef.current && frames.length) {
      radarRef.current.setParams({ TIME: frames[frameIdx] }, false);
    }
  }, [frameIdx, frames]);

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

  // ── search filter ───────────────────────────────────────────────────────────
  const filtered = search.trim()
    ? stations.filter(s =>
        s.id.toLowerCase().includes(search.toLowerCase()) ||
        s.name.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : [];

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">

      {/* ── controls ── */}
      <div className="flex items-center gap-3 flex-wrap shrink-0">

        {/* station search */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder="Search station…"
            className="bg-gray-900 border border-gray-700 text-gray-200 text-xs font-mono px-3 py-1.5 rounded w-52 placeholder-gray-600 focus:outline-none focus:border-amber-400/60 transition-colors"
          />
          {showDropdown && filtered.length > 0 && (
            <div className="absolute top-full mt-1 left-0 w-64 bg-gray-900 border border-gray-700 rounded z-50 shadow-xl overflow-hidden">
              {filtered.map(stn => (
                <button
                  key={stn.id}
                  onMouseDown={() => { setSelected(stn); setSearch(''); setShowDropdown(false); }}
                  className="w-full text-left px-3 py-2 text-xs font-mono text-gray-300 hover:bg-gray-800 border-b border-gray-800/60 last:border-0 flex items-center gap-2"
                >
                  <span className="text-amber-400 font-bold w-12 shrink-0">{stn.id}</span>
                  <span className="text-gray-500 truncate">{stn.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* product buttons */}
        {PRODUCTS.map(p => (
          <button
            key={p.id}
            onClick={() => setProduct(p.id)}
            className={`px-3 py-1.5 text-xs font-bold tracking-wider uppercase rounded border transition-all ${
              product === p.id
                ? 'border-amber-400 text-amber-400 bg-amber-400/10'
                : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}

        {/* selected station badge */}
        {selected && (
          <span className="text-xs font-mono text-amber-400 border border-amber-400/30 bg-amber-400/5 px-2 py-1 rounded shrink-0">
            {selected.id}
          </span>
        )}

        {/* play / scrubber */}
        {frames.length > 0 && (
          <>
            <button
              onClick={() => setPlaying(p => !p)}
              className="px-3 py-1.5 text-xs font-bold tracking-wider uppercase rounded border border-amber-400 text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 transition-all shrink-0"
            >
              {playing ? '⏸ PAUSE' : '▶ PLAY'}
            </button>
            <div className="flex items-center gap-2 flex-1 min-w-32">
              <input
                type="range"
                min={0}
                max={frames.length - 1}
                value={frameIdx}
                onChange={e => { setPlaying(false); setFrameIdx(Number(e.target.value)); }}
                className="flex-1 accent-amber-400"
              />
              <span className="text-xs font-mono text-gray-400 w-12 shrink-0 text-right">
                {fmtUtc(frames[frameIdx])}
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── map ── */}
      <div className="relative rounded border border-gray-700 overflow-hidden" style={{ height: '70vh' }}>
        {!selected && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <p className="text-xs text-gray-600 tracking-widest uppercase">
              Click a station or search above
            </p>
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

      {/* ── footer ── */}
      <p className="text-xs text-gray-600 shrink-0">
        Source: NOAA/NWS RIDGE2 · WSR-88D
        {selected ? ` · ${selected.id} — ${selected.name}` : ' · select a station'}
        {frames.length > 0 ? ` · ${frames.length} frames` : ''}
      </p>
    </div>
  );
};

export default RadarTab;
