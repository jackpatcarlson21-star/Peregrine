import React, { useState } from 'react';
import { PLACEHOLDER_IMG } from '../../utils/constants';

const BASE = 'https://www.spc.noaa.gov/products/outlook/';
const cb = `?v=${Math.floor(Date.now() / 3600000)}`;

const CANDIDATES = {
  categorical: {
    1: ['day1otlk_2000.png','day1otlk_1630.png','day1otlk_1300.png','day1otlk_1200.png','day1otlk_sm.png'],
    2: ['day2otlk_1730.png','day2otlk_0600.png','day2otlk_sm.png'],
    3: ['day3otlk_1930.png','day3otlk_0730.png','day3otlk_sm.png'],
  },
  tornado: {
    1: ['day1probotlk_2000_torn.png','day1probotlk_1630_torn.png','day1probotlk_1300_torn.png'],
    2: ['day2probotlk_1730_torn.png','day2probotlk_0600_torn.png'],
    3: ['day3prob_1930.png','day3prob_0730.png'],
  },
  wind: {
    1: ['day1probotlk_2000_wind.png','day1probotlk_1630_wind.png','day1probotlk_1300_wind.png'],
    2: ['day2probotlk_1730_wind.png','day2probotlk_0600_wind.png'],
    3: ['day3prob_1930.png','day3prob_0730.png'],
  },
  hail: {
    1: ['day1probotlk_2000_hail.png','day1probotlk_1630_hail.png','day1probotlk_1300_hail.png'],
    2: ['day2probotlk_1730_hail.png','day2probotlk_0600_hail.png'],
    3: ['day3prob_1930.png','day3prob_0730.png'],
  },
};

const DAYS = [
  { n: 1, label: 'DAY 1' },
  { n: 2, label: 'DAY 2' },
  { n: 3, label: 'DAY 3' },
];

const PRODUCTS = [
  { id: 'categorical', label: 'CATEGORICAL' },
  { id: 'tornado',     label: 'TORNADO'     },
  { id: 'wind',        label: 'WIND'        },
  { id: 'hail',        label: 'HAIL'        },
];

const CascadeImage = ({ candidates, alt }) => {
  const [idx, setIdx] = useState(0);
  const src = idx < candidates.length ? `${BASE}${candidates[idx]}${cb}` : PLACEHOLDER_IMG;
  return (
    <img
      key={src}
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      className="w-full h-auto rounded border border-gray-700 bg-gray-950"
      onError={() => setIdx(i => i + 1)}
    />
  );
};

const Btn = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-xs font-bold tracking-wider uppercase rounded border transition-all ${
      active
        ? 'border-amber-400 text-amber-400 bg-amber-400/10'
        : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
    }`}
  >
    {children}
  </button>
);

const OutlookTab = () => {
  const [day, setDay] = useState(1);
  const [product, setProduct] = useState('categorical');

  const candidates = CANDIDATES[product]?.[day] ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {DAYS.map(d => <Btn key={d.n} active={day === d.n} onClick={() => setDay(d.n)}>{d.label}</Btn>)}
        </div>
        <div className="flex gap-2">
          {PRODUCTS.map(p => <Btn key={p.id} active={product === p.id} onClick={() => setProduct(p.id)}>{p.label}</Btn>)}
        </div>
      </div>

      <CascadeImage
        key={`${day}-${product}`}
        candidates={candidates}
        alt={`SPC Day ${day} ${product} outlook`}
      />

      <p className="text-xs text-gray-600">Source: NOAA/NWS Storm Prediction Center</p>
    </div>
  );
};

export default OutlookTab;
