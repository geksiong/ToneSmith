import React, { useState } from 'react';
import { ComponentType, CircuitComponent } from '../types/guitar';
import { COMPONENT_METADATA } from '../lib/componentDefs';
import {
  Plus,
  Disc,
  Sliders,
  ToggleLeft,
  Cpu,
  Radio,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Info,
} from 'lucide-react';

interface ComponentLibraryProps {
  onAddComponent: (comp: CircuitComponent) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  theme?: 'dark' | 'light';
}

interface ItemCardProps {
  title: string;
  badge?: { text: string; colorClass?: string };
  description: string;
  specs: React.ReactNode;
  onClick: () => void;
}

const LibraryItemCard: React.FC<ItemCardProps> = ({
  title,
  badge,
  description,
  specs,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="p-3 bg-white hover:bg-amber-500/5 dark:bg-zinc-800/90 dark:hover:bg-zinc-800 border border-zinc-300 hover:border-amber-500/60 dark:border-zinc-700/80 dark:hover:border-amber-500/50 rounded-xl text-left transition-all group flex flex-col gap-1.5 shadow-xs hover:shadow-sm"
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-xs font-mono font-bold text-zinc-900 group-hover:text-amber-600 dark:text-zinc-100 dark:group-hover:text-amber-400 truncate">
          {title}
        </span>
        {badge && (
          <span
            className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 ${
              badge.colorClass ||
              'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30'
            }`}
          >
            {badge.text}
          </span>
        )}
      </div>
      <span className="p-1 rounded bg-zinc-100 group-hover:bg-amber-500 text-zinc-700 group-hover:text-zinc-950 dark:bg-zinc-700/80 dark:text-zinc-300 dark:group-hover:bg-amber-500 dark:group-hover:text-zinc-950 transition-colors shrink-0">
        <Plus className="w-3.5 h-3.5" />
      </span>
    </div>
    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-sans leading-tight">
      {description}
    </p>
    <div className="flex items-center gap-2 mt-0.5 pt-1.5 border-t border-zinc-200 dark:border-zinc-700 text-[10px] font-mono text-zinc-600 dark:text-zinc-400 font-medium">
      {specs}
    </div>
  </button>
);

export const ComponentLibrary: React.FC<ComponentLibraryProps> = ({
  onAddComponent,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [activeTab, setActiveTab] = useState<'pickups' | 'pots' | 'switches' | 'passives' | 'hardware'>('pickups');

  const addComp = (
    type: ComponentType,
    customProps: Partial<CircuitComponent['properties']> = {},
    customName?: string
  ) => {
    const meta = COMPONENT_METADATA[type];
    const id = `${type}-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 3)}`;
    const newComponent: CircuitComponent = {
      id,
      type,
      name: customName || meta.name,
      x: 180 + Math.round(Math.random() * 80),
      y: 120 + Math.round(Math.random() * 80),
      properties: {
        currentValue: 1.0,
        ...customProps,
      },
    };
    onAddComponent(newComponent);
  };

  const categories = [
    { id: 'pickups', label: 'Pickups', icon: Disc, count: 6 },
    { id: 'pots', label: 'Pots', icon: Sliders, count: 5 },
    { id: 'switches', label: 'Switches', icon: ToggleLeft, count: 6 },
    { id: 'passives', label: 'Caps & Res', icon: Cpu, count: 4 },
    { id: 'hardware', label: 'Hardware', icon: Radio, count: 2 },
  ];

  if (isCollapsed) {
    return (
      <aside className="w-12 h-full border-r border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/95 backdrop-blur flex flex-col items-center py-3 z-20 shrink-0 shadow-lg select-none transition-all">
        {/* Expand button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Expand Component Palette"
          className="p-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-amber-600 dark:text-amber-400 transition-all shadow-sm"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>

        <div className="w-6 h-[1px] bg-zinc-200 dark:bg-zinc-800 my-3" />

        {/* Vertical Category Icons */}
        <div className="flex flex-col gap-2.5">
          {categories.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id as any);
                  if (onToggleCollapse) onToggleCollapse();
                }}
                title={`Open ${tab.label}`}
                className={`p-2 rounded-lg transition-all ${
                  isActive
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-400'
                    : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>

        {/* Vertical Text */}
        <div className="mt-auto py-4">
          <span
            className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 tracking-widest uppercase cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-200"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            onClick={onToggleCollapse}
          >
            PARTS PALETTE
          </span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 h-full border-r border-zinc-300 dark:border-zinc-800 bg-zinc-50/95 dark:bg-zinc-900/95 backdrop-blur flex flex-col z-20 shrink-0 shadow-xl select-none transition-all">
      {/* Left Sidebar Header */}
      <div className="p-3.5 border-b border-zinc-300 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-950/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-mono font-bold text-zinc-950 dark:text-zinc-100 tracking-wider">
              COMPONENT PALETTE
            </h2>
            <p className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400">Click to place into cavity</p>
          </div>
        </div>

        {/* Collapse Button */}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Collapse Component Palette"
            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category Tabs Bar */}
      <div className="p-2 border-b border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950/30 flex gap-1 overflow-x-auto">
        {categories.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-zinc-700 hover:text-zinc-950 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/80 font-medium'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Component Cards Scrollable List */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {activeTab === 'pickups' && (
          <>
            <LibraryItemCard
              title="Humbucker (4-Wire)"
              description="Dual-coil hum-cancelling pickup with individual leads for coil-splitting and phase reverse."
              specs={
                <>
                  <span className="text-amber-700 dark:text-amber-400 font-bold">8.4 kΩ</span>
                  <span>•</span>
                  <span>4.2 H</span>
                  <span>•</span>
                  <span className="text-cyan-700 dark:text-cyan-400 font-semibold">Flip Magnet Ready</span>
                </>
              }
              onClick={() =>
                addComp(
                  'pickup-humbucker',
                  {
                    dcResistanceK: 8.4,
                    inductanceH: 4.2,
                    pickupPosition: 'bridge',
                    magnetType: 'Alnico II',
                  },
                  '4-Conductor Humbucker'
                )
              }
            />

            <LibraryItemCard
              title="Strat Single Coil"
              description="Traditional bell-like Strat chime with staggered Alnico V polepieces."
              specs={
                <>
                  <span className="text-amber-700 dark:text-amber-400 font-bold">6.0 kΩ</span>
                  <span>•</span>
                  <span>2.6 H</span>
                  <span>•</span>
                  <span>North Polarity</span>
                </>
              }
              onClick={() =>
                addComp(
                  'pickup-singlecoil',
                  {
                    dcResistanceK: 6.0,
                    inductanceH: 2.6,
                    pickupPosition: 'neck',
                    rwrp: false,
                  },
                  'Strat Single Coil'
                )
              }
            />

            <LibraryItemCard
              title="Strat Middle (RWRP)"
              badge={{
                text: 'RWRP',
                colorClass:
                  'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30',
              }}
              description="Reverse-wound reverse-polarity middle pickup for hum cancellation in positions 2 & 4."
              specs={
                <>
                  <span className="text-amber-700 dark:text-amber-400 font-bold">6.2 kΩ</span>
                  <span>•</span>
                  <span>2.8 H</span>
                  <span>•</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">South Polarity</span>
                </>
              }
              onClick={() =>
                addComp(
                  'pickup-singlecoil',
                  {
                    dcResistanceK: 6.2,
                    inductanceH: 2.8,
                    pickupPosition: 'middle',
                    rwrp: true,
                  },
                  'Strat Middle (RWRP)'
                )
              }
            />

            <LibraryItemCard
              title="P-90 Soapbar"
              description="Wide-bobbin vintage single coil with dual bar magnets for raw, gritty mid-range bark."
              specs={
                <>
                  <span className="text-amber-700 dark:text-amber-400 font-bold">8.2 kΩ</span>
                  <span>•</span>
                  <span>6.2 H</span>
                  <span>•</span>
                  <span>Braided Shield</span>
                </>
              }
              onClick={() =>
                addComp(
                  'pickup-p90',
                  {
                    dcResistanceK: 8.2,
                    inductanceH: 6.2,
                    pickupPosition: 'bridge',
                  },
                  'P-90 Soapbar'
                )
              }
            />

            <LibraryItemCard
              title="Tele Neck (Shielded)"
              description="Warm vintage Tele neck pickup with separate chrome cover ground wire for 4-way series mods."
              specs={
                <>
                  <span className="text-amber-700 dark:text-amber-400 font-bold">7.2 kΩ</span>
                  <span>•</span>
                  <span>3 Wires</span>
                </>
              }
              onClick={() =>
                addComp(
                  'pickup-tele-neck',
                  {
                    dcResistanceK: 7.2,
                    inductanceH: 2.5,
                    pickupPosition: 'neck',
                  },
                  'Tele Neck (3-Wire Isolated)'
                )
              }
            />

            <LibraryItemCard
              title="Tele Bridge Pickup"
              description="High-output steel-pole pickup with copper-plated baseplate for unmistakable Telecaster twang."
              specs={
                <>
                  <span className="text-amber-700 dark:text-amber-400 font-bold">7.6 kΩ</span>
                  <span>•</span>
                  <span>3.4 H</span>
                </>
              }
              onClick={() =>
                addComp(
                  'pickup-tele-bridge',
                  {
                    dcResistanceK: 7.6,
                    inductanceH: 3.4,
                    pickupPosition: 'bridge',
                  },
                  'Tele Bridge Pickup'
                )
              }
            />
          </>
        )}

        {activeTab === 'pots' && (
          <>
            <LibraryItemCard
              title="CTS 250k Audio Pot"
              description="Standard volume/tone potentiometer for Stratocasters & Telecasters."
              specs={
                <>
                  <span className="text-amber-700 dark:text-amber-400 font-bold">250 kΩ</span>
                  <span>•</span>
                  <span>Log Taper</span>
                </>
              }
              onClick={() =>
                addComp('pot-standard', { resistanceK: 250, taper: 'audio' }, 'CTS 250k Audio Pot')
              }
            />

            <LibraryItemCard
              title="CTS 500k Audio Pot"
              description="Standard Gibson & humbucker volume/tone potentiometer. Retains bright top end."
              specs={
                <>
                  <span className="text-amber-700 dark:text-amber-400 font-bold">500 kΩ</span>
                  <span>•</span>
                  <span>Log Taper</span>
                </>
              }
              onClick={() =>
                addComp('pot-standard', { resistanceK: 500, taper: 'audio' }, 'CTS 500k Audio Pot')
              }
            />

            <LibraryItemCard
              title="Push-Pull 500k DPDT"
              badge={{
                text: 'DPDT',
                colorClass:
                  'bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30',
              }}
              description="Potentiometer with integrated 6-lug DPDT pull-switch for coil-splitting, phase inversion, or series mod."
              specs={
                <>
                  <span className="text-amber-700 dark:text-amber-400 font-bold">500 kΩ</span>
                  <span>•</span>
                  <span className="text-blue-700 dark:text-blue-400 font-semibold">DPDT Switch</span>
                </>
              }
              onClick={() =>
                addComp('pot-pushpull', { resistanceK: 500, taper: 'audio', pulledUp: false }, 'Push-Pull 500k DPDT')
              }
            />

            <LibraryItemCard
              title="Stacked Concentric Pot"
              badge={{
                text: 'CONCENTRIC',
                colorClass:
                  'bg-cyan-100 text-cyan-800 border border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30',
              }}
              description="Dual concentric knobs (inner shaft + outer ring) for independent volume and tone in a single hole."
              specs={<span className="text-cyan-700 dark:text-cyan-400 font-bold">Dual 500k / 500k</span>}
              onClick={() =>
                addComp(
                  'pot-stacked',
                  { innerResistanceK: 500, outerResistanceK: 500, innerValue: 1.0, outerValue: 1.0 },
                  'Stacked Concentric Pot'
                )
              }
            />

            <LibraryItemCard
              title="Blend / Balance Pot"
              description="Center-detent M/N taper pot. Smooth panning between neck and bridge without center volume drop."
              specs={<span className="text-amber-700 dark:text-amber-400 font-bold">250 kΩ M/N</span>}
              onClick={() =>
                addComp('pot-blend', { resistanceK: 250, blendValue: 0.5 }, 'Blend / Balance Pot')
              }
            />
          </>
        )}

        {activeTab === 'switches' && (
          <>
            <LibraryItemCard
              title="5-Way Blade Switch"
              description="Classic 8-lug Oak Grigsby / CRL Stratocaster 2-pole selector switch."
              specs={
                <>
                  <span>8 Lugs</span>
                  <span>•</span>
                  <span>2 Poles</span>
                </>
              }
              onClick={() =>
                addComp('switch-5way-blade', { switchPosition: 0, numPositions: 5 }, '5-Way Blade Switch')
              }
            />

            <LibraryItemCard
              title="3-Way Toggle (LP)"
              description="Switchcraft straight leaf toggle switch for 2 pickups (Bridge, Both, Neck)."
              specs={<span>Gibson Style</span>}
              onClick={() =>
                addComp('switch-3way-toggle', { switchPosition: 1 }, '3-Way Toggle Switch')
              }
            />

            <LibraryItemCard
              title="4-Way Tele Mod Switch"
              badge={{
                text: 'SERIES MOD',
                colorClass:
                  'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30',
              }}
              description="Mod switch for Telecaster: Bridge, Parallel, Neck, and Neck+Bridge in SERIES."
              specs={<span className="text-amber-700 dark:text-amber-300 font-bold">Series Boost Position</span>}
              onClick={() =>
                addComp('switch-4way-blade', { switchPosition: 0 }, '4-Way Mod Switch')
              }
            />

            <LibraryItemCard
              title="3-Way Blade (Tele)"
              description="Standard Telecaster selector blade switch."
              specs={<span>Tele Traditional</span>}
              onClick={() =>
                addComp('switch-3way-blade', { switchPosition: 0 }, '3-Way Blade Switch')
              }
            />

            <LibraryItemCard
              title="Super Switch (4P5T)"
              badge={{
                text: '24-LUG',
                colorClass:
                  'bg-cyan-100 text-cyan-800 border border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30',
              }}
              description="4 completely independent isolated poles with 5 throws (24 lugs) for auto-coil splitting."
              specs={<span className="text-cyan-700 dark:text-cyan-300 font-bold">24 Terminals</span>}
              onClick={() =>
                addComp('switch-superswitch', { switchPosition: 0 }, 'Super Switch 24-Lug')
              }
            />

            <LibraryItemCard
              title="Mini Toggle DPDT"
              description="Sub-miniature panel toggle for on-board custom switches."
              specs={<span>Miniature DPDT</span>}
              onClick={() =>
                addComp('switch-dpdt-minitoggle', { switchPosition: 0 }, 'Mini Toggle DPDT')
              }
            />
          </>
        )}

        {activeTab === 'passives' && (
          <>
            <LibraryItemCard
              title="0.022µF Tone Cap"
              description="Classic Gibson/Humbucker capacitor value. Smooth treble roll-off without muddiness."
              specs={
                <>
                  <span className="text-amber-700 dark:text-amber-300 font-bold">0.022 µF</span>
                  <span>•</span>
                  <span>Orange Drop</span>
                </>
              }
              onClick={() =>
                addComp('capacitor', { capacitanceUf: 0.022, capType: 'orange-drop' }, '0.022µF Orange Drop')
              }
            />

            <LibraryItemCard
              title="0.047µF Tone Cap"
              description="Traditional Fender vintage single coil value. Deeper warm treble roll-off."
              specs={<span className="text-amber-700 dark:text-amber-300 font-bold">0.047 µF</span>}
              onClick={() =>
                addComp('capacitor', { capacitanceUf: 0.047, capType: 'orange-drop' }, '0.047µF Tone Cap')
              }
            />

            <LibraryItemCard
              title="1000pF Bleed Cap"
              description="High-frequency bypass capacitor for volume pots to retain chime when turned down."
              specs={<span className="text-blue-700 dark:text-blue-300 font-bold">1 nF (1000 pF)</span>}
              onClick={() =>
                addComp('capacitor', { capacitanceUf: 0.001, capType: 'ceramic-disc' }, '1000pF Treble Bleed Cap')
              }
            />

            <LibraryItemCard
              title="150kΩ Resistor"
              description="Kinman-style treble bleed resistor paired in parallel or series with 1000pF cap."
              specs={<span className="text-emerald-700 dark:text-emerald-300 font-bold">150 kΩ</span>}
              onClick={() =>
                addComp('resistor', { resistanceOhms: 150000 }, '150kΩ Resistor')
              }
            />
          </>
        )}

        {activeTab === 'hardware' && (
          <>
            <LibraryItemCard
              title="1/4&quot; Mono Jack"
              description="Switchcraft style 1/4&quot; TS guitar output jack with Tip (Hot) and Sleeve (Ground) terminals."
              specs={<span>Chassis Mount</span>}
              onClick={() =>
                addComp('output-jack', { jackType: 'mono' }, '1/4" Mono Output Jack')
              }
            />

            <LibraryItemCard
              title="Star Ground Lug"
              description="Star ground washer and guitar bridge/tremolo spring claw wire grounding post."
              specs={<span>Chassis Star Ground</span>}
              onClick={() =>
                addComp('ground-lug', {}, 'Star Ground / Bridge Ground')
              }
            />
          </>
        )}
      </div>

      {/* Helpful info footer */}
      <div className="p-3 border-t border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 text-[10px] font-mono text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
        <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>Click any part to drop it onto your cavity board. Drag to arrange.</span>
      </div>
    </aside>
  );
};
