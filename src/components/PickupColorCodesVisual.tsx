import React, { useState } from 'react';
import { PickupBrandStandard } from '../types/guitar';
import { PICKUP_COLOR_CODES } from '../lib/colorCodes';
import {
  Sparkles,
  Layers,
  Zap,
  Shield,
  Split,
  RotateCw,
  Info,
  Check,
} from 'lucide-react';

interface PickupColorCodesVisualProps {
  theme?: 'dark' | 'light';
}

export const PickupColorCodesVisual: React.FC<PickupColorCodesVisualProps> = ({
  theme = 'dark',
}) => {
  const [selectedBrand, setSelectedBrand] = useState<PickupBrandStandard>('seymour-duncan');
  const [wireHover, setWireHover] = useState<string | null>(null);
  const [wiringMode, setWiringMode] = useState<'series' | 'split-slug' | 'split-screw' | 'phase'>('series');

  const brandData = PICKUP_COLOR_CODES[selectedBrand];
  const { mapping } = brandData;

  // Color helper to get human label
  const getColorName = (hex: string) => {
    switch (hex.toLowerCase()) {
      case '#18181b':
      case '#000000':
        return 'Black';
      case '#f8fafc':
      case '#ffffff':
        return 'White';
      case '#ef4444':
        return 'Red';
      case '#22c55e':
        return 'Green';
      case '#94a3b8':
        return 'Bare / Silver';
      default:
        return hex;
    }
  };

  const getBorderColor = (hex: string) => {
    if (hex.toLowerCase() === '#f8fafc' || hex.toLowerCase() === '#ffffff') return '#94a3b8';
    if (hex.toLowerCase() === '#18181b') return '#52525b';
    return hex;
  };

  return (
    <div className="flex flex-col gap-4 text-xs font-mono">
      {/* Brand Selection Pills */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-zinc-100 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-zinc-500 uppercase px-1">Brand:</span>
          {(Object.keys(PICKUP_COLOR_CODES) as PickupBrandStandard[]).map((key) => {
            const b = PICKUP_COLOR_CODES[key];
            const isSelected = selectedBrand === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedBrand(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                    : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800'
                }`}
              >
                <span>{b.brand.replace(' (4-Conductor)', '')}</span>
              </button>
            );
          })}
        </div>

        {/* Wiring Mode Sub-tabs */}
        <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-[11px]">
          <button
            type="button"
            onClick={() => setWiringMode('series')}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
              wiringMode === 'series'
                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold border border-amber-500/30'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            Series (Standard)
          </button>
          <button
            type="button"
            onClick={() => setWiringMode('split-slug')}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
              wiringMode === 'split-slug'
                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold border border-amber-500/30'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            Coil Split
          </button>
          <button
            type="button"
            onClick={() => setWiringMode('phase')}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
              wiringMode === 'phase'
                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold border border-amber-500/30'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            Reverse Phase
          </button>
        </div>
      </div>

      {/* Main Visual Humbucker SVG Schematic Canvas */}
      <div className="p-4 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 flex flex-col md:flex-row items-center gap-6 shadow-xs">
        {/* Interactive SVG Diagram */}
        <div className="w-full md:w-3/5 flex justify-center">
          <svg
            viewBox="0 0 540 320"
            className="w-full max-w-[500px] h-auto select-none overflow-visible"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {/* Baseplate */}
            <rect
              x="50"
              y="30"
              width="260"
              height="260"
              rx="16"
              fill={theme === 'dark' ? '#18181b' : '#f1f5f9'}
              stroke={theme === 'dark' ? '#3f3f46' : '#cbd5e1'}
              strokeWidth="2"
            />
            {/* Nickel Baseplate screw ears */}
            <rect x="25" y="145" width="25" height="30" rx="4" fill={theme === 'dark' ? '#27272a' : '#e2e8f0'} stroke={theme === 'dark' ? '#52525b' : '#94a3b8'} strokeWidth="1.5" />
            <circle cx="37" cy="160" r="4" fill={theme === 'dark' ? '#09090b' : '#ffffff'} />
            <rect x="310" y="145" width="25" height="30" rx="4" fill={theme === 'dark' ? '#27272a' : '#e2e8f0'} stroke={theme === 'dark' ? '#52525b' : '#94a3b8'} strokeWidth="1.5" />
            <circle cx="323" cy="160" r="4" fill={theme === 'dark' ? '#09090b' : '#ffffff'} />

            {/* NORTH BOBBIN (Slug / Studs) */}
            <rect
              x="70"
              y="50"
              width="220"
              height="80"
              rx="10"
              fill={theme === 'dark' ? '#09090b' : '#ffffff'}
              stroke={theme === 'dark' ? '#52525b' : '#94a3b8'}
              strokeWidth="2"
            />
            <text x="82" y="70" fill={theme === 'dark' ? '#f4f4f5' : '#0f172a'} fontSize="10" fontWeight="bold">NORTH COIL (SLUG)</text>
            <text x="82" y="83" fill="#3b82f6" fontSize="8" fontWeight="bold">MAGNETIC POLARITY: NORTH (+)</text>

            {/* 6 Steel Slug Pole Pieces */}
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <circle
                key={`slug-${i}`}
                cx={95 + i * 34}
                cy="104"
                r="7.5"
                fill={theme === 'dark' ? '#71717a' : '#cbd5e1'}
                stroke={theme === 'dark' ? '#a1a1aa' : '#64748b'}
                strokeWidth="1.5"
              />
            ))}

            {/* SOUTH BOBBIN (Adjustable Screws) */}
            <rect
              x="70"
              y="190"
              width="220"
              height="80"
              rx="10"
              fill={theme === 'dark' ? '#09090b' : '#ffffff'}
              stroke={theme === 'dark' ? '#52525b' : '#94a3b8'}
              strokeWidth="2"
            />
            <text x="82" y="210" fill={theme === 'dark' ? '#f4f4f5' : '#0f172a'} fontSize="10" fontWeight="bold">SOUTH COIL (SCREW)</text>
            <text x="82" y="223" fill="#ef4444" fontSize="8" fontWeight="bold">MAGNETIC POLARITY: SOUTH (-)</text>

            {/* 6 Slotted Screw Pole Pieces */}
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <g key={`screw-${i}`} transform={`translate(${95 + i * 34}, 244)`}>
                <circle cx="0" cy="0" r="7.5" fill={theme === 'dark' ? '#a1a1aa' : '#e2e8f0'} stroke={theme === 'dark' ? '#e4e4e7' : '#475569'} strokeWidth="1.5" />
                <line x1="-5" y1="-2" x2="5" y2="2" stroke={theme === 'dark' ? '#18181b' : '#334155'} strokeWidth="1.5" />
              </g>
            ))}

            {/* Magnet bar indicator between bobbins */}
            <rect x="75" y="142" width="210" height="36" rx="6" fill={theme === 'dark' ? '#27272a' : '#e2e8f0'} stroke={theme === 'dark' ? '#3f3f46' : '#cbd5e1'} strokeDasharray="3 3" />
            <text x="180" y="164" fill={theme === 'dark' ? '#a1a1aa' : '#64748b'} fontSize="9" textAnchor="middle" fontWeight="bold">ALNICO / CERAMIC BAR MAGNET</text>

            {/* OUTPUT CABLE BUNDLE SHIELD TUBE */}
            <path d="M 310 160 C 350 160, 360 160, 380 160" fill="none" stroke={theme === 'dark' ? '#3f3f46' : '#94a3b8'} strokeWidth="18" strokeLinecap="round" />
            <path d="M 310 160 C 350 160, 360 160, 380 160" fill="none" stroke={theme === 'dark' ? '#18181b' : '#334155'} strokeWidth="14" strokeLinecap="round" />

            {/* 1. NORTH START WIRE */}
            <path
              d="M 290 65 C 340 65, 360 80, 440 65"
              fill="none"
              stroke={getBorderColor(mapping.northStart)}
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path
              d="M 290 65 C 340 65, 360 80, 440 65"
              fill="none"
              stroke={mapping.northStart}
              strokeWidth="3.5"
              strokeLinecap="round"
              className="cursor-pointer transition-all"
              onMouseEnter={() => setWireHover('northStart')}
              onMouseLeave={() => setWireHover(null)}
            />
            <circle cx="440" cy="65" r="5" fill={mapping.northStart} stroke={getBorderColor(mapping.northStart)} strokeWidth="1.5" />
            <text x="452" y="69" fill={theme === 'dark' ? '#f4f4f5' : '#0f172a'} fontSize="10" fontWeight="bold">
              {getColorName(mapping.northStart)}
              <tspan fill="#3b82f6" fontSize="8" dx="4">
                (N-Start {brandData.hotLead.includes(getColorName(mapping.northStart)) ? '• HOT' : ''})
              </tspan>
            </text>

            {/* 2. NORTH FINISH WIRE */}
            <path
              d="M 290 115 C 330 115, 360 110, 440 110"
              fill="none"
              stroke={getBorderColor(mapping.northFinish)}
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path
              d="M 290 115 C 330 115, 360 110, 440 110"
              fill="none"
              stroke={mapping.northFinish}
              strokeWidth="3.5"
              strokeLinecap="round"
              className="cursor-pointer transition-all"
              onMouseEnter={() => setWireHover('northFinish')}
              onMouseLeave={() => setWireHover(null)}
            />
            <circle cx="440" cy="110" r="5" fill={mapping.northFinish} stroke={getBorderColor(mapping.northFinish)} strokeWidth="1.5" />
            <text x="452" y="114" fill={theme === 'dark' ? '#f4f4f5' : '#0f172a'} fontSize="10" fontWeight="bold">
              {getColorName(mapping.northFinish)}
              <tspan fill="#eab308" fontSize="8" dx="4">
                (N-Finish • Series)
              </tspan>
            </text>

            {/* 3. SOUTH FINISH WIRE */}
            <path
              d="M 290 205 C 330 205, 360 155, 440 155"
              fill="none"
              stroke={getBorderColor(mapping.southFinish)}
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path
              d="M 290 205 C 330 205, 360 155, 440 155"
              fill="none"
              stroke={mapping.southFinish}
              strokeWidth="3.5"
              strokeLinecap="round"
              className="cursor-pointer transition-all"
              onMouseEnter={() => setWireHover('southFinish')}
              onMouseLeave={() => setWireHover(null)}
            />
            <circle cx="440" cy="155" r="5" fill={mapping.southFinish} stroke={getBorderColor(mapping.southFinish)} strokeWidth="1.5" />
            <text x="452" y="159" fill={theme === 'dark' ? '#f4f4f5' : '#0f172a'} fontSize="10" fontWeight="bold">
              {getColorName(mapping.southFinish)}
              <tspan fill="#eab308" fontSize="8" dx="4">
                (S-Finish • Series)
              </tspan>
            </text>

            {/* SERIES LINK BRACKET INDICATOR */}
            <path d="M 444 118 C 452 118, 452 132, 446 132 C 452 132, 452 147, 444 147" fill="none" stroke="#eab308" strokeWidth="1.5" strokeDasharray="2 2" />
            <rect x="448" y="123" width="76" height="18" rx="4" fill="#eab308" />
            <text x="486" y="135" fill="#18181b" fontSize="8" fontWeight="bold" textAnchor="middle">
              {wiringMode === 'split-slug' ? 'TO GROUND (SPLIT)' : 'SOLDER TOGETHER'}
            </text>

            {/* 4. SOUTH START WIRE */}
            <path
              d="M 290 255 C 340 255, 360 210, 440 210"
              fill="none"
              stroke={getBorderColor(mapping.southStart)}
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path
              d="M 290 255 C 340 255, 360 210, 440 210"
              fill="none"
              stroke={mapping.southStart}
              strokeWidth="3.5"
              strokeLinecap="round"
              className="cursor-pointer transition-all"
              onMouseEnter={() => setWireHover('southStart')}
              onMouseLeave={() => setWireHover(null)}
            />
            <circle cx="440" cy="210" r="5" fill={mapping.southStart} stroke={getBorderColor(mapping.southStart)} strokeWidth="1.5" />
            <text x="452" y="214" fill={theme === 'dark' ? '#f4f4f5' : '#0f172a'} fontSize="10" fontWeight="bold">
              {getColorName(mapping.southStart)}
              <tspan fill="#22c55e" fontSize="8" dx="4">
                (S-Start • {brandData.groundLead.includes(getColorName(mapping.southStart)) ? 'GROUND' : 'HOT'})
              </tspan>
            </text>

            {/* 5. BARE SHIELD WIRE */}
            <path
              d="M 295 160 C 330 170, 360 255, 440 255"
              fill="none"
              stroke="#64748b"
              strokeWidth="4"
              strokeDasharray="2 2"
              strokeLinecap="round"
            />
            <path
              d="M 295 160 C 330 170, 360 255, 440 255"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="440" cy="255" r="5" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
            <text x="452" y="259" fill={theme === 'dark' ? '#f4f4f5' : '#0f172a'} fontSize="10" fontWeight="bold">
              Bare Shield
              <tspan fill="#22c55e" fontSize="8" dx="4">
                (Chassis Ground)
              </tspan>
            </text>

            {/* Ground symbol for Bare wire */}
            <g transform="translate(440, 270)">
              <line x1="0" y1="0" x2="0" y2="10" stroke="#22c55e" strokeWidth="1.5" />
              <line x1="-8" y1="10" x2="8" y2="10" stroke="#22c55e" strokeWidth="1.5" />
              <line x1="-5" y1="13" x2="5" y2="13" stroke="#22c55e" strokeWidth="1.5" />
              <line x1="-2" y1="16" x2="2" y2="16" stroke="#22c55e" strokeWidth="1.5" />
            </g>
          </svg>
        </div>

        {/* Legend & Wiring Explanation Panel */}
        <div className="w-full md:w-2/5 flex flex-col gap-3">
          <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold">
              <Zap className="w-4 h-4" />
              <span>{brandData.brand} Wiring Standard</span>
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
              {brandData.description}
            </p>
          </div>

          {/* Quick Connection Cheat Card */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300">
              <span className="font-bold flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                Hot Signal Lead:
              </span>
              <span className="font-bold px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border border-red-500/40 text-[11px]">
                {brandData.hotLead}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300">
              <span className="font-bold flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                Series Link (Tape / Split):
              </span>
              <span className="font-bold px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border border-amber-500/40 text-[11px]">
                {brandData.seriesLink}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
              <span className="font-bold flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                Ground & Shield:
              </span>
              <span className="font-bold px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border border-emerald-500/40 text-[11px]">
                {brandData.groundLead}
              </span>
            </div>
          </div>

          {/* Mode tip */}
          <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400">
            {wiringMode === 'series' && (
              <p>
                <strong className="text-zinc-950 dark:text-zinc-200">Standard Humbucker:</strong> Solder the two series wires ({brandData.seriesLink}) together and insulate with heat-shrink tubing. Connect the Hot lead to the pickup switch and Ground to the volume pot back.
              </p>
            )}
            {wiringMode === 'split-slug' && (
              <p>
                <strong className="text-zinc-950 dark:text-zinc-200">Coil Split Mod:</strong> Wire the series link ({brandData.seriesLink}) to the common terminal of a Push-Pull DPDT switch. When pulled, short this terminal to Ground to silence the screw coil and leave the punchy slug coil active!
              </p>
            )}
            {wiringMode === 'phase' && (
              <p>
                <strong className="text-zinc-950 dark:text-zinc-200">Out-of-Phase (Peter Green):</strong> Swap the Hot and Ground leads ({brandData.hotLead.split(' ')[0]} and {brandData.groundLead.split(' ')[0]}) using a DPDT phase switch. Keep the Bare Shield wire permanently grounded to avoid buzzing!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Comparison Matrix with visual color swatches */}
      <div>
        <h4 className="text-xs font-bold text-zinc-950 dark:text-zinc-100 uppercase tracking-wider mb-2 flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-500" />
          Cross-Brand Color Code Matrix
        </h4>
        <div className="border border-zinc-300 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-zinc-100 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-400 border-b border-zinc-300 dark:border-zinc-800 font-bold">
              <tr>
                <th className="py-2.5 px-3">Manufacturer</th>
                <th className="py-2.5 px-3">Hot Lead</th>
                <th className="py-2.5 px-3">Series Link</th>
                <th className="py-2.5 px-3">Ground & Shield</th>
                <th className="py-2.5 px-3">North Coil (Start / Fin)</th>
                <th className="py-2.5 px-3">South Coil (Fin / Start)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {(Object.keys(PICKUP_COLOR_CODES) as PickupBrandStandard[]).map((key) => {
                const item = PICKUP_COLOR_CODES[key];
                const isCurrent = selectedBrand === key;
                return (
                  <tr
                    key={key}
                    onClick={() => setSelectedBrand(key)}
                    className={`cursor-pointer transition-colors ${
                      isCurrent
                        ? 'bg-amber-500/10 dark:bg-amber-500/15 font-semibold'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                    }`}
                  >
                    <td className="py-2.5 px-3 text-zinc-900 dark:text-zinc-100 font-bold flex items-center gap-1.5">
                      {isCurrent && <Check className="w-3.5 h-3.5 text-amber-500" />}
                      <span>{item.brand.replace(' (4-Conductor)', '')}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded-full border shrink-0"
                          style={{
                            backgroundColor: item.mapping.northStart,
                            borderColor: getBorderColor(item.mapping.northStart),
                          }}
                        />
                        <span>{getColorName(item.mapping.northStart)}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1">
                        <span
                          className="w-3 h-3 rounded-full border shrink-0"
                          style={{
                            backgroundColor: item.mapping.northFinish,
                            borderColor: getBorderColor(item.mapping.northFinish),
                          }}
                        />
                        <span
                          className="w-3 h-3 rounded-full border shrink-0"
                          style={{
                            backgroundColor: item.mapping.southFinish,
                            borderColor: getBorderColor(item.mapping.southFinish),
                          }}
                        />
                        <span className="text-[11px] text-zinc-600 dark:text-zinc-400">
                          {getColorName(item.mapping.northFinish)} + {getColorName(item.mapping.southFinish)}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded-full border shrink-0"
                          style={{
                            backgroundColor: item.mapping.southStart,
                            borderColor: getBorderColor(item.mapping.southStart),
                          }}
                        />
                        <span className="text-[11px]">
                          {getColorName(item.mapping.southStart)} + Bare
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-zinc-600 dark:text-zinc-400">
                      {getColorName(item.mapping.northStart)} / {getColorName(item.mapping.northFinish)}
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-zinc-600 dark:text-zinc-400">
                      {getColorName(item.mapping.southFinish)} / {getColorName(item.mapping.southStart)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
