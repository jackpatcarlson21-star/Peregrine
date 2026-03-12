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

const TAB_TITLES = {
  [TABS.OUTLOOK]:   'SPC SEVERE WEATHER OUTLOOK',
  [TABS.RADAR]:     'NEXRAD RADAR',
  [TABS.STORM_RPT]: 'LOCAL STORM REPORTS',
  [TABS.MESO]:      'MESOSCALE ANALYSIS',
  [TABS.SOUNDINGS]: 'UPPER-AIR SOUNDINGS',
  [TABS.SURFACE]:   'SURFACE OBSERVATIONS',
  [TABS.LIGHTNING]: 'LIGHTNING STRIKES',
};

const COMPONENTS = {
  [TABS.OUTLOOK]:   OutlookTab,
  [TABS.RADAR]:     RadarTab,
  [TABS.STORM_RPT]: StormReportsTab,
  [TABS.MESO]:      MesoTab,
  [TABS.SOUNDINGS]: SoundingsTab,
  [TABS.SURFACE]:   SurfaceTab,
  [TABS.LIGHTNING]: LightningTab,
};

const App = () => {
  const [activeTab, setActiveTab] = useState(TABS.OUTLOOK);
  const ActiveComponent = COMPONENTS[activeTab];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-950">
      <Sidebar activeTab={activeTab} setTab={setActiveTab} />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-gray-800 shrink-0">
          <h1 className="text-sm font-bold tracking-widest text-gray-300 uppercase">
            {TAB_TITLES[activeTab]}
          </h1>
          <span className="text-xs text-gray-600 tracking-wider">
            {new Date().toUTCString().replace(':00 GMT', 'Z').slice(0, -4)}
          </span>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {ActiveComponent && <ActiveComponent />}
        </div>
      </main>
    </div>
  );
};

export default App;
