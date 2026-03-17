import React from 'react';
import { TABS } from '../../utils/constants';

const NAV_ITEMS = [
  { id: TABS.OUTLOOK,   label: 'SPC OUTLOOK'   },
  { id: TABS.RADAR,     label: 'RADAR'          },
  { id: TABS.STORM_RPT, label: 'STORM REPORTS'  },
  { id: TABS.MESO,      label: 'MESO ANALYSIS'  },
  { id: TABS.SOUNDINGS, label: 'SOUNDINGS'      },
  { id: TABS.SURFACE,   label: 'SURFACE OBS'    },
  { id: TABS.LIGHTNING, label: 'LIGHTNING'      },
];

const Sidebar = ({ activeTab, setTab }) => (
  <aside className="hidden md:flex w-48 shrink-0 bg-gray-950 border-r border-gray-800 flex-col">
    {/* Logo */}
    <div className="px-4 py-5 border-b border-gray-800">
      <div className="text-amber-400 font-bold text-lg tracking-widest uppercase">Peregrine</div>
      <div className="text-gray-600 text-xs tracking-wider mt-0.5">Storm Chase Tools</div>
    </div>

    {/* Nav */}
    <nav className="flex flex-col gap-1 p-2 flex-1">
      {NAV_ITEMS.map(item => (
        <button
          key={item.id}
          onClick={() => setTab(item.id)}
          className={`nav-btn text-left ${activeTab === item.id ? 'nav-btn-active' : ''}`}
        >
          {item.label}
        </button>
      ))}
    </nav>

    {/* Footer */}
    <div className="px-4 py-3 border-t border-gray-800 text-gray-700 text-xs">
      Data: NOAA/NWS/SPC
    </div>
  </aside>
);

export default Sidebar;
