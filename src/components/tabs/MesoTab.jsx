import React, { useState } from 'react';
import { PLACEHOLDER_IMG } from '../../utils/constants';

const BASE = 'https://www.spc.noaa.gov/sfctest/summary/';
const cb = `?v=${Math.floor(Date.now() / 3600000)}`;

const ANALYSES = [
  { id: 'sbcape',   label: 'SBCAPE',       url: `https://www.spc.noaa.gov/exper/mesoanalysis/s/sbcp/sbcp_conus.gif${cb}` },
  { id: 'mlcape',   label: 'MLCAPE',       url: `https://www.spc.noaa.gov/exper/mesoanalysis/s/mlcp/mlcp_conus.gif${cb}` },
  { id: 'srh01',    label: '0-1km SRH',    url: `https://www.spc.noaa.gov/exper/mesoanalysis/s/srh1/srh1_conus.gif${cb}` },
  { id: 'srh03',    label: '0-3km SRH',    url: `https://www.spc.noaa.gov/exper/mesoanalysis/s/srh3/srh3_conus.gif${cb}` },
  { id: 'stp',      label: 'SIG TORNADO',  url: `https://www.spc.noaa.gov/exper/mesoanalysis/s/stpc/stpc_conus.gif${cb}` },
  { id: 'scp',      label: 'SUPERCELL',    url: `https://www.spc.noaa.gov/exper/mesoanalysis/s/sccp/sccp_conus.gif${cb}` },
  { id: 'shear',    label: '0-6km SHEAR',  url: `https://www.spc.noaa.gov/exper/mesoanalysis/s/eshr/eshr_conus.gif${cb}` },
  { id: 'lapse',    label: 'LAPSE RATES',  url: `https://www.spc.noaa.gov/exper/mesoanalysis/s/laps/laps_conus.gif${cb}` },
  { id: 'pwat',     label: 'PWAT',         url: `https://www.spc.noaa.gov/exper/mesoanalysis/s/pwtr/pwtr_conus.gif${cb}` },
  { id: 'sfctheta', label: 'SFC THETA-E',  url: `https://www.spc.noaa.gov/exper/mesoanalysis/s/thte/thte_conus.gif${cb}` },
];

const MesoTab = () => {
  const [selected, setSelected] = useState('sbcape');
  const current = ANALYSES.find(a => a.id === selected);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {ANALYSES.map(a => (
          <button
            key={a.id}
            onClick={() => setSelected(a.id)}
            className={`px-3 py-1.5 text-xs font-bold tracking-wider uppercase rounded border transition-all ${
              selected === a.id
                ? 'border-amber-400 text-amber-400 bg-amber-400/10'
                : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
            }`}
          >
            {a.label}
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

      <p className="text-xs text-gray-600">Source: NOAA/NWS Storm Prediction Center Mesoanalysis</p>
    </div>
  );
};

export default MesoTab;
