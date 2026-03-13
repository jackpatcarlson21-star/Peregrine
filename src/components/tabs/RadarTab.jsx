import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const NWS_API = 'https://api.weather.gov/radar/stations';
const IEM_WMS = 'https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0q.cgi';

// IEM time-shifted composite layers, oldest → newest
const FRAME_OFFSETS = [55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5, 0];
const frameLayerId  = (min) => min === 0 ? 'nexrad-n0q-900913' : `nexrad-n0q-900913-m${String(min).padStart(2,'0')}m`;
const frameLabel    = (min) => {
  const t = new Date(Date.now() - min * 60000);
  return `${String(t.getUTCHours()).padStart(2,'0')}${String(t.getUTCMinutes()).padStart(2,'0')}Z`;
};

const RADAR_OPQ = 0.85;
const ANIM_MS   = 700;

const RadarTab = () => {
  const containerRef   = useRef(null);
  const mapRef         = useRef(null);
  const frameLayersRef = useRef([]);
  const animRef        = useRef(null);

  const [stations, setStations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [frameIdx, setFrameIdx] = useState(FRAME_OFFSETS.length - 1); // start at "now"
  const [playing,  setPlaying]  = useState(true);
  const [search,   setSearch]   = useState('');

  // ── init map + pre-load all radar layers ─────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [38.5, -96], zoom: 4,
      zoomControl: true, attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 19,
    }).addTo(map);

    // Pre-create all IEM radar layers at once (tiles start loading in background)
    const layers = FRAME_OFFSETS.map((min, i) =>
      L.tileLayer.wms(IEM_WMS, {
        layers:      frameLayerId(min),
        format:      'image/png',
        transparent: true,
        version:     '1.1.1',
        opacity:     i === FRAME_OFFSETS.length - 1 ? RADAR_OPQ : 0,
        zIndex:      10,
      }).addTo(map)
    );

    frameLayersRef.current = layers;
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
      frameLayersRef.current = [];
    };
  }, []);

  // ── load stations ─────────────────────────────────────────────────────────────
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

  // ── draw station label tiles on map ──────────────────────────────────────────
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
          font-size:10px;
          font-family:monospace;
          font-weight:bold;
          padding:2px 5px;
          border-radius:3px;
          white-space:nowrap;
          cursor:pointer;
          user-select:none;
          box-shadow:0 1px 4px rgba(0,0,0,0.6);
          letter-spacing:0.05em;
        ">${stn.id}</div>`,
        className: '',
        iconAnchor: [20, 10],
      });
      const marker = L.marker([stn.lat, stn.lng], { icon });
      marker._isStationMarker = true;
      marker.on('click', () => setSelected(stn));
      marker.addTo(map);
    });
  }, [stations, selected, search]);

  // ── zoom to station on select ─────────────────────────────────────────────────
  useEffect(() => {
    if (selected && mapRef.current) {
      mapRef.current.setView([selected.lat, selected.lng], 7, { animate: true });
    }
  }, [selected]);

  // ── show only current frame ───────────────────────────────────────────────────
  useEffect(() => {
    frameLayersRef.current.forEach((l, i) =>
      l.setOpacity(i === frameIdx ? RADAR_OPQ : 0)
    );
  }, [frameIdx]);

  // ── animation loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    clearInterval(animRef.current);
    if (playing) {
      animRef.current = setInterval(
        () => setFrameIdx(i => (i + 1) % FRAME_OFFSETS.length),
        ANIM_MS
      );
    }
    return () => clearInterval(animRef.current);
  }, [playing]);

  const currentLabel = frameLabel(FRAME_OFFSETS[frameIdx]);

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

        <button
          onClick={() => setPlaying(p => !p)}
          className="px-3 py-1.5 text-xs font-bold tracking-wider uppercase rounded border border-amber-400 text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 transition-all"
        >
          {playing ? '⏸ PAUSE' : '▶ PLAY'}
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-32">
          <input
            type="range"
            min={0}
            max={FRAME_OFFSETS.length - 1}
            value={frameIdx}
            onChange={e => { setPlaying(false); setFrameIdx(Number(e.target.value)); }}
            className="flex-1 accent-amber-400"
          />
          <span className={`text-xs font-mono w-14 shrink-0 text-right ${frameIdx === FRAME_OFFSETS.length - 1 ? 'text-amber-400 font-bold' : 'text-gray-400'}`}>
            {currentLabel}
          </span>
        </div>

        {selected && (
          <span className="text-xs font-mono text-amber-400 border border-amber-400/30 bg-amber-400/5 px-2 py-1 rounded shrink-0 ml-auto">
            {selected.id} — {selected.name}
          </span>
        )}
      </div>

      {/* map */}
      <div className="relative rounded border border-gray-700 overflow-hidden" style={{ height: '70vh' }}>
        {!selected && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <p className="text-xs text-gray-600 tracking-widest uppercase">Click a station label to zoom in</p>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>

      <p className="text-xs text-gray-600 shrink-0">
        Source: Iowa Environmental Mesonet · NEXRAD composite reflectivity · last 55 min
        {selected ? ` · ${selected.id} — ${selected.name}` : ''}
      </p>
    </div>
  );
};

export default RadarTab;
