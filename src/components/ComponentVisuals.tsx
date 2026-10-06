import React from 'react';
import { CircuitComponent, Terminal } from '../types/guitar';
import { COMPONENT_METADATA } from '../lib/componentDefs';

interface ComponentVisualProps {
  component: CircuitComponent;
  terminals: Terminal[];
  isSelected: boolean;
  activeTerminalId: string | null;
  onTerminalMouseDown: (terminal: Terminal, e: React.MouseEvent) => void;
  onPropertyChange: (properties: Partial<CircuitComponent['properties']>) => void;
  isInteractiveMode?: boolean;
  hideTerminals?: boolean;
  showSignalPath?: boolean;
  activeCoils?: { north: boolean; south: boolean };
  isSignalActive?: boolean;
}

export const ComponentVisual: React.FC<ComponentVisualProps> = ({
  component,
  terminals,
  isSelected,
  activeTerminalId,
  onTerminalMouseDown,
  onPropertyChange,
  isInteractiveMode = false,
  hideTerminals = false,
  showSignalPath = false,
  activeCoils,
  isSignalActive = true,
}) => {
  const meta = COMPONENT_METADATA[component.type];
  if (!meta) return null;

  const { type, properties } = component;

  return (
    <div
      className={`relative select-none transition-shadow rounded-lg group ${
        isSelected && !isInteractiveMode ? 'ring-2 ring-amber-500 shadow-xl shadow-amber-500/20' : ''
      }`}
      style={{
        width: meta.defaultWidth,
        height: meta.defaultHeight,
      }}
    >
      {/* Component Visual SVG or HTML Canvas */}
      {renderVisualBody(component, onPropertyChange, isInteractiveMode, showSignalPath, activeCoils)}

      {/* Connection Terminals / Lugs (Disabled / hidden in interactive play mode or when rendered on top layer) */}
      {!isInteractiveMode && !hideTerminals &&
        terminals.map((term) => {
          const isActive = activeTerminalId === term.id;
          return (
            <div
              key={term.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-crosshair group/term"
              style={{ left: term.x, top: term.y }}
              onMouseDown={(e) => {
                e.stopPropagation();
                onTerminalMouseDown(term, e);
              }}
              title={`${term.label} (${term.type})`}
            >
              {/* Terminal Lug Ring */}
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-amber-400 border-white scale-125 shadow-lg shadow-amber-400/50'
                    : term.type === 'ground'
                    ? 'bg-zinc-800 border-zinc-400 hover:border-emerald-400 hover:scale-110'
                    : term.type === 'switch-common'
                    ? 'bg-amber-900 border-amber-400 hover:scale-110'
                    : 'bg-zinc-900 border-amber-300/80 hover:border-white hover:scale-110'
                }`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    term.type === 'ground' ? 'bg-zinc-400' : 'bg-amber-300'
                  }`}
                />
              </div>

              {/* Hover Tooltip */}
              <div className="absolute left-1/2 bottom-full -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-zinc-900/95 border border-zinc-700 rounded text-[9px] font-mono text-zinc-300 pointer-events-none whitespace-nowrap opacity-0 group-hover/term:opacity-100 transition-opacity z-30 shadow-md">
                {term.label}
              </div>
            </div>
          );
        })}

      {/* Component Name & Signal Status: Positioned BELOW and OUTSIDE of the component for all components */}
      <div
        className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none z-20 w-max"
        style={{ maxWidth: '160px', minWidth: '80px' }}
      >
        <span
          className={`text-[10.5px] font-mono px-2 py-0.5 rounded w-full text-center tracking-tight whitespace-normal break-words leading-tight transition-colors select-none ${
            isSelected
              ? 'text-amber-700 bg-amber-100 font-bold dark:text-amber-300 dark:bg-amber-500/20'
              : 'text-zinc-800 bg-white dark:text-zinc-200 dark:bg-zinc-900/80'
          }`}
          title={component.name}
        >
          {component.name}
        </span>
        {showSignalPath && isSignalActive && (
          <div className="px-2 py-0.5 rounded-full bg-emerald-500/95 text-zinc-950 font-mono text-[7.5px] font-black tracking-wider uppercase shadow-md shadow-emerald-500/30 flex items-center justify-center gap-1 text-center whitespace-normal leading-tight animate-in fade-in max-w-[160px]">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />
            <span>
              {component.type === 'pickup-humbucker' && activeCoils
                ? activeCoils.north && activeCoils.south
                  ? 'Dual Coils Active'
                  : activeCoils.north
                  ? 'North Coil Split Active'
                  : activeCoils.south
                  ? 'South Coil Split Active'
                  : 'Signal Active'
                : 'Signal Active'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

function SolderLugTab({ x, y, title }: { x: number; y: number; title?: string }) {
  return (
    <div
      style={{ left: `${x}px`, top: `${y}px` }}
      className="absolute -translate-x-1/2 -translate-y-1/2 w-[14px] h-[20px] rounded-b-sm bg-gradient-to-b from-slate-200 via-slate-300 to-slate-300 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-700 border-b border-x border-slate-400 dark:border-zinc-600 flex items-center justify-center shadow-xs pointer-events-none z-0"
      title={title}
    >
      <div className="w-2 h-2.5 rounded-full border border-slate-400 dark:border-zinc-600 bg-slate-100 dark:bg-zinc-950" />
    </div>
  );
}

function renderVisualBody(
  comp: CircuitComponent,
  onPropertyChange: (properties: Partial<CircuitComponent['properties']>) => void,
  isInteractiveMode: boolean,
  showSignalPath: boolean = false,
  activeCoils?: { north: boolean; south: boolean }
) {
  const { type, properties } = comp;

  switch (type) {
    case 'pickup-humbucker': {
      const isFlipped = !!properties.magnetFlipped;
      const isNorthActive = showSignalPath ? (activeCoils?.north ?? false) : false;
      const isSouthActive = showSignalPath ? (activeCoils?.south ?? false) : false;
      const hasAnyActive = isNorthActive || isSouthActive;
      const isSplitActive = hasAnyActive && (!isNorthActive || !isSouthActive);

      return (
        <div
          className={`w-full h-full bg-zinc-900 border rounded-lg flex shadow-lg relative overflow-hidden transition-all duration-300 dark:bg-gradient-to-b dark:from-zinc-800 dark:to-zinc-900 ${
            showSignalPath && hasAnyActive
              ? 'border-emerald-500/80 shadow-emerald-500/20 ring-1 ring-emerald-500/40'
              : 'border-zinc-700/80'
          }`}
        >
          {/* Main Pickup Body (Left Section) */}
          <div className="flex-1 p-2 pr-1 flex flex-col justify-between overflow-hidden">
            {/* Top Status & Spec Bar */}
            <div className="flex items-center justify-between text-[8px] font-mono text-zinc-400 px-1">
              <span className="text-zinc-500 uppercase tracking-wider font-semibold">PAF HUMBUCKER</span>
              <div className="flex items-center gap-1.5">
                <span>{properties.dcResistanceK ?? 8.4}kΩ</span>
                {showSignalPath && hasAnyActive ? (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[7px] font-mono font-black uppercase tracking-wider border shadow-xs animate-in fade-in ${
                      isSplitActive
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                    }`}
                  >
                    {isSplitActive ? 'SPLIT' : 'DUAL'}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Dual Bobbins Visual */}
            <div className="flex flex-col gap-1 my-0.5">
              {/* North Slug Bobbin */}
              <div
                className={`h-5.5 rounded flex items-center justify-between px-2 transition-all duration-300 border ${
                  showSignalPath && isNorthActive
                    ? 'bg-emerald-950/80 border-emerald-400 ring-1 ring-emerald-400/70 shadow-[0_0_12px_rgba(16,185,129,0.45)]'
                    : showSignalPath && hasAnyActive && !isNorthActive
                    ? 'opacity-30 bg-zinc-950 border-zinc-800/80 grayscale filter'
                    : 'bg-zinc-950 border-zinc-800'
                }`}
                title={
                  showSignalPath
                    ? isNorthActive
                      ? 'North Slug Coil: ACTIVE'
                      : 'North Slug Coil: INACTIVE / CUT'
                    : 'North Slug Bobbin'
                }
              >
                <div className="flex items-center gap-1 min-w-[36px]">
                  {showSignalPath && isNorthActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#10b981]" />
                  )}
                  <span
                    className={`text-[7.5px] font-mono font-bold ${
                      showSignalPath && isNorthActive
                        ? 'text-emerald-300 font-extrabold tracking-wide'
                        : showSignalPath && hasAnyActive && !isNorthActive
                        ? 'text-zinc-500'
                        : 'text-blue-400'
                    }`}
                  >
                    {isFlipped ? 'SOUTH' : 'NORTH'}
                  </span>
                </div>

                {/* 6 Nickel Slug Polepieces */}
                <div className="flex items-center gap-1 mx-auto">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        showSignalPath && isNorthActive
                          ? 'bg-emerald-200 border border-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] ring-1 ring-emerald-300/60'
                          : showSignalPath && hasAnyActive && !isNorthActive
                          ? 'bg-zinc-700 border border-zinc-800 shadow-none'
                          : 'bg-zinc-400 border border-zinc-600 shadow-inner'
                      }`}
                    />
                  ))}
                </div>

                {/* Active Coil Indicator Badge */}
                <div className="min-w-[34px] flex justify-end">
                  {showSignalPath && (
                    isNorthActive ? (
                      <span className="text-[6.5px] font-mono font-extrabold px-1 py-0.5 rounded bg-emerald-500/30 text-emerald-300 border border-emerald-400/60 tracking-wider shadow-xs whitespace-nowrap">
                        ACTIVE
                      </span>
                    ) : hasAnyActive ? (
                      <span className="text-[6.5px] font-mono text-zinc-500 px-1 py-0.5 rounded bg-zinc-900 border border-zinc-800/80 whitespace-nowrap">
                        CUT
                      </span>
                    ) : null
                  )}
                </div>
              </div>

              {/* South Screw Bobbin */}
              <div
                className={`h-5.5 rounded flex items-center justify-between px-2 transition-all duration-300 border ${
                  showSignalPath && isSouthActive
                    ? 'bg-emerald-950/80 border-emerald-400 ring-1 ring-emerald-400/70 shadow-[0_0_12px_rgba(16,185,129,0.45)]'
                    : showSignalPath && hasAnyActive && !isSouthActive
                    ? 'opacity-30 bg-zinc-950 border-zinc-800/80 grayscale filter'
                    : 'bg-zinc-950 border-zinc-800'
                }`}
                title={
                  showSignalPath
                    ? isSouthActive
                      ? 'South Screw Coil: ACTIVE'
                      : 'South Screw Coil: INACTIVE / CUT'
                    : 'South Screw Bobbin'
                }
              >
                <div className="flex items-center gap-1 min-w-[36px]">
                  {showSignalPath && isSouthActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#10b981]" />
                  )}
                  <span
                    className={`text-[7.5px] font-mono font-bold ${
                      showSignalPath && isSouthActive
                        ? 'text-emerald-300 font-extrabold tracking-wide'
                        : showSignalPath && hasAnyActive && !isSouthActive
                        ? 'text-zinc-500'
                        : 'text-rose-400'
                    }`}
                  >
                    {isFlipped ? 'NORTH' : 'SOUTH'}
                  </span>
                </div>

                {/* 6 Slotted Screw Polepieces */}
                <div className="flex items-center gap-1 mx-auto">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full border flex items-center justify-center text-[6px] font-bold transition-all duration-300 ${
                        showSignalPath && isSouthActive
                          ? 'bg-emerald-100 border-emerald-400 text-emerald-950 font-black shadow-[0_0_6px_rgba(52,211,153,0.9)] ring-1 ring-emerald-300/60'
                          : showSignalPath && hasAnyActive && !isSouthActive
                          ? 'bg-zinc-700 border border-zinc-800 text-zinc-600'
                          : 'bg-zinc-300 border-zinc-500 text-zinc-800'
                      }`}
                    >
                      -
                    </div>
                  ))}
                </div>

                {/* Active Coil Indicator Badge */}
                <div className="min-w-[34px] flex justify-end">
                  {showSignalPath && (
                    isSouthActive ? (
                      <span className="text-[6.5px] font-mono font-extrabold px-1 py-0.5 rounded bg-emerald-500/30 text-emerald-300 border border-emerald-400/60 tracking-wider shadow-xs whitespace-nowrap">
                        ACTIVE
                      </span>
                    ) : hasAnyActive ? (
                      <span className="text-[6.5px] font-mono text-zinc-500 px-1 py-0.5 rounded bg-zinc-900 border border-zinc-800/80 whitespace-nowrap">
                        CUT
                      </span>
                    ) : null
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Flip Magnet Control Row */}
            <div className="flex items-center justify-between px-1 h-5 my-0.5">
              <span className="text-[7.5px] font-mono text-zinc-500 uppercase tracking-tight">MAGNET:</span>
              {isInteractiveMode ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPropertyChange({ magnetFlipped: !isFlipped });
                  }}
                  title="Flip bar magnet (Peter Green out-of-phase tone)"
                  className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold transition-all border cursor-pointer ${
                    isFlipped
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-sm shadow-amber-500/20'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  {isFlipped ? '⚡ FLIPPED' : 'NORMAL'}
                </button>
              ) : (
                <span
                  className={`px-1.5 py-0.5 rounded text-[7.5px] font-mono font-semibold border ${
                    isFlipped
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                      : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                  }`}
                >
                  {isFlipped ? 'FLIPPED' : 'NORMAL'}
                </span>
              )}
            </div>
          </div>

          {/* Right-Side 4-Conductor Cable Exit Bracket (Terminals at x: 190, y: 16, 35, 55, 74, 94) */}
          <div className="w-6 bg-zinc-950 border-l border-zinc-800 flex flex-col justify-between items-center py-2 relative">
            <div className="w-2.5 h-2.5 rounded-full border border-zinc-700/80 bg-zinc-900" />
            <div className="w-2.5 h-2.5 rounded-full border border-zinc-700/80 bg-zinc-900" />
            <div className="w-2.5 h-2.5 rounded-full border border-zinc-700/80 bg-zinc-900" />
            <div className="w-2.5 h-2.5 rounded-full border border-zinc-700/80 bg-zinc-900" />
            <div className="w-2.5 h-2.5 rounded-full border border-zinc-700/80 bg-zinc-900" />
          </div>
        </div>
      );
    }

    case 'pickup-singlecoil': {
      const isRwrp = !!properties.rwrp;
      return (
        <div className="w-full h-full bg-zinc-900 border border-zinc-700/80 rounded-full p-2 flex items-center justify-between shadow-lg dark:bg-gradient-to-r dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800 relative">
          {/* Main Bobbin Body */}
          <div className="flex-1 flex flex-col justify-between h-full pl-2 pr-1">
            <div className="flex items-center justify-between text-[8px] font-mono text-zinc-400">
              <span>{properties.pickupPosition?.toUpperCase() || 'STRAT SINGLE'}</span>
              <span>{properties.dcResistanceK ?? 6.0}kΩ</span>
            </div>
            {/* Staggered Polepieces */}
            <div className="flex items-center justify-around px-1">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="w-2.5 h-2.5 rounded-full bg-zinc-300 border border-zinc-500 shadow-inner"
                />
              ))}
            </div>
            {/* Polarity Control */}
            <div className="flex items-center justify-center">
              {isInteractiveMode ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPropertyChange({ rwrp: !isRwrp });
                  }}
                  className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold border transition-colors cursor-pointer max-w-[80px] truncate ${
                    isRwrp
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  {isRwrp ? '⚡ RWRP' : 'STD POL'}
                </button>
              ) : (
                isRwrp && (
                  <span className="px-1.5 py-0.2 text-[7.5px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded">
                    RWRP
                  </span>
                )
              )}
            </div>
          </div>

          {/* Right-Side Solder Eyelet Tab (Terminals at x: 152, y: 22 & 48) */}
          <div className="w-5 h-full flex flex-col justify-around items-center border-l border-zinc-800/80 bg-zinc-950/60 rounded-r-full pr-1">
            <div className="w-2.5 h-2.5 rounded-full border border-zinc-700 bg-zinc-900" />
            <div className="w-2.5 h-2.5 rounded-full border border-zinc-700 bg-zinc-900" />
          </div>
        </div>
      );
    }

    case 'pickup-p90': {
      return (
        <div className="w-full h-full bg-zinc-900 border border-zinc-600 rounded-md flex shadow-lg dark:bg-gradient-to-b dark:from-stone-900 dark:to-stone-950 overflow-hidden">
          {/* Main Soapbar Bobbin Body */}
          <div className="flex-1 p-2 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[8px] font-mono text-zinc-400 px-1">
              <span className="font-semibold text-zinc-300">P-90 SOAPBAR</span>
              <span>{properties.dcResistanceK ?? 8.2}kΩ • {properties.inductanceH ?? 6.2}H</span>
            </div>
            <div className="flex items-center justify-around my-1">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-full bg-zinc-400 border border-zinc-600 flex items-center justify-center text-[7px] text-zinc-800 font-bold"
                >
                  +
                </div>
              ))}
            </div>
          </div>

          {/* Right-Side Braided Lead Exit (Terminals at x: 160, y: 27 & 53) */}
          <div className="w-6 bg-zinc-950 border-l border-zinc-700 flex flex-col justify-around items-center py-3">
            <div className="w-2.5 h-2.5 rounded-full border border-zinc-600 bg-zinc-900" />
            <div className="w-2.5 h-2.5 rounded-full border border-zinc-600 bg-zinc-900" />
          </div>
        </div>
      );
    }

    case 'pickup-tele-neck': {
      return (
        <div className="w-full h-full bg-gradient-to-r from-zinc-300 via-zinc-100 to-zinc-300 border border-zinc-400 rounded-full flex shadow-lg text-zinc-900 overflow-hidden">
          <div className="flex-1 flex items-center justify-center p-2">
            <div className="font-bold text-[8.5px] font-mono tracking-wider text-zinc-800">
              CHROME COVER • {properties.dcResistanceK ?? 7.2}kΩ
            </div>
          </div>
          {/* Right-Side 3-Lead Exit Collar (Terminals at x: 142, y: 16, 32, 49) */}
          <div className="w-6 bg-zinc-800/90 border-l border-zinc-400 flex flex-col justify-around items-center py-1.5 rounded-r-full">
            <div className="w-2 h-2 rounded-full border border-zinc-500 bg-zinc-900" />
            <div className="w-2 h-2 rounded-full border border-zinc-500 bg-zinc-900" />
            <div className="w-2 h-2 rounded-full border border-zinc-500 bg-zinc-900" />
          </div>
        </div>
      );
    }

    case 'pickup-tele-bridge': {
      return (
        <div className="w-full h-full bg-zinc-900 border-2 border-amber-700/60 rounded-lg flex shadow-lg dark:bg-gradient-to-b dark:from-zinc-900 dark:to-zinc-950 overflow-hidden">
          <div className="flex-1 p-2 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[8px] font-mono text-zinc-400 px-1">
              <span className="text-amber-500/90 font-bold">TELE BRIDGE</span>
              <span>{properties.dcResistanceK ?? 7.4}kΩ • COPPER BASE</span>
            </div>
            <div className="flex items-center justify-around my-1 rotate-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="w-2.5 h-2.5 rounded-full bg-zinc-300 border border-zinc-500" />
              ))}
            </div>
          </div>
          {/* Right-Side Copper Baseplate Eyelet Flange (Terminals at x: 152, y: 28 & 62) */}
          <div className="w-6 bg-amber-950/60 border-l border-amber-700/50 flex flex-col justify-around items-center py-3">
            <div className="w-2.5 h-2.5 rounded-full border border-amber-600/80 bg-zinc-950" />
            <div className="w-2.5 h-2.5 rounded-full border border-amber-600/80 bg-zinc-950" />
          </div>
        </div>
      );
    }

    case 'pot-standard': {
      const val = properties.currentValue ?? 1.0;
      return (
        <div className="w-full h-full bg-zinc-900 border border-zinc-700/80 rounded-xl p-2 flex flex-col justify-between shadow-lg relative">
          {/* Vertical Solder Lug Tabs behind the 3 lugs below circle */}
          <SolderLugTab x={24} y={82} title="Lug 1 (CCW)" />
          <SolderLugTab x={57} y={90} title="Lug 2 (Wiper)" />
          <SolderLugTab x={91} y={82} title="Lug 3 (CW)" />

          {/* Top: 24mm CTS Potentiometer Metal Casing (The Iconic Decorative Circle) */}
          <div className="relative w-full flex items-center justify-center pt-0.5">
            {/* The 24mm Decorative Circle */}
            <div className="w-[68px] h-[68px] rounded-full bg-gradient-to-br from-slate-100 via-zinc-200 to-slate-300 dark:from-zinc-700 dark:via-zinc-800 dark:to-zinc-900 border-2 border-slate-300 dark:border-zinc-600 shadow-md flex flex-col items-center justify-center relative p-1">
              {/* Inner Concentric Stamped Rim */}
              <div className="w-[54px] h-[54px] rounded-full border border-slate-300/80 dark:border-zinc-700/80 flex flex-col items-center justify-center shadow-inner">
                {/* Brand & Resistance - High Contrast in Light and Dark Mode */}
                <span className="text-[8px] font-mono font-black tracking-wider text-slate-950 dark:text-zinc-100 leading-tight">
                  CTS {properties.resistanceK ?? 500}k
                </span>
                {/* Taper - High Contrast in Light and Dark Mode */}
                <span className="text-[6.5px] font-mono font-extrabold uppercase tracking-tight text-amber-800 dark:text-amber-400 mt-0.5 leading-tight">
                  {properties.taper ?? 'audio'} TAPER
                </span>
              </div>
            </div>

            {/* Right-edge chassis solder ground tab (Reaches the case-ground terminal dead center at x: 99, y: 40) */}
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-6 rounded-r bg-gradient-to-r from-slate-200 to-slate-300 dark:from-zinc-700 dark:via-zinc-800 dark:to-zinc-800 border-t border-r border-b border-slate-400 dark:border-zinc-600 flex items-center justify-center shadow-xs"
              title="Pot Body Ground"
            >
              <div className="w-2 h-3 rounded-full border border-slate-400 dark:border-zinc-600 bg-slate-100 dark:bg-zinc-950" />
            </div>
          </div>

          {/* Middle: Solder Lug Clearance Area below circle (Lug 1, 2, 3 sit cleanly below circle at y: 82-90) */}
          <div className="w-full h-5" />

          {/* Bottom: Controls (Rotary Knob Dial, Slider, and Readout) */}
          <div className="w-full pt-1 border-t border-zinc-800 flex flex-col items-center gap-1">
            {isInteractiveMode ? (
              <>
                <div className="flex items-center justify-between w-full px-1">
                  <div className="relative w-7 h-7 rounded-full bg-gradient-to-br from-zinc-300 to-zinc-400 dark:from-zinc-700 dark:to-zinc-900 border border-zinc-400 dark:border-zinc-500 flex items-center justify-center shadow-inner">
                    <div
                      className="absolute w-0.5 h-3 bg-amber-500 dark:bg-amber-400 top-0.5 rounded-full"
                      style={{
                        transform: `rotate(${(val - 0.5) * 270}deg)`,
                        transformOrigin: '50% 11px',
                      }}
                    />
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-800 dark:bg-zinc-950" />
                  </div>
                  <span className="text-[10px] font-mono font-extrabold text-amber-700 dark:text-amber-400">
                    {Math.round(val * 10)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={val}
                  onChange={(e) => onPropertyChange({ currentValue: parseFloat(e.target.value) })}
                  className="w-full min-w-0 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500 dark:accent-amber-400"
                />
              </>
            ) : (
              <div className="flex items-center justify-between w-full px-1 text-[8px] font-mono">
                <span className="text-zinc-600 dark:text-zinc-400 font-medium">SHAFT:</span>
                <span className="font-bold text-amber-700 dark:text-amber-400">{Math.round(val * 10)} / 10</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    case 'pot-pushpull': {
      const val = properties.currentValue ?? 1.0;
      const isPulled = !!properties.pulledUp;
      return (
        <div className="w-full h-full bg-zinc-900 border border-zinc-700/80 rounded-xl flex flex-col shadow-lg relative overflow-hidden">
          {/* Vertical Solder Lug Tabs behind the 3 pot lugs below circle */}
          <SolderLugTab x={26} y={148} title="Pot Lug 1" />
          <SolderLugTab x={62} y={156} title="Pot Wiper (Lug 2)" />
          <SolderLugTab x={99} y={148} title="Pot Lug 3" />

          {/* Top Section: DPDT Switch Matrix Housing (Box Containing 6 Connectors, y: 0 to 56) */}
          <div className="w-full h-[56px] px-2 pt-1 pb-0.5 shrink-0">
            <div
              className={`w-full h-full rounded-lg border transition-all flex flex-col justify-between p-1 relative ${
                isPulled
                  ? 'bg-blue-950/40 border-amber-500/50 shadow-inner'
                  : 'bg-blue-950/25 border-blue-900/40'
              }`}
            >
              {/* Inner DPDT Phenolic Board visual */}
              <div className="w-full h-full rounded bg-zinc-950/70 border border-blue-900/30 flex items-center justify-between px-6">
                {/* Visual contact rails behind columns without overlapping terminals */}
                <div className="w-0.5 h-full bg-blue-900/30 rounded" />
                <div className="w-0.5 h-full bg-blue-900/30 rounded" />
              </div>
            </div>
          </div>

          {/* Separation Gap Divider Neck (Physical separation between DPDT switch box and pot body) */}
          <div className="w-full h-4 flex items-center justify-center shrink-0">
            <div className="w-12 h-1 bg-zinc-800/80 rounded-full" />
          </div>

          {/* Middle Section: Large Label/Taper Casing and 3 Pot Lugs Below (y: 72 to 167) */}
          <div className="w-full h-[95px] flex flex-col justify-start items-center px-1.5 pt-0.5 relative shrink-0">
            {/* CTS Decorative Circle Pot Body & Ground Tab (Consistent 68mm circle with normal pots) */}
            <div className="w-full flex items-center justify-center relative">
              {/* Circular Pot Label */}
              <div className="w-[68px] h-[68px] rounded-full bg-gradient-to-br from-slate-100 via-zinc-200 to-slate-300 dark:from-zinc-700 dark:via-zinc-800 dark:to-zinc-900 border-2 border-slate-300 dark:border-zinc-600 shadow-md flex flex-col items-center justify-center relative p-1">
                {/* Inner Concentric Stamped Rim */}
                <div className="w-[54px] h-[54px] rounded-full border border-slate-300/80 dark:border-zinc-700/80 flex flex-col items-center justify-center shadow-inner">
                  <span className="text-[8.5px] font-mono font-black tracking-wider text-slate-950 dark:text-zinc-100 leading-tight">
                    CTS {properties.resistanceK ?? 500}k
                  </span>
                  <span className="text-[6.5px] font-mono font-extrabold uppercase tracking-tight text-amber-800 dark:text-amber-400 mt-0.5 leading-tight">
                    {properties.taper ?? 'audio'} TAPER
                  </span>
                </div>
              </div>

              {/* Right edge casing ground landing pad for the real SVG ground lug dead center at (114, 108) */}
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-6 rounded-r bg-gradient-to-r from-slate-200 to-slate-300 dark:from-zinc-700 dark:via-zinc-800 dark:to-zinc-800 border-t border-r border-b border-slate-400 dark:border-zinc-600 flex items-center justify-center shadow-xs"
                title="Pot Body Ground"
              >
                <div className="w-2 h-3 rounded-full border border-slate-400 dark:border-zinc-600 bg-slate-100 dark:bg-zinc-950" />
              </div>
            </div>

            {/* Bottom clearance area so 3 lugs (at y: 148 & 156) sit cleanly below the label/taper circle */}
            <div className="w-full h-5" />
          </div>

          {/* Bottom Section: Push-Pull & Level Controls (Fixed height 55px, y: 167 to 222) */}
          <div className="w-full h-[55px] border-t border-zinc-800/80 px-2 py-1 flex flex-col justify-between items-center shrink-0 overflow-hidden">
            {isInteractiveMode ? (
              <>
                {/* Push-Pull Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPropertyChange({ pulledUp: !isPulled });
                  }}
                  title="Click to toggle Push / Pull switch"
                  className={`w-full h-5 px-2 rounded-md font-mono text-[8px] font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                    isPulled
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500 dark:border-amber-400 ring-1 ring-amber-400/40 shadow-xs shadow-amber-500/20'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isPulled ? 'bg-amber-500 dark:bg-amber-400 animate-pulse' : 'bg-zinc-500 dark:bg-zinc-600'}`} />
                  <span>{isPulled ? 'PULL (UP)' : 'PUSH (DOWN)'}</span>
                </button>

                {/* Level slider constrained strictly within component width */}
                <div className="flex items-center gap-1.5 w-full min-w-0 max-w-full px-0.5 overflow-hidden">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={val}
                    onChange={(e) => onPropertyChange({ currentValue: parseFloat(e.target.value) })}
                    className="flex-1 min-w-0 w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500 dark:accent-amber-400"
                  />
                  <span className="text-[8.5px] font-mono font-bold text-amber-700 dark:text-amber-400 shrink-0 w-3.5 text-right">
                    {Math.round(val * 10)}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-col justify-center items-center w-full h-full gap-1 text-[8px] font-mono">
                <div className="flex items-center justify-between w-full px-1">
                  <span className="text-zinc-600 dark:text-zinc-400 font-medium">SWITCH:</span>
                  <span className={`font-bold ${isPulled ? 'text-amber-700 dark:text-amber-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                    {isPulled ? 'PULLED (UP)' : 'PUSHED (DOWN)'}
                  </span>
                </div>
                <div className="flex items-center justify-between w-full px-1 text-[7.5px] text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium">POT LEVEL:</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-300">{Math.round(val * 10)} / 10</span>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    case 'pot-stacked': {
      const inVal = properties.innerValue ?? 1.0;
      const outVal = properties.outerValue ?? 1.0;
      return (
        <div className="w-full h-full bg-zinc-900 border border-zinc-700/80 rounded-xl p-2 flex flex-col justify-between shadow-lg relative overflow-hidden">
          {/* Vertical Solder Lug Tabs behind Gang A lugs */}
          <SolderLugTab x={25} y={84} title="Gang A Lug 1" />
          <SolderLugTab x={65} y={92} title="Gang A Wiper" />
          <SolderLugTab x={105} y={84} title="Gang A Lug 3" />

          {/* Vertical Solder Lug Tabs behind Gang B lugs */}
          <SolderLugTab x={25} y={132} title="Gang B Lug 1" />
          <SolderLugTab x={65} y={140} title="Gang B Wiper" />
          <SolderLugTab x={105} y={132} title="Gang B Lug 3" />

          {/* Top: 24mm CTS Potentiometer Metal Casing (68px circle) */}
          <div className="relative w-full flex items-center justify-center pt-0.5 shrink-0">
            {/* The 68mm Decorative Circle */}
            <div className="w-[68px] h-[68px] rounded-full bg-gradient-to-br from-slate-100 via-zinc-200 to-slate-300 dark:from-zinc-700 dark:via-zinc-800 dark:to-zinc-900 border-2 border-slate-300 dark:border-zinc-600 shadow-md flex items-center justify-center relative p-1">
              <div className="w-[54px] h-[54px] rounded-full border border-slate-300/80 dark:border-zinc-700/80 flex flex-col items-center justify-center shadow-inner">
                <span className="text-[8.5px] font-mono font-black text-slate-950 dark:text-zinc-100 leading-tight">CTS DUAL</span>
                <span className="text-[6.5px] font-mono font-extrabold text-amber-800 dark:text-amber-400 mt-0.5 leading-tight">CONCENTRIC</span>
              </div>
            </div>
            {/* Ground landing tab on right edge (terminal dead center at x: 114, y: 42) */}
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-6 rounded-r bg-gradient-to-r from-slate-200 to-slate-300 dark:from-zinc-700 dark:via-zinc-800 dark:to-zinc-800 border-t border-r border-b border-slate-400 dark:border-zinc-600 flex items-center justify-center shadow-xs"
              title="Casing Ground"
            >
              <div className="w-2 h-3 rounded-full border border-slate-400 dark:border-zinc-600 bg-slate-100 dark:bg-zinc-950" />
            </div>
          </div>

          {/* Gang A Solder Lug Clearance Area below circle (Lugs at y: 84-92) */}
          <div className="w-full h-4 shrink-0" />

          {/* Wafer Banner A: Positioned cleanly below Gang A lugs (2-line box, unobstructed) */}
          <div className="w-full h-[24px] px-1.5 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/60 flex flex-col justify-between shrink-0">
            <div className="flex items-center justify-between leading-tight">
              <span className="font-bold text-amber-400 text-[7px] font-mono">GANG A (INNER)</span>
              <span className="text-zinc-400 text-[6.5px] font-mono">TOP KNOB</span>
            </div>
            <div className="flex items-center justify-between text-zinc-400 text-[6.5px] font-mono leading-tight">
              <span>L1 (CCW)</span>
              <span>WIPER</span>
              <span>L3 (CW)</span>
            </div>
          </div>

          {/* Gang B Solder Lug Clearance Area (Lugs at y: 132-140) */}
          <div className="w-full h-4 shrink-0" />

          {/* Wafer Banner B: Positioned cleanly below Gang B lugs (2-line box, unobstructed) */}
          <div className="w-full h-[24px] px-1.5 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/60 flex flex-col justify-between shrink-0">
            <div className="flex items-center justify-between leading-tight">
              <span className="font-bold text-cyan-400 text-[7px] font-mono">GANG B (OUTER)</span>
              <span className="text-zinc-400 text-[6.5px] font-mono">BOTTOM RING</span>
            </div>
            <div className="flex items-center justify-between text-zinc-400 text-[6.5px] font-mono leading-tight">
              <span>L1 (CCW)</span>
              <span>WIPER</span>
              <span>L3 (CW)</span>
            </div>
          </div>

          {/* Bottom: Dual Concentric Controls with specs readout */}
          <div className="w-full pt-1 border-t border-zinc-800 flex flex-col gap-1.5 shrink-0">
            <div className="flex items-center justify-between px-1 text-[7.5px] font-mono">
              <span className="text-zinc-600 dark:text-zinc-400 font-medium">DUAL GANG CTS</span>
              <span className="text-zinc-900 dark:text-zinc-200 font-bold">500k/500k</span>
            </div>
            {isInteractiveMode ? (
              <>
                <div className="flex items-center justify-between text-[7.5px] font-mono gap-1">
                  <span className="text-amber-700 dark:text-amber-400 font-bold min-w-[28px]">In:{Math.round(inVal * 10)}</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={inVal}
                    onChange={(e) => onPropertyChange({ innerValue: parseFloat(e.target.value) })}
                    className="flex-1 min-w-0 h-1 bg-zinc-200 dark:bg-zinc-800 accent-amber-500 dark:accent-amber-400 cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between text-[7.5px] font-mono gap-1">
                  <span className="text-cyan-700 dark:text-cyan-400 font-bold min-w-[28px]">Out:{Math.round(outVal * 10)}</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={outVal}
                    onChange={(e) => onPropertyChange({ outerValue: parseFloat(e.target.value) })}
                    className="flex-1 min-w-0 h-1 bg-zinc-200 dark:bg-zinc-800 accent-cyan-500 dark:accent-cyan-400 cursor-pointer"
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between text-[8px] font-mono px-1">
                <span className="text-zinc-600 dark:text-zinc-400">DUAL SHAFTS</span>
                <span className="text-amber-700 dark:text-amber-400 font-bold">{Math.round(inVal * 10)}/{Math.round(outVal * 10)}</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    case 'pot-blend': {
      const blend = properties.blendValue ?? 0.5;
      return (
        <div className="w-full h-full bg-zinc-900 border border-zinc-700/80 rounded-xl p-2 flex flex-col justify-between shadow-lg relative overflow-hidden">
          {/* Vertical Solder Lug Tabs behind Section A lugs */}
          <SolderLugTab x={25} y={84} title="Pickup A Hot In" />
          <SolderLugTab x={65} y={92} title="Wiper A Out" />
          <SolderLugTab x={105} y={84} title="Lug A Ground" />

          {/* Vertical Solder Lug Tabs behind Section B lugs */}
          <SolderLugTab x={25} y={132} title="Pickup B Hot In" />
          <SolderLugTab x={65} y={140} title="Wiper B Out" />
          <SolderLugTab x={105} y={132} title="Lug B Ground" />

          {/* Top: 2-Gang Blend/Balance Metal Casing (68px circle) */}
          <div className="relative w-full flex items-center justify-center pt-0.5 shrink-0">
            {/* The 68mm Decorative Circle */}
            <div className="w-[68px] h-[68px] rounded-full bg-gradient-to-br from-slate-100 via-zinc-200 to-slate-300 dark:from-zinc-700 dark:via-zinc-800 dark:to-zinc-900 border-2 border-slate-300 dark:border-zinc-600 shadow-md flex items-center justify-center relative p-1">
              <div className="w-[54px] h-[54px] rounded-full border border-slate-300/80 dark:border-zinc-700/80 flex flex-col items-center justify-center shadow-inner">
                <span className="text-[8.5px] font-mono font-black text-slate-950 dark:text-zinc-100 leading-tight">250k M/N</span>
                <span className="text-[6.5px] font-mono font-extrabold text-amber-800 dark:text-amber-400 mt-0.5 leading-tight">BALANCE</span>
              </div>
            </div>
            {/* Ground landing tab on right edge (terminal dead center at x: 114, y: 42) */}
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-6 rounded-r bg-gradient-to-r from-slate-200 to-slate-300 dark:from-zinc-700 dark:via-zinc-800 dark:to-zinc-800 border-t border-r border-b border-slate-400 dark:border-zinc-600 flex items-center justify-center shadow-xs"
              title="Casing Ground"
            >
              <div className="w-2 h-3 rounded-full border border-slate-400 dark:border-zinc-600 bg-slate-100 dark:bg-zinc-950" />
            </div>
          </div>

          {/* Section A Solder Lug Clearance Area below circle (Lugs at y: 84-92) */}
          <div className="w-full h-4 shrink-0" />

          {/* Wafer Banner A: Positioned cleanly below Pickup A lugs (2-line box, unobstructed) */}
          <div className="w-full h-[24px] px-1.5 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/60 flex flex-col justify-between shrink-0">
            <div className="flex items-center justify-between leading-tight">
              <span className="font-bold text-amber-400 text-[7px] font-mono">PICKUP A (NECK)</span>
              <span className="text-zinc-400 text-[6.5px] font-mono">SECTION A</span>
            </div>
            <div className="flex items-center justify-between text-zinc-400 text-[6.5px] font-mono leading-tight">
              <span>HOT IN</span>
              <span>WIPER OUT</span>
              <span>GROUND</span>
            </div>
          </div>

          {/* Section B Solder Lug Clearance Area (Lugs at y: 132-140) */}
          <div className="w-full h-4 shrink-0" />

          {/* Wafer Banner B: Positioned cleanly below Pickup B lugs (2-line box, unobstructed) */}
          <div className="w-full h-[24px] px-1.5 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/60 flex flex-col justify-between shrink-0">
            <div className="flex items-center justify-between leading-tight">
              <span className="font-bold text-cyan-400 text-[7px] font-mono">PICKUP B (BRIDGE)</span>
              <span className="text-zinc-400 text-[6.5px] font-mono">SECTION B</span>
            </div>
            <div className="flex items-center justify-between text-zinc-400 text-[6.5px] font-mono leading-tight">
              <span>HOT IN</span>
              <span>WIPER OUT</span>
              <span>GROUND</span>
            </div>
          </div>

          {/* Bottom: Controls & Balance Readout */}
          <div className="w-full pt-1 border-t border-zinc-800 flex flex-col items-center gap-1 shrink-0">
            <div className="text-[7.5px] font-mono flex justify-between w-full px-1">
              <span className="text-zinc-600 dark:text-zinc-400 font-medium">M/N BALANCE</span>
              <span className="text-zinc-900 dark:text-zinc-200 font-bold">{blend === 0.5 ? 'CENTER DETENT' : blend < 0.5 ? 'NECK DOMINANT' : 'BRIDGE DOMINANT'}</span>
            </div>
            {isInteractiveMode ? (
              <>
                <div className="text-[7.5px] font-mono text-zinc-600 dark:text-zinc-400 flex justify-between w-full px-1">
                  <span>A: {Math.round(Math.max(0, 1 - Math.max(0, (blend - 0.5) * 2)) * 100)}%</span>
                  <span>B: {Math.round(Math.max(0, 1 - Math.max(0, (0.5 - blend) * 2)) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={blend}
                  onChange={(e) => onPropertyChange({ blendValue: parseFloat(e.target.value) })}
                  className="w-full min-w-0 h-1.5 bg-zinc-200 dark:bg-zinc-800 accent-amber-500 dark:accent-amber-400 cursor-pointer"
                />
              </>
            ) : (
              <div className="text-[8px] font-mono text-amber-700 dark:text-amber-400 font-bold text-center">
                Center Detent Balance
              </div>
            )}
          </div>
        </div>
      );
    }

    case 'switch-3way-toggle': {
      const pos = properties.switchPosition ?? 1; // 0=Bridge, 1=Both, 2=Neck
      const posNames = ['BRIDGE (Treble)', 'BOTH (Middle)', 'NECK (Rhythm)'];
      return (
        <div className="w-full h-full bg-zinc-900 border border-zinc-700 rounded-xl p-2 flex flex-col justify-between shadow-lg">
          {/* Top: Solder Lug Clearance Area (Zero text behind sw-ground, sw-bridge, sw-output, sw-neck) */}
          <div className="w-full h-14 bg-zinc-950/40 rounded border border-zinc-800/60" />

          {/* Bottom: Controls (Lever & Position Buttons) */}
          <div className="w-full pt-1 border-t border-zinc-800 flex flex-col items-center gap-1">
            <div className="text-[7.5px] font-mono text-zinc-500 text-center">SWITCHCRAFT LEAF</div>
            {isInteractiveMode ? (
              <div className="flex items-center justify-between w-full gap-1">
                {[0, 1, 2].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPropertyChange({ switchPosition: p });
                    }}
                    className={`flex-1 py-1 rounded font-mono text-[8.5px] font-bold border transition-all cursor-pointer ${
                      pos === p
                        ? 'bg-amber-500 text-zinc-950 border-amber-300 shadow-md shadow-amber-500/30'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    {p === 0 ? 'BRIDGE' : p === 1 ? 'BOTH' : 'NECK'}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-[8px] font-mono text-amber-400 font-bold text-center">
                {posNames[pos]}
              </div>
            )}
          </div>
        </div>
      );
    }

    case 'switch-5way-blade': {
      const pos = properties.switchPosition ?? 0;
      const posLabels = ['1: Neck', '2: Neck+Mid', '3: Middle', '4: Mid+Bridge', '5: Bridge'];
      return (
        <div className="w-full h-full bg-zinc-900 border border-zinc-700/80 rounded-lg p-2 flex flex-col justify-between shadow-lg">
          {/* Top: Solder Lug Clearance Area for 8 wafer terminals (Zero text in wafer zone) */}
          <div className="w-full h-11 bg-zinc-950/40 rounded border border-zinc-800/60" />

          {/* Bottom: Controls and Position Readout (Cleanly separated from wafer lugs) */}
          <div className="w-full pt-1 border-t border-zinc-800 flex flex-col gap-1">
            <div className="text-[8px] font-mono text-amber-400 font-bold text-center">
              {posLabels[pos]}
            </div>
            <div className="flex items-center justify-between gap-1">
              {[0, 1, 2, 3, 4].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPropertyChange({ switchPosition: p });
                  }}
                  className={`flex-1 py-1 rounded text-[8.5px] font-mono font-bold border transition-all cursor-pointer ${
                    pos === p
                      ? 'bg-amber-500 text-zinc-950 border-amber-300 shadow-md shadow-amber-500/20'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  {p + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    case 'switch-4way-blade': {
      const pos = properties.switchPosition ?? 0;
      const labels = ['1: Bridge', '2: Parallel', '3: Neck', '4: SERIES'];
      return (
        <div className="w-full h-full bg-zinc-900 border border-zinc-700/80 rounded-lg p-2 flex flex-col justify-between shadow-lg">
          {/* Top: Solder Lug Clearance Area for 10 wafer terminals (Zero text in wafer zone) */}
          <div className="w-full h-11 bg-zinc-950/40 rounded border border-zinc-800/60" />

          {/* Bottom: Controls and Position Readout */}
          <div className="w-full pt-1 border-t border-zinc-800 flex flex-col gap-1">
            <div className="text-[8px] font-mono text-amber-400 font-bold text-center">
              {labels[pos]}
            </div>
            <div className="flex items-center justify-between gap-1">
              {[0, 1, 2, 3].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPropertyChange({ switchPosition: p });
                  }}
                  className={`flex-1 py-1 rounded text-[8.5px] font-mono font-bold border transition-all cursor-pointer ${
                    pos === p
                      ? 'bg-amber-500 text-zinc-950 border-amber-300 shadow-md'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  {p + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    case 'switch-3way-blade': {
      const pos = properties.switchPosition ?? 0;
      const labels = ['1: Neck', '2: Both', '3: Bridge'];
      return (
        <div className="w-full h-full bg-zinc-900 border border-zinc-700/80 rounded-lg p-2 flex flex-col justify-between shadow-lg">
          {/* Top: Solder Lug Clearance Area for 8 wafer terminals */}
          <div className="w-full h-11 bg-zinc-950/40 rounded border border-zinc-800/60" />

          {/* Bottom: Controls and Position Readout */}
          <div className="w-full pt-1 border-t border-zinc-800 flex flex-col gap-1">
            <div className="text-[8px] font-mono text-amber-400 font-bold text-center">
              {labels[pos]}
            </div>
            <div className="flex items-center justify-between gap-1">
              {[0, 1, 2].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPropertyChange({ switchPosition: p });
                  }}
                  className={`flex-1 py-1 rounded text-[8.5px] font-mono font-bold border transition-all cursor-pointer ${
                    pos === p
                      ? 'bg-amber-500 text-zinc-950 border-amber-300 shadow-md shadow-amber-500/20'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  {p === 0 ? '1:N' : p === 1 ? '2:BOTH' : '3:B'}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    case 'switch-superswitch': {
      const pos = properties.switchPosition ?? 0;
      const posLabels = ['Pos 1', 'Pos 2', 'Pos 3', 'Pos 4', 'Pos 5'];
      return (
        <div className="w-full h-full bg-zinc-900 border border-zinc-700/80 rounded-lg p-2 flex flex-col justify-between shadow-lg">
          {/* Top: 24 Solder Lug Clearance Area across 4 poles (Zero text in 4-pole wafer zone) */}
          <div className="w-full h-19 bg-zinc-950/40 rounded border border-zinc-800/60" />

          {/* Bottom: Controls and Position Readout */}
          <div className="w-full pt-1 border-t border-zinc-800 flex flex-col gap-1">
            <div className="text-[8px] font-mono text-amber-400 font-bold text-center">
              OAK 4-POLE: {posLabels[pos]}
            </div>
            <div className="flex items-center justify-between gap-1">
              {[0, 1, 2, 3, 4].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPropertyChange({ switchPosition: p });
                  }}
                  className={`flex-1 py-1 rounded text-[8.5px] font-mono font-bold border transition-all cursor-pointer ${
                    pos === p
                      ? 'bg-amber-500 text-zinc-950 border-amber-300 shadow-md shadow-amber-500/20'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  {p + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    case 'switch-dpdt-minitoggle': {
      const pos = properties.switchPosition ?? 0; // 0 = Down, 1 = Up
      return (
        <div className="w-full h-full bg-zinc-900 border border-zinc-700 rounded-xl p-2 flex flex-col justify-between shadow-lg">
          {/* Top: Solder Lug Clearance Area (Zero text behind the 6 mini-toggle terminals) */}
          <div className="w-full h-18 bg-zinc-950/40 rounded border border-zinc-800/60" />

          {/* Bottom: Toggle Switch Bat Control and Position Readout */}
          <div className="w-full pt-1 border-t border-zinc-800 flex flex-col items-center">
            {isInteractiveMode ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPropertyChange({ switchPosition: pos === 0 ? 1 : 0 });
                }}
                className={`w-full py-1 px-1.5 rounded-lg font-mono text-[8.5px] font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  pos === 1
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-sm shadow-amber-500/20'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
                }`}
                title="Click to toggle bat switch (Up / Down)"
              >
                <div
                  className={`w-1.5 h-3 rounded-full transition-transform ${
                    pos === 1 ? 'bg-amber-400 -translate-y-0.5' : 'bg-zinc-500 translate-y-0.5'
                  }`}
                />
                <span>{pos === 1 ? 'TOGGLE: UP' : 'TOGGLE: DOWN'}</span>
              </button>
            ) : (
              <div className="text-[7.5px] font-mono text-amber-400 font-bold text-center">
                {pos === 1 ? 'UP (1-C-3)' : 'DOWN (2-C-4)'}
              </div>
            )}
          </div>
        </div>
      );
    }

    case 'capacitor': {
      return (
        <div className="w-full h-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 rounded-full border border-amber-300 flex items-center justify-center shadow-lg p-1">
          <div className="flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[8.5px] font-mono font-bold text-zinc-950 tracking-tight leading-none">
              {properties.capacitanceUf ?? 0.022}µF
            </span>
            <span className="text-[6.5px] font-mono font-semibold text-zinc-900 leading-none mt-0.5">
              715P 200V
            </span>
          </div>
        </div>
      );
    }

    case 'resistor': {
      return (
        <div className="w-full h-full bg-amber-100 rounded-full border border-amber-300 flex items-center justify-center shadow-sm p-1">
          <div className="flex items-center gap-1 pointer-events-none">
            <div className="w-1.5 h-3 bg-amber-800 rounded-xs" />
            <div className="w-1.5 h-3 bg-green-700 rounded-xs" />
            <div className="w-1.5 h-3 bg-amber-500 rounded-xs" />
            <div className="w-1.5 h-3 bg-amber-300 rounded-xs" />
            <span className="text-[7.5px] font-mono font-bold text-zinc-900 ml-1">
              {Math.round((properties.resistanceOhms ?? 150000) / 1000)}kΩ
            </span>
          </div>
        </div>
      );
    }

    case 'output-jack': {
      return (
        <div className="w-full h-full bg-zinc-900 border-2 border-zinc-600 rounded-xl p-1.5 flex flex-col justify-between shadow-lg">
          {/* Top: Solder Terminal Clearance Area for Tip & Sleeve */}
          <div className="w-full h-6" />
          {/* Bottom: 1/4" Phone Jack Socket Opening and Nut */}
          <div className="flex flex-col items-center justify-center my-0.5">
            <div className="w-7 h-7 rounded-full bg-zinc-950 border-2 border-zinc-500 flex items-center justify-center shadow-inner">
              <div className="w-3.5 h-3.5 rounded-full bg-black border border-zinc-700" />
            </div>
            <span className="text-[6.5px] font-mono text-zinc-500 mt-0.5">1/4" MONO JACK</span>
          </div>
        </div>
      );
    }

    case 'ground-lug': {
      return (
        <div className="w-full h-full bg-zinc-900/90 border border-zinc-700 rounded-md p-1.5 flex flex-col items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-zinc-400 border border-zinc-600 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-zinc-900" />
          </div>
        </div>
      );
    }

    default:
      return (
        <div className="w-full h-full bg-zinc-900 border border-zinc-700 rounded p-2 flex items-center justify-center text-[8px] font-mono text-zinc-400">
          HARDWARE
        </div>
      );
  }
}
