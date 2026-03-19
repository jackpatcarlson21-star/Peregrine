import React, { useState } from 'react';
import { PLACEHOLDER_IMG } from '../../utils/constants';

const cb = `?v=${Math.floor(Date.now() / 600000)}`; // 10 min cache bust

const MAPS = [
  { id: '5m',  label: '5 MIN',   url: `https://www.spc.noaa.gov/exper/nldn/images/nldn5min.gif${cb}` },
  { id: '1hr', label: '1 HOUR',  url: `https://www.spc.noaa.gov/exper/nldn/images/nldn1hr.gif${cb}` },
  { id: '6hr', label: '6 HOUR',  url: `https://www.spc.noaa.gov/exper/nldn/images/nldn6hr.gif${cb}` },
];

const LightningTab = () => {
  const [selected, setSelected] = useState('5m');
  const current = MAPS.find(m => m.id === selected);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {MAPS.map(m => (
          <button
            key={m.id}
            onClick={() => setSelected(m.id)}
            className={`px-3 py-1.5 text-xs font-bold tracking-wider uppercase rounded border transition-all ${
              selected === m.id
                ? 'border-amber-400 text-amber-400 bg-amber-400/10'
                : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <img
        key={selected}
        src={current?.url}
        alt={`Lightning ${current?.label}`}
        referrerPolicy="no-referrer"
        className="w-full h-auto rounded border border-gray-700 bg-gray-950"
        onError={e => { e.target.onerror = null; e.target.src = PLACEHOLDER_IMG; }}
      />

      <p className="text-xs text-gray-600">Source: NOAA/SPC NLDN Lightning Data</p>
    </div>
  );
};

export default LightningTab;
