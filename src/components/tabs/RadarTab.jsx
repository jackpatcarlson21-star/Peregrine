import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as topojson from 'topojson-client';
import statesAtlas from 'us-atlas/states-10m.json';

const NWS_API = 'https://api.weather.gov/radar/stations';
const RIDGE2  = (id) => `https://opengeo.ncep.noaa.gov/geoserver/${id.toLowerCase()}/wms`;

const PRODUCTS = [
  { id: 'sr_bref', label: 'REFLECTIVITY' },
  { id: 'sr_bvel', label: 'VELOCITY' },
  { id: 'bdhc',   label: 'HYDROMETEOR CLASS' },
  { id: 'boha',   label: '1HR PRECIP' },
  { id: 'bdsa',   label: 'STORM TOTAL' },
];

const NWS_ALERTS_API = 'https://api.weather.gov/alerts/active';
const WARNINGS_REFRESH_MS = 60_000;

const WARNING_STYLES = {
  'Tornado Warning': {
    color: '#FF1111', fillColor: '#FF1111', fillOpacity: 0.18, weight: 2.5,
  },
  'Severe Thunderstorm Warning': {
    color: '#FFD700', fillColor: '#FFD700', fillOpacity: 0.12, weight: 2, dashArray: '6 4',
  },
};

const RADAR_OPQ = 0.85;
const ANIM_MS   = 400;

