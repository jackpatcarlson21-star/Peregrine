import React, { useState } from 'react';
import { PLACEHOLDER_IMG } from '../../utils/constants';

// Major upper-air sounding stations (RAOB network)
const STATIONS = [
  { id: 'OAX', name: 'Omaha, NE' },
  { id: 'TOP', name: 'Topeka, KS' },
  { id: 'DDC', name: 'Dodge City, KS' },
  { id: 'OUN', name: 'Norman, OK' },
  { id: 'FWD', name: 'Fort Worth, TX' },
  { id: 'SHV', name: 'Shreveport, LA' },
  { id: 'LZK', name: 'Little Rock, AR' },
  { id: 'ILX', name: 'Lincoln, IL' },
  { id: 'DVN', name: 'Davenport, IA' },
  { id: 'ABR', name: 'Aberdeen, SD' },
  { id: 'BIS', name: 'Bismarck, ND' },
  { id: 'GGW', name: 'Glasgow, MT' },
  { id: 'SLC', name: 'Salt Lake City, UT' },
  { id: 'DNR', name: 'Denver, CO' },
  { id: 'AMA', name: 'Amarillo, TX' },
  { id: 'MAF', name: 'Midland, TX' },
  { id: 'JAX', name: 'Jacksonville, FL' },
  { id: 'TBW', name: 'Tampa, FL' },
  { id: 'BNA', name: 'Nashville, TN' },
  { id: 'GSO', name: 'Greensboro, NC' },
];

const TIMES = [
  { id: '12', label: '12Z' },
  { id: '00', label: '00Z' },
];

const SoundingsTab = () => {
  const [station, setStation] = useState('OUN');
  const [time, setTime] = useState('12');

  const url = `https://weather.uwyo.edu/upperair/images/${time}/${station}.gif`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center">
        {/* Time selector */}
        <div className="flex gap-2">
          {TIMES.map(t => (
            <button
              key={t.id}
              onClick={() => setTime(t.id)}
              className={`px-3 py-1.5 text-xs font-bold tracking-wider uppercase rounded border transition-all ${
                time === t.id
                  ? 'border-amber-400 text-amber-400 bg-amber-400/10'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Station selector */}
        <select
          value={station}
          onChange={e => setStation(e.target.value)}
          className="bg-gray-900 border border-gray-700 text-gray-200 text-xs px-3 py-1.5 rounded uppercase tracking-wider focus:outline-none focus:border-amber-400"
        >
          {STATIONS.map(s => (
            <option key={s.id} value={s.id}>{s.id} — {s.name}</option>
          ))}
        </select>
      </div>

      <img
        key={`${station}-${time}`}
        src={url}
        alt={`Sounding ${station} ${time}Z`}
        referrerPolicy="no-referrer"
        className="w-full h-auto rounded border border-gray-700 bg-gray-950"
        onError={e => { e.target.onerror = null; e.target.src = PLACEHOLDER_IMG; }}
      />

      <p className="text-xs text-gray-600">Source: University of Wyoming Upper Air Soundings</p>
    </div>
  );
};

export default SoundingsTab;
