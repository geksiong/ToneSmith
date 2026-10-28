import React, { useState, useMemo } from 'react';
import { ComponentType, CircuitComponent } from '../types/guitar';
import { COMPONENT_METADATA } from '../lib/componentDefs';
import {
  Plus,
  Disc,
  Sliders,
  ToggleLeft,
  Cpu,
  Radio,
  Search,
  X,
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

interface ComponentItemDef {
  id: string;
  category: 'pickups' | 'pots' | 'switches' | 'passives' | 'hardware';
  type: ComponentType;
  title: string;
  specs: string;
  description: string;
  customProps: Partial<CircuitComponent['properties']>;
  searchKeywords: string;
}

const ALL_COMPONENTS: ComponentItemDef[] = [
  // --- PICKUPS ---
  {
    id: 'humbucker-4wire',
    category: 'pickups',
    type: 'pickup-humbucker',
    title: '4-Conductor Humbucker',
    specs: '8.4 kΩ · 4.2 H · 4-Wire · Flip Magnet',
    description: 'Dual-coil hum-cancelling pickup with individual leads for coil-splitting and phase reverse.',
    customProps: {
      dcResistanceK: 8.4,
      inductanceH: 4.2,
      pickupPosition: 'bridge',
      magnetType: 'Alnico II',
    },
    searchKeywords: 'humbucker paf gibson bridge neck dual coil 4 wire coil split out of phase',
  },
  {
    id: 'strat-singlecoil-neck',
    category: 'pickups',
    type: 'pickup-singlecoil',
    title: 'Strat Single Coil (Neck)',
    specs: '6.0 kΩ · 2.6 H · North Polarity',
    description: 'Traditional vintage bell chime with staggered Alnico V polepieces.',
    customProps: {
      dcResistanceK: 6.0,
      inductanceH: 2.6,
      pickupPosition: 'neck',
      rwrp: false,
    },
    searchKeywords: 'strat stratocaster single coil neck vintage chime alnico',
  },
  {
    id: 'strat-singlecoil-rwrp',
    category: 'pickups',
    type: 'pickup-singlecoil',
    title: 'Strat Middle (RWRP)',
    specs: '6.2 kΩ · 2.8 H · South Polarity · Hum-Cancelling',
    description: 'Reverse-wound reverse-polarity middle pickup for hum-cancellation in positions 2 & 4.',
    customProps: {
      dcResistanceK: 6.2,
      inductanceH: 2.8,
      pickupPosition: 'middle',
      rwrp: true,
    },
    searchKeywords: 'strat rwrp middle hum cancelling reverse wound reverse polarity',
  },
  {
    id: 'p90-soapbar',
    category: 'pickups',
    type: 'pickup-p90',
    title: 'P-90 Soapbar',
    specs: '8.2 kΩ · 6.2 H · Braided Shield',
    description: 'Wide-bobbin vintage single coil with twin bar magnets for gritty, raw midrange punch.',
    customProps: {
      dcResistanceK: 8.2,
      inductanceH: 6.2,
      pickupPosition: 'bridge',
    },
    searchKeywords: 'p90 p-90 soapbar gibson single coil raw grit midrange',
  },
  {
    id: 'tele-neck-isolated',
    category: 'pickups',
    type: 'pickup-tele-neck',
    title: 'Tele Neck (3-Wire)',
    specs: '7.2 kΩ · 2.5 H · Isolated Chrome Cover',
    description: 'Warm vintage Tele neck pickup with separate cover ground for 4-way series mods.',
    customProps: {
      dcResistanceK: 7.2,
      inductanceH: 2.5,
      pickupPosition: 'neck',
    },
    searchKeywords: 'tele telecaster neck chrome cover 3-wire 4-way mod series',
  },
  {
    id: 'tele-bridge',
    category: 'pickups',
    type: 'pickup-tele-bridge',
    title: 'Tele Bridge Pickup',
    specs: '7.6 kΩ · 3.4 H · Copper Baseplate',
    description: 'High-output steel pole pickup with copper baseplate for unmistakable Telecaster twang.',
    customProps: {
      dcResistanceK: 7.6,
      inductanceH: 3.4,
      pickupPosition: 'bridge',
    },
    searchKeywords: 'tele telecaster bridge copper baseplate twang lead',
  },

  // --- POTENTIOMETERS ---
  {
    id: 'pot-250k-audio',
    category: 'pots',
    type: 'pot-standard',
    title: 'CTS 250k Audio Pot',
    specs: '250 kΩ · Log Audio Taper',
    description: 'Standard volume and tone potentiometer for Stratocasters and Telecasters.',
    customProps: { resistanceK: 250, taper: 'audio', currentValue: 1.0 },
    searchKeywords: 'pot potentiometer cts 250k 250 volume tone audio log fender',
  },
  {
    id: 'pot-500k-audio',
    category: 'pots',
    type: 'pot-standard',
    title: 'CTS 500k Audio Pot',
    specs: '500 kΩ · Log Audio Taper',
    description: 'Standard Gibson and humbucker potentiometer. Preserves crisp treble.',
    customProps: { resistanceK: 500, taper: 'audio', currentValue: 1.0 },
    searchKeywords: 'pot potentiometer cts 500k 500 volume tone audio gibson humbucker',
  },
  {
    id: 'pot-pushpull-500k',
    category: 'pots',
    type: 'pot-pushpull',
    title: 'Push-Pull 500k DPDT',
    specs: '500 kΩ · Integrated 6-Lug DPDT Switch',
    description: 'Standard pot with integrated 2-position pull-switch for coil splitting or phase.',
    customProps: { resistanceK: 500, taper: 'audio', pulledUp: false, currentValue: 1.0 },
    searchKeywords: 'push pull push-pull dpdt switch coil split phase 500k jimmy page',
  },
  {
    id: 'pot-stacked-concentric',
    category: 'pots',
    type: 'pot-stacked',
    title: 'Stacked Concentric Pot',
    specs: 'Dual 500k / 500k · Independent Shafts',
    description: 'Dual concentric knobs for independent volume and tone in a single mounting hole.',
    customProps: { innerResistanceK: 500, outerResistanceK: 500, innerValue: 1.0, outerValue: 1.0 },
    searchKeywords: 'stacked concentric dual pot tandem jazz bass 62 vol tone',
  },
  {
    id: 'pot-blend-250k',
    category: 'pots',
    type: 'pot-blend',
    title: 'Blend / Balance Pot',
    specs: '250 kΩ · Center Detent M/N Taper',
    description: 'Smooth panning between two pickups without center-position volume drop.',
    customProps: { resistanceK: 250, blendValue: 0.5 },
    searchKeywords: 'blend balance pan center detent bass broadcaster tele',
  },

  // --- SWITCHES ---
  {
    id: 'sw-5way-blade',
    category: 'switches',
    type: 'switch-5way-blade',
    title: '5-Way Blade Switch',
    specs: '8 Terminals · 2 Poles · CRL / Oak Style',
    description: 'Classic 8-lug Stratocaster selector blade switch for Bridge, Bridge+Mid, Mid, Mid+Neck, Neck.',
    customProps: { switchPosition: 0, numPositions: 5 },
    searchKeywords: 'switch 5way 5-way blade oak grigsby crl stratocaster strat selector',
  },
  {
    id: 'sw-3way-toggle',
    category: 'switches',
    type: 'switch-3way-toggle',
    title: '3-Way Toggle (LP)',
    specs: 'Straight Leaf · Switchcraft Style',
    description: 'Traditional Gibson leaf toggle for Bridge, Both, and Neck pickup combinations.',
    customProps: { switchPosition: 1 },
    searchKeywords: 'switch toggle 3way 3-way les paul gibson leaf switchcraft',
  },
  {
    id: 'sw-4way-tele',
    category: 'switches',
    type: 'switch-4way-blade',
    title: '4-Way Tele Mod Switch',
    specs: 'Oak Style · Includes Series Boost Position',
    description: 'Mod blade switch providing Bridge, Parallel, Neck, and Neck+Bridge in SERIES.',
    customProps: { switchPosition: 0 },
    searchKeywords: 'switch 4way 4-way blade tele telecaster series mod modding',
  },
  {
    id: 'sw-3way-blade',
    category: 'switches',
    type: 'switch-3way-blade',
    title: '3-Way Blade (Tele)',
    specs: '8 Lugs · Standard Telecaster',
    description: 'Standard Telecaster 3-position blade switch for traditional wiring setups.',
    customProps: { switchPosition: 0 },
    searchKeywords: 'switch 3way 3-way blade tele telecaster traditional',
  },
  {
    id: 'sw-superswitch-24',
    category: 'switches',
    type: 'switch-superswitch',
    title: 'Super Switch (4P5T)',
    specs: '24 Terminals · 4 Independent Poles',
    description: '4 isolated wafers with 5 throws each, unlocking complex auto-split humbucker circuits.',
    customProps: { switchPosition: 0 },
    searchKeywords: 'superswitch super switch 24 lug 4p5t multi pole ibanez auto split',
  },
  {
    id: 'sw-dpdt-minitoggle',
    category: 'switches',
    type: 'switch-dpdt-minitoggle',
    title: 'Mini Toggle DPDT',
    specs: '6 Lugs · On-On / Panel Mount',
    description: 'Sub-miniature switch for dedicated series/parallel, coil-tap, or phase reversal.',
    customProps: { switchPosition: 0 },
    searchKeywords: 'mini toggle dpdt on on coil split phase killswitch',
  },

  // --- PASSIVES (CAPS & RESISTORS) ---
  {
    id: 'cap-orange-022',
    category: 'passives',
    type: 'capacitor',
    title: '0.022µF Tone Capacitor',
    specs: '0.022 µF (22 nF) · Orange Drop Polyester',
    description: 'Standard Gibson and humbucker tone cap. Clean, musical high-frequency roll-off.',
    customProps: { capacitanceUf: 0.022, capType: 'orange-drop' },
    searchKeywords: 'capacitor cap orange drop 0.022 0.022uf 22nf humbucker gibson tone',
  },
  {
    id: 'cap-fender-047',
    category: 'passives',
    type: 'capacitor',
    title: '0.047µF Tone Capacitor',
    specs: '0.047 µF (47 nF) · Vintage Single Coil',
    description: 'Traditional Fender single-coil capacitor. Creates a warm, darker roll-off curve.',
    customProps: { capacitanceUf: 0.047, capType: 'orange-drop' },
    searchKeywords: 'capacitor cap 0.047 0.047uf 47nf fender strat tele single coil',
  },
  {
    id: 'cap-bleed-1000pf',
    category: 'passives',
    type: 'capacitor',
    title: '1000pF Treble Bleed Cap',
    specs: '1 nF (1000 pF) · Ceramic Disc',
    description: 'High-pass bypass capacitor across volume pot lugs to maintain sparkle when volume drops.',
    customProps: { capacitanceUf: 0.001, capType: 'ceramic-disc' },
    searchKeywords: 'capacitor treble bleed 1000pf 1nf bypass ceramic volume chime',
  },
  {
    id: 'res-bleed-150k',
    category: 'passives',
    type: 'resistor',
    title: '150kΩ Bleed Resistor',
    specs: '150 kΩ · Metal Film · Kinman Mod',
    description: 'Tames treble bleed volume taper when wired with a 1000pF cap.',
    customProps: { resistanceOhms: 150000 },
    searchKeywords: 'resistor 150k 150kohm treble bleed kinman taper',
  },

  // --- HARDWARE ---
  {
    id: 'jack-mono-ts',
    category: 'hardware',
    type: 'output-jack',
    title: '1/4" Mono Output Jack',
    specs: 'Tip (Hot) & Sleeve (Ground) · Switchcraft',
    description: 'Heavy-duty 1/4" phone jack delivering the final guitar signal to your guitar cable and amp.',
    customProps: { jackType: 'mono' },
    searchKeywords: 'jack output jack 1/4 mono ts tip sleeve ground switchcraft socket',
  },
  {
    id: 'ground-star-lug',
    category: 'hardware',
    type: 'ground-lug',
    title: 'Star Ground / Bridge Lug',
    specs: 'Chassis & Bridge Ground Post',
    description: 'Central star ground washer and bridge/tremolo claw grounding connection to eliminate hum.',
    customProps: {},
    searchKeywords: 'ground lug star ground bridge claw tremolo hum shield chassis',
  },
];

export const ComponentLibrary: React.FC<ComponentLibraryProps> = ({
  onAddComponent,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [activeCategory, setActiveCategory] = useState<'pickups' | 'pots' | 'switches' | 'passives' | 'hardware'>('pickups');
  const [searchQuery, setSearchQuery] = useState('');

  const addComp = (item: ComponentItemDef) => {
    const meta = COMPONENT_METADATA[item.type];
    const id = `${item.type}-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 3)}`;
    const newComponent: CircuitComponent = {
      id,
      type: item.type,
      name: item.title || meta.name,
      x: 180 + Math.round(Math.random() * 80),
      y: 120 + Math.round(Math.random() * 80),
      properties: {
        currentValue: 1.0,
        ...item.customProps,
      },
    };
    onAddComponent(newComponent);
  };

  const categories = [
    { id: 'pickups', label: 'Pickups', icon: Disc },
    { id: 'pots', label: 'Pots', icon: Sliders },
    { id: 'switches', label: 'Switches', icon: ToggleLeft },
    { id: 'passives', label: 'Caps & Res', icon: Cpu },
    { id: 'hardware', label: 'Hardware', icon: Radio },
  ];

  // Filter components based on search query or active category
  const displayedComponents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return ALL_COMPONENTS.filter((c) => c.category === activeCategory);
    }
    return ALL_COMPONENTS.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.specs.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query) ||
        c.searchKeywords.toLowerCase().includes(query)
    );
  }, [searchQuery, activeCategory]);

  if (isCollapsed) {
    return (
      <aside className="w-12 h-full border-r border-stone-200 dark:border-stone-800/80 bg-white/95 dark:bg-[#151210]/95 backdrop-blur flex flex-col items-center py-3 z-20 shrink-0 select-none transition-all">
        {/* Expand button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Expand Component Palette"
          className="p-2 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-800/80 dark:hover:bg-stone-700 text-amber-600 dark:text-amber-400 transition-colors shadow-xs"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>

        <div className="w-5 h-[1px] bg-stone-200 dark:border-stone-800 my-3" />

        {/* Category icons rail */}
        <div className="flex flex-col gap-2">
          {categories.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveCategory(tab.id as any);
                  setSearchQuery('');
                  if (onToggleCollapse) onToggleCollapse();
                }}
                title={tab.label}
                className={`p-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>

        {/* Vertical Text */}
        <div className="mt-auto py-3">
          <span
            className="text-[10px] font-mono text-stone-400 tracking-widest uppercase cursor-pointer hover:text-stone-700 dark:hover:text-stone-300"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            onClick={onToggleCollapse}
          >
            PARTS
          </span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-72 h-full border-r border-stone-200 dark:border-stone-800/80 bg-white/95 dark:bg-[#161311]/95 backdrop-blur flex flex-col z-20 shrink-0 select-none transition-all">
      {/* Palette Header with Live Search */}
      <div className="p-3 border-b border-stone-200 dark:border-stone-800/80 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold tracking-wider text-stone-900 dark:text-stone-100 uppercase">
            Parts Library
          </span>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Collapse Panel"
              className="p-1 rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pickups, pots, caps..."
            className="w-full pl-8 pr-7 py-1.5 bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg text-xs font-sans text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:border-amber-500/60 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Category Segmented Bar (hidden when searching) */}
      {!searchQuery && (
        <div className="p-1.5 border-b border-stone-200 dark:border-stone-800/80 flex gap-0.5 bg-stone-50 dark:bg-stone-950/40 overflow-x-auto">
          {categories.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded-md text-[11px] font-mono transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-stone-800 text-stone-950 dark:text-white font-bold shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
                title={tab.label}
              >
                <Icon className="w-3 h-3 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Components List */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
        {displayedComponents.length === 0 ? (
          <div className="p-6 text-center text-xs text-stone-400 font-mono">
            No matching guitar components found for "{searchQuery}".
          </div>
        ) : (
          displayedComponents.map((item) => (
            <div
              key={item.id}
              onClick={() => addComp(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  addComp(item);
                }
              }}
              className="p-2.5 rounded-lg border border-stone-200/80 dark:border-stone-800/60 bg-white/60 dark:bg-stone-900/40 hover:bg-amber-500/5 hover:border-amber-500/40 dark:hover:bg-stone-800/60 transition-all cursor-pointer group flex flex-col gap-1 text-left"
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-xs font-mono font-bold text-stone-900 dark:text-stone-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 truncate">
                  {item.title}
                </span>
                <span className="p-1 rounded bg-stone-100 dark:bg-stone-800 group-hover:bg-amber-500 group-hover:text-stone-950 text-stone-600 dark:text-stone-400 transition-colors shrink-0">
                  <Plus className="w-3 h-3" />
                </span>
              </div>

              {/* Unboxed specs metadata with middle dot separator */}
              <div className="text-[10px] font-mono text-stone-500 dark:text-stone-400 truncate">
                {item.specs}
              </div>

              {/* Brief description */}
              <p className="text-[11px] text-stone-600 dark:text-stone-400 font-sans line-clamp-1 leading-snug">
                {item.description}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Clean quiet footer notice */}
      <div className="px-3 py-2 border-t border-stone-200 dark:border-stone-800/80 text-[10px] font-mono text-stone-400 flex items-center gap-1.5">
        <Info className="w-3 h-3 text-amber-500 shrink-0" />
        <span className="truncate">Click any component to place on cavity board</span>
      </div>
    </aside>
  );
};
