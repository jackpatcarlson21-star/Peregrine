import React, { useState } from 'react';
import { PLACEHOLDER_IMG } from '../../utils/constants';

const cb = `?v=${Math.floor(Date.now() / 3600000)}`;

const MAPS = [
  { id: 'sfc',      label: 'SURFACE',         url: `https://www.wpc.ncep.noaa.gov/sfc/namussfc.gif${cb}` },
  { id: 'fronts',   label: 'FRONTS/PRECIP',   url: `https://www.wpc.ncep.noaa.gov/basicwx/92fndfd.gif${cb}` },
  { id: 'dewpoint', label: 'DEWPOINT',         url: `https://www.spc.noaa.gov/exper/mesoanalysis/s/dwpt/dwpt_conus.gif${cb}` },
  { id: 'theta',    label: 'THETA-E',          url: `https://www.spc.noaa.gov/exper/mesoanalysis/s/thte/thte_conus.gif${cb}` },
  { id: 'wind',     label: 'SFC WIND',         url: `https://www.spc.noaa.gov/exper/mesoanalysis/s/mixr/mixr_conus.gif${cb}` },
];

const SurfaceTab = () => {
  const [selected, setSelected] = useState('sfc');
  const current = MAPS.find(m => m.id === selected);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
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
        alt={current?.label}
        referrerPolicy="no-referrer"
        className="w-full h-auto rounded border border-gray-700 bg-gray-950"
        onError={e => { e.target.onerror = null; e.target.src = PLACEHOLDER_IMG; }}
      />

      <p className="text-xs text-gray-600">Source: NOAA/NWS Weather Prediction Center & SPC</p>
    </div>
  );
};

export default SurfaceTab;
