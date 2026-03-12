import React, { useState } from 'react';
import { PLACEHOLDER_IMG } from '../../utils/constants';

const PRODUCTS = [
  { id: 'conus',    label: 'CONUS',        url: 'https://radar.weather.gov/ridge/standard/CONUS-LARGE_loop.gif' },
  { id: 'composite', label: 'COMPOSITE',   url: 'https://radar.weather.gov/ridge/standard/CONUS_loop.gif' },
];

const RadarTab = () => {
  const [product, setProduct] = useState('conus');
  const current = PRODUCTS.find(p => p.id === product);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
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
      </div>

      <img
        key={product}
        src={`${current.url}?v=${Math.floor(Date.now() / 300000)}`}
        alt="NEXRAD Radar"
        referrerPolicy="no-referrer"
        className="w-full h-auto rounded border border-gray-700 bg-gray-950"
        onError={e => { e.target.onerror = null; e.target.src = PLACEHOLDER_IMG; }}
      />

      <p className="text-xs text-gray-600">Source: NOAA/NWS RIDGE — refreshes every 5 min</p>
    </div>
  );
};

export default RadarTab;
