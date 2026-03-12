import React, { useState } from 'react';
import { PLACEHOLDER_IMG } from '../../utils/constants';

const cb = `?v=${Math.floor(Date.now() / 1800000)}`; // 30 min cache bust

const REPORT_MAPS = [
  { id: 'today',     label: 'TODAY',      url: `https://www.spc.noaa.gov/climo/reports/today.gif${cb}` },
  { id: 'yesterday', label: 'YESTERDAY',  url: `https://www.spc.noaa.gov/climo/reports/yesterday.gif${cb}` },
];

const HAZARDS = [
  { id: 'all',  label: 'ALL'     },
  { id: 'torn', label: 'TORNADO' },
  { id: 'hail', label: 'HAIL'   },
  { id: 'wind', label: 'WIND'   },
];

const HAZARD_URLS = {
  today: {
    all:  `https://www.spc.noaa.gov/climo/reports/today.gif${cb}`,
    torn: `https://www.spc.noaa.gov/climo/reports/today_torn.gif${cb}`,
    hail: `https://www.spc.noaa.gov/climo/reports/today_hail.gif${cb}`,
    wind: `https://www.spc.noaa.gov/climo/reports/today_wind.gif${cb}`,
  },
  yesterday: {
    all:  `https://www.spc.noaa.gov/climo/reports/yesterday.gif${cb}`,
    torn: `https://www.spc.noaa.gov/climo/reports/yesterday_torn.gif${cb}`,
    hail: `https://www.spc.noaa.gov/climo/reports/yesterday_hail.gif${cb}`,
    wind: `https://www.spc.noaa.gov/climo/reports/yesterday_wind.gif${cb}`,
  },
};

const StormReportsTab = () => {
  const [period, setPeriod] = useState('today');
  const [hazard, setHazard] = useState('all');
  const src = HAZARD_URLS[period]?.[hazard];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="flex gap-2">
          {REPORT_MAPS.map(r => (
            <button
              key={r.id}
              onClick={() => setPeriod(r.id)}
              className={`px-3 py-1.5 text-xs font-bold tracking-wider uppercase rounded border transition-all ${
                period === r.id
                  ? 'border-amber-400 text-amber-400 bg-amber-400/10'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {HAZARDS.map(h => (
            <button
              key={h.id}
              onClick={() => setHazard(h.id)}
              className={`px-3 py-1.5 text-xs font-bold tracking-wider uppercase rounded border transition-all ${
                hazard === h.id
                  ? 'border-red-500 text-red-400 bg-red-500/10'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      <img
        key={`${period}-${hazard}`}
        src={src}
        alt={`Storm reports ${period} ${hazard}`}
        referrerPolicy="no-referrer"
        className="w-full h-auto rounded border border-gray-700 bg-gray-950"
        onError={e => { e.target.onerror = null; e.target.src = PLACEHOLDER_IMG; }}
      />

      <p className="text-xs text-gray-600">Source: NOAA/NWS Storm Prediction Center — Local Storm Reports</p>
    </div>
  );
};

export default StormReportsTab;