const fmtUtc = (iso) => {
  if (!iso) return '----Z';
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2,'0')}${String(d.getUTCMinutes()).padStart(2,'0')}Z`;
};

const RadarTab = () => {
  const containerRef    = useRef(null);
  const mapRef          = useRef(null);
  const markersGroupRef = useRef(null);
  const frameLayersRef  = useRef([]);
  const loadIdRef       = useRef(0);
  const animRef         = useRef(null);
  const loadedRef        = useRef(new Set());
  const frameIdxRef      = useRef(0);
  const shownFrameRef    = useRef(-1);
  const boundaryLayerRef = useRef(null);
  const selectedRef      = useRef(null);
  const productRef       = useRef('sr_bref');
  const tiltRef          = useRef('0.5');
  const warningsLayerRef    = useRef(null);
  const warningsIntervalRef = useRef(null);

  const [stations,     setStations]     = useState([]);
  const [selected,     setSelected]     = useState(null);
  const [product,      setProduct]      = useState('sr_bref');
  const [frames,       setFrames]       = useState([]);
  const [frameIdx,     setFrameIdx]     = useState(0);
  const [playing,      setPlaying]      = useState(false);
  const [radarLoading, setRadarLoading] = useState(false);
  const [radarError,   setRadarError]   = useState(null);
  const [search,       setSearch]       = useState('');
  const [showBounds,   setShowBounds]   = useState(true);
  const [tilt,           setTilt]           = useState('0.5');
  const [availableTilts, setAvailableTilts] = useState(['0.5']);
  const [showWarnings,   setShowWarnings]   = useState(true);

  // ── init map ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [38.5, -96], zoom: 4,
      zoomControl: true, attributionControl: false,
    });
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
    }).addTo(map);

    const statesGeo = topojson.feature(statesAtlas, statesAtlas.objects.states);
    const meshGeo   = topojson.mesh(statesAtlas, statesAtlas.objects.states, (a, b) => a !== b);

    const boundaryGroup = L.layerGroup().addTo(map);
    L.geoJSON(meshGeo,   { style: { color: '#ffffff', weight: 0.8, opacity: 0.25, fill: false } }).addTo(boundaryGroup);
    L.geoJSON(statesGeo, { style: { color: '#ffffff', weight: 1.2, opacity: 0.4,  fill: false } }).addTo(boundaryGroup);
    boundaryLayerRef.current = boundaryGroup;

    markersGroupRef.current = L.layerGroup().addTo(map);
    setTimeout(() => map.invalidateSize(), 100);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // ── toggle boundaries ─────────────────────────────────────────────────────
  useEffect(() => {
    const map   = mapRef.current;
    const layer = boundaryLayerRef.current;
    if (!map || !layer) return;
    if (showBounds) map.addLayer(layer);
    else            map.removeLayer(layer);
  }, [showBounds]);

  // ── load stations ──────────────────────────────────────────────────────────
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

  // ── draw station label tiles ────────────────────────────────────────────────
  useEffect(() => {
    if (!markersGroupRef.current || !stations.length) return;

    markersGroupRef.current.clearLayers();

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
      marker.on('click', () => setSelected(stn));
      markersGroupRef.current.addLayer(marker);
    });
  }, [stations, selected, search]);

  // ── load radar ─────────────────────────────────────────────────────────────
  const loadRadar = useCallback(async (stn, prod, elev) => {
    const map = mapRef.current;
    if (!map) return;

    const myId = ++loadIdRef.current;

    setRadarLoading(true);
    setRadarError(null);
    setPlaying(false);
    setFrames([]);

    frameLayersRef.current.forEach(l => map.removeLayer(l));
    frameLayersRef.current = [];
    loadedRef.current  = new Set();
    shownFrameRef.current = -1;

    map.setView([stn.lat, stn.lng], 7, { animate: true });

    try {
      const res  = await fetch(`/api/radar/times?station=${stn.id}`);
      const data = await res.json();
      const times      = data.times      ?? [];
      const elevations = data.elevations ?? ['0.5'];

      if (loadIdRef.current !== myId) return;

      setAvailableTilts(elevations);
      if (!elevations.includes(elev)) {
        elev = elevations[0];
        setTilt(elev);
        tiltRef.current = elev;
      }

      if (!times.length) throw new Error(`No scan data available for ${stn.id}`);

      const layerName = `${stn.id.toLowerCase()}_${prod}`;

      const applyTransition = (l) => {
        if (l._container) l._container.style.transition = 'opacity 0.2s ease-in-out';
      };

      const showFrame = (idx) => {
        frameLayersRef.current.forEach((fl, fi) => {
          applyTransition(fl);
          fl.setOpacity(fi === idx ? RADAR_OPQ : 0);
        });
        shownFrameRef.current = idx;
      };

      const layers = times.map((time, i) => {
        const layer = L.tileLayer.wms(RIDGE2(stn.id), {
          layers:      layerName,
          format:      'image/png',
          transparent: true,
          version:     '1.3.0',
          crs:         L.CRS.EPSG3857,
          TIME:        time,
          ELEVATION:   elev,
          opacity:     0,
          zIndex:      10,
        }).addTo(map);

        // Re-mark as loading whenever tiles are re-requested (pan/zoom)
        layer.on('loading', () => loadedRef.current.delete(i));

        layer.on('load', () => {
          loadedRef.current.add(i);
          applyTransition(layer);
          if (frameIdxRef.current === i) showFrame(i);
        });

        return layer;
      });

      frameLayersRef.current = layers;
      // Directly set the last frame visible — setFrameIdx may not trigger the
      // effect if the value hasn't changed (e.g. prev station had same frame count).
      frameIdxRef.current = times.length - 1;
      layers[times.length - 1]?.setOpacity(RADAR_OPQ);

      setFrames(times);
      setFrameIdx(times.length - 1);
      setPlaying(true);
    } catch (e) {
      if (loadIdRef.current === myId) {
        setRadarError(e.message);
        console.error('radar load failed', e);
      }
    } finally {
      if (loadIdRef.current === myId) setRadarLoading(false);
    }
  }, []);

  // Keep refs in sync for use in intervals
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { productRef.current  = product;  }, [product]);
  useEffect(() => { tiltRef.current     = tilt;     }, [tilt]);

  useEffect(() => {
    if (selected) loadRadar(selected, product, tilt);
  }, [selected, product, tilt, loadRadar]);

  // ── auto-refresh every 60 s ────────────────────────────────────────────────
  useEffect(() => {
    if (!selected) return;
    const id = setInterval(() => {
      if (selectedRef.current) {
        loadRadar(selectedRef.current, productRef.current, tiltRef.current);
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [selected, loadRadar]);

  // ── show only current frame ────────────────────────────────────────────────
  useEffect(() => {
    frameIdxRef.current = frameIdx;
    const layers = frameLayersRef.current;
    if (!layers.length) return;

    if (loadedRef.current.has(frameIdx)) {
      layers.forEach((l, i) => {
        if (l._container) l._container.style.transition = 'opacity 0.2s ease-in-out';
        l.setOpacity(i === frameIdx ? RADAR_OPQ : 0);
      });
      shownFrameRef.current = frameIdx;
    } else {
      // Tiles not ready — keep last good frame visible while new frame loads
      layers.forEach((l, i) => {
        if (l._container) l._container.style.transition = 'opacity 0.2s ease-in-out';
        if (i === frameIdx)                   l.setOpacity(RADAR_OPQ);
        else if (i === shownFrameRef.current) l.setOpacity(RADAR_OPQ);
        else                                  l.setOpacity(0);
      });
    }
  }, [frameIdx]);

  // ── animation loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    clearInterval(animRef.current);
    if (playing && frames.length > 1) {
      animRef.current = setInterval(() => {
        setFrameIdx(cur => {
          for (let step = 1; step <= frames.length; step++) {
            const next = (cur + step) % frames.length;
            if (loadedRef.current.has(next)) return next;
          }
          return cur;
        });
      }, ANIM_MS);
    }
    return () => clearInterval(animRef.current);
  }, [playing, frames.length]);

  // ── warning polygons ───────────────────────────────────────────────────────
  const fetchWarnings = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    try {
      const url = `${NWS_ALERTS_API}?status=actual&event=Severe%20Thunderstorm%20Warning,Tornado%20Warning`;
      const res = await fetch(url, { headers: { Accept: 'application/geo+json' } });
      if (!res.ok) throw new Error(`NWS alerts ${res.status}`);
      const geojson = await res.json();

      if (warningsLayerRef.current) {
        map.removeLayer(warningsLayerRef.current);
        warningsLayerRef.current = null;
      }
      if (!geojson.features?.length) return;

      const layer = L.geoJSON(geojson, {
        style: (feature) => {
          const evt = feature.properties?.event;
          return WARNING_STYLES[evt] || WARNING_STYLES['Severe Thunderstorm Warning'];
        },
        onEachFeature: (feature, layer) => {
          const p = feature.properties;
          if (!p) return;
          const isTor = p.event === 'Tornado Warning';
          const expires = p.expires ? new Date(p.expires).toUTCString() : 'Unknown';
          layer.bindPopup(
            `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;max-width:320px;line-height:1.5">
              <div style="font-weight:bold;font-size:13px;color:${isTor ? '#FF1111' : '#FFD700'};margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em">
                ${p.event || 'WARNING'}
              </div>
              <div style="color:#d1d5db;margin-bottom:6px">${p.headline || ''}</div>
              <div style="color:#9ca3af;font-size:10px"><strong>Area:</strong> ${p.areaDesc || 'N/A'}</div>
              <div style="color:#9ca3af;font-size:10px"><strong>Expires:</strong> ${expires}</div>
            </div>`,
            { maxWidth: 350 }
          );
        },
      }).addTo(map);

      warningsLayerRef.current = layer;
    } catch (err) {
      console.error('Warning polygon fetch failed:', err);
    }
  }, []);

  useEffect(() => {
    clearInterval(warningsIntervalRef.current);
    warningsIntervalRef.current = null;
    if (showWarnings && mapRef.current) {
      fetchWarnings();
      warningsIntervalRef.current = setInterval(fetchWarnings, WARNINGS_REFRESH_MS);
    } else if (!showWarnings && warningsLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(warningsLayerRef.current);
      warningsLayerRef.current = null;
    }
    return () => clearInterval(warningsIntervalRef.current);
  }, [showWarnings, fetchWarnings]);

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <input
          type="text" value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter stations…"
          className="bg-gray-900 border border-gray-700 text-gray-200 text-xs font-mono px-3 py-1.5 rounded w-36 md:w-44 placeholder-gray-600 focus:outline-none focus:border-amber-400/60 transition-colors"
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
        <button onClick={() => setShowBounds(v => !v)}
          className={`px-3 py-1.5 text-xs font-bold tracking-wider uppercase rounded border transition-all ${
            showBounds
              ? 'border-sky-500 text-sky-400 bg-sky-500/10'
              : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
          }`}>
          STATES
        </button>
        <button onClick={() => setShowWarnings(w => !w)}
          className={`px-3 py-1.5 text-xs font-bold tracking-wider uppercase rounded border transition-all ${
            showWarnings
              ? 'border-red-500 text-red-400 bg-red-500/10'
              : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
          }`}>
          {showWarnings ? 'WARNINGS ON' : 'WARNINGS OFF'}
        </button>
        {availableTilts.length > 1 && (
          <>
            <span className="text-xs font-bold tracking-wider uppercase text-gray-500">TILT</span>
            {availableTilts.map(t => (
              <button key={t} onClick={() => setTilt(t)}
                className={`px-3 py-1.5 text-xs font-bold tracking-wider uppercase rounded border transition-all ${
                  tilt === t
                    ? 'border-amber-400 text-amber-400 bg-amber-400/10'
                    : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                }`}>
                {t}°
              </button>
            ))}
          </>
        )}
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

      <div className="relative rounded border border-gray-700 overflow-hidden" style={{ height: 'clamp(300px, 58vh, 70vh)' }}>
        {!selected && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <p className="text-xs text-gray-600 tracking-widest uppercase">Click a station label to load radar</p>
          </div>
        )}
        {radarLoading && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-gray-900/90 border border-gray-700 px-3 py-1.5 rounded">
            <span className="text-xs text-gray-400 tracking-widest uppercase animate-pulse">Loading {selected?.id}…</span>
          </div>
        )}
        {radarError && !radarLoading && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-gray-900/90 border border-red-800 px-3 py-1.5 rounded">
            <span className="text-xs text-red-400 tracking-wider">{radarError}</span>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>

      <p className="text-xs text-gray-600 shrink-0">
        Source: NOAA/NWS RIDGE2 · WSR-88D · Esri World Imagery{selected ? ` · ${selected.id} — ${selected.name}` : ''}
        {frames.length > 0 ? ` · ${frames.length} frames` : ''}
        {showWarnings ? ' · NWS Active Alerts' : ''}
      </p>
    </div>
  );
};

export default RadarTab;
