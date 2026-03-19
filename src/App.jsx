import React, { useState } from 'react';
import { TABS } from './utils/constants';
import Sidebar from './components/layout/Sidebar';
import OutlookTab from './components/tabs/OutlookTab';
import RadarTab from './components/tabs/RadarTab';
import StormReportsTab from './components/tabs/StormReportsTab';
import MesoTab from './components/tabs/MesoTab';
import SoundingsTab from './components/tabs/SoundingsTab';
import SurfaceTab from './components/tabs/SurfaceTab';
import LightningTab from './components/tabs/LightningTab';
import {
  CloudLightning, Radar, AlertTriangle, Wind, BarChart2, Map, Zap,
} from 'lucide-react';

const TAB_TITLES = {
  [TABS.OUTLOOK]:   'SPC SEVERE WEATHER OUTLOOK',
  [TABS.RADAR]:     'NEXRAD RADAR',
  [TABS.STORM_RPT]: 'LOCAL STORM REPORTS',
  [TABS.MESO]:      'MESOSCALE ANALYSIS',
  [TABS.SOUNDINGS]: 'UPPER-AIR SOUNDINGS',
  [TABS.SURFACE]:   'SURFACE OBSERVATIONS',
  [TABS.LIGHTNING]: 'LIGHTNING STRIKES',
};

const MOBILE_NAV = [
  { id: TABS.OUTLOOK,   label: 'OUTLOOK',  Icon: CloudLightning },
  { id: TABS.RADAR,     label: 'RADAR',    Icon: Radar          },
  { id: TABS.STORM_RPT, label: 'REPORTS',  Icon: AlertTriangle  },
  { id: TABS.MESO,      label: 'MESO',     Icon: Wind           },
  { id: TABS.SOUNDINGS, label: 'SNDNGS',   Icon: BarChart2      },
  { id: TABS.SURFACE,   label: 'SURFACE',  Icon: Map            },
  { id: TABS.LIGHTNING, label: 'LTNG',     Icon: Zap            },
];

const COMPONENTS = {
  [TABS.OUTLOOK]:   OutlookTab,
  [TABS.RADAR]:     RadarTab,
  [TABS.STORM_RPT]: StormReportsTab,
  [TABS.MESO]:      MesoTab,
  [TABS.SOUNDINGS]: SoundingsTab,
  [TABS.SURFACE]:   SurfaceTab,
  [TABS.LIGHTNING]: LightningTab,
};

const ZOOM_MIN = 70;
const ZOOM_MAX = 130;
const ZOOM_STEP = 5;

const App = () => {
  const [activeTab, setActiveTab] = useState(TABS.OUTLOOK);
  const [zoom, setZoom] = useState(100);
  const ActiveComponent = COMPONENTS[activeTab];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-950">
      {/* Desktop sidebar */}
      <Sidebar activeTab={activeTab} setTab={setActiveTab} />

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-gray-800 shrink-0">
          {/* Mobile: show logo */}
          <span className="md:hidden text-amber-400 font-bold text-sm tracking-widest uppercase">
            Peregrine
          </span>
          <h1 className="hidden md:block text-sm font-bold tracking-widest text-gray-300 uppercase">
            {TAB_TITLES[activeTab]}
          </h1>
          {/* Mobile: show tab title (truncated) */}
          <h1 className="md:hidden text-xs font-bold tracking-widest text-gray-300 uppercase truncate mx-3 flex-1">
            {TAB_TITLES[activeTab]}
          </h1>

          <div className="hidden md:flex items-center gap-2 ml-4">
            <button
              onClick={() => setZoom(z => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
              className="text-gray-500 hover:text-gray-200 text-lg leading-none select-none px-1"
              title="Zoom out"
            >−</button>
            <input
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={ZOOM_STEP}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="w-24 accent-amber-400"
            />
            <button
              onClick={() => setZoom(z => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
              className="text-gray-500 hover:text-gray-200 text-lg leading-none select-none px-1"
              title="Zoom in"
            >+</button>
            <span className="text-xs text-gray-600 w-8 text-right">{zoom}%</span>
          </div>

          <span className="text-xs text-gray-600 tracking-wider shrink-0 ml-4">
            {new Date().toUTCString().slice(17, 22)}Z
          </span>
        </header>

        {/* Content — leave room for mobile bottom nav */}
        <div className="flex-1 overflow-y-auto p-3 md:p-6 pb-[72px] md:pb-6">
          <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left', width: `${10000 / zoom}%` }}>
            {ActiveComponent && <ActiveComponent />}
          </div>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gray-950 border-t border-gray-800 flex">
        {MOBILE_NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors min-w-0 ${
              activeTab === id
                ? 'text-amber-400'
                : 'text-gray-600 active:text-gray-300'
            }`}
          >
            <Icon size={18} strokeWidth={activeTab === id ? 2.5 : 1.5} />
            <span className="text-[9px] font-bold tracking-wider leading-none">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
