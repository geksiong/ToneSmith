import React, { useState } from 'react';
import { CircuitAnalysisResult } from '../types/guitar';

interface FrequencyPlotProps {
  analysis: CircuitAnalysisResult;
}

export const FrequencyResponsePlot: React.FC<FrequencyPlotProps> = ({ analysis }) => {
  const [hoverData, setHoverData] = useState<{ freq: number; db: number; x: number; y: number } | null>(null);

  const width = 440;
  const height = 150;
  const padding = { top: 15, right: 15, bottom: 25, left: 35 };

  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const minFreq = 40;
  const maxFreq = 20000;
  const minDb = -30;
  const maxDb = +15;

  // Convert freq (Hz) to X coordinate (logarithmic scale)
  const freqToX = (f: number) => {
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logF = Math.log10(Math.max(minFreq, Math.min(maxFreq, f)));
    return padding.left + ((logF - logMin) / (logMax - logMin)) * plotW;
  };

  // Convert X coordinate back to freq
  const xToFreq = (x: number) => {
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const frac = (x - padding.left) / plotW;
    return Math.pow(10, logMin + frac * (logMax - logMin));
  };

  // Convert dB to Y coordinate
  const dbToY = (db: number) => {
    const clamped = Math.max(minDb, Math.min(maxDb, db));
    return padding.top + plotH - ((clamped - minDb) / (maxDb - minDb)) * plotH;
  };

  const isOutOfPhase = analysis.phaseRelationship === 'out-of-phase';
  const isSeries = analysis.wiringConfiguration === 'series';
  const isCoilSplit = analysis.isCoilSplit;
  const isParallel = analysis.wiringConfiguration === 'parallel';

  // Curve accent colors
  const strokeColor = isOutOfPhase
    ? '#ec4899'
    : isSeries
    ? '#8b5cf6'
    : '#d97706';

  const gradientColor = isOutOfPhase
    ? '#ec4899'
    : isSeries
    ? '#8b5cf6'
    : '#f59e0b';

  // Calculate electrical gain in dB at given frequency
  const calculateGainAtFreq = (f: number): number => {
    if (!analysis.hasOutputSignal) return -60;

    const f0 = analysis.resonantFrequencyHz;
    const q = analysis.qFactor;
    const toneCutoff = analysis.effectiveToneCutoffHz;
    const volLevel = analysis.effectiveVolumeLevel;
    const numPickups = analysis.activePickups.length;

    // 1. Volume pot attenuation in dB
    const volDb = 20 * Math.log10(Math.max(0.001, volLevel));

    // 2. Base gain offset (series +4dB, coil split -4.5dB, parallel -1.5dB)
    const gainOffsetDb = analysis.gainOffsetDb ?? (isSeries ? 4.0 : isCoilSplit ? -4.5 : isParallel ? -1.5 : 0.0);

    // 3. Second-order RLC transfer function magnitude
    // H(s) = 1 / sqrt((1 - (f/f0)^2)^2 + (f / (f0 * Q))^2)
    const ratio = f / f0;
    const denom = Math.sqrt(Math.pow(1 - ratio * ratio, 2) + Math.pow(ratio / q, 2));
    const rlcGain = 1 / Math.max(0.001, denom);
    let rlcDb = 20 * Math.log10(rlcGain);

    // 4. Tone Pot Rolloff and "Woman Tone" low-mid resonance
    let toneDb = 0;
    if (toneCutoff < 18000) {
      if (toneCutoff < 1200) {
        // Tone knob near zero (0.022µF - 0.047µF capacitor fully shunting pickup)
        // Produces the classic 400-500Hz resonance bump followed by steep cut
        const womanFreq = Math.max(340, Math.min(520, toneCutoff * 0.9));
        const wRatio = f / womanFreq;
        const wDenom = Math.sqrt(Math.pow(1 - wRatio * wRatio, 2) + Math.pow(wRatio / 1.5, 2));
        const womanGain = 1 / Math.max(0.01, wDenom);
        toneDb = 18 * Math.log10(womanGain) - 20 * Math.log10(1 + Math.pow(f / toneCutoff, 2));
        // Fade out original high-frequency RLC peak
        rlcDb = rlcDb * Math.min(1.0, Math.pow(toneCutoff / 3000, 1.3));
      } else {
        // Intermediate tone settings
        toneDb = -10 * Math.log10(1 + Math.pow(f / toneCutoff, 2));
      }
    }

    // 5. Acoustic Phase and Comb Filtering
    let phaseDb = 0;
    if (isOutOfPhase) {
      // Peter Green Out-of-Phase cancellation:
      // Low-frequency fundamentals cancel almost completely (bass scoop down to -20dB)
      if (f < 400) {
        phaseDb = -20 * Math.pow((400 - f) / 360, 1.3);
      }
      // Midrange vocal nasal formant peak around 1.6kHz - 2.2kHz
      const nasalFreq = 1800;
      const nasalDist = Math.abs(Math.log2(f / nasalFreq));
      if (nasalDist < 1.4) {
        phaseDb += 4.5 * Math.exp(-Math.pow(nasalDist / 0.55, 2));
      }
      // High-frequency comb notch around 3.5kHz
      const notchDist = Math.abs(Math.log2(f / 3500));
      if (notchDist < 0.6) {
        phaseDb -= 4.0 * Math.exp(-Math.pow(notchDist / 0.25, 2));
      }
    } else if (numPickups >= 2) {
      // In-phase dual pickup acoustic comb filtering (Strat quack in pos 2 & 4, Tele pos 2)
      // Gentle notch around 2.8kHz - 3.2kHz
      const combFreq = 3000;
      const combDist = Math.abs(Math.log2(f / combFreq));
      if (combDist < 0.8) {
        phaseDb = -3.2 * Math.exp(-Math.pow(combDist / 0.35, 2));
      }
    }

    const totalDb = volDb + gainOffsetDb + rlcDb + toneDb + phaseDb;
    return Math.max(minDb - 5, Math.min(maxDb + 6, totalDb));
  };

  // Generate SVG path for the curve
  const points: { x: number; y: number }[] = [];
  const steps = 100;
  for (let i = 0; i <= steps; i++) {
    const frac = i / steps;
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const f = Math.pow(10, logMin + frac * (logMax - logMin));
    const db = calculateGainAtFreq(f);
    points.push({ x: freqToX(f), y: dbToY(db) });
  }

  const pathD = points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${dbToY(minDb)} L ${points[0].x} ${dbToY(minDb)} Z`;

  // Grid frequencies
  const gridFreqs = [100, 500, 1000, 2000, 5000, 10000];
  const gridDbs = [-20, -10, 0, 10];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    if (mouseX >= padding.left && mouseX <= padding.left + plotW) {
      const f = Math.round(xToFreq(mouseX));
      const db = Math.round(calculateGainAtFreq(f) * 10) / 10;
      setHoverData({ freq: f, db, x: mouseX, y: dbToY(db) });
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900/90 border border-zinc-300 dark:border-zinc-800 rounded-xl p-3 shadow-sm dark:shadow-lg flex flex-col transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-zinc-950 dark:text-zinc-100 tracking-wide">
            FREQUENCY RESPONSE (BODE)
          </span>
          <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 font-semibold">20Hz – 20kHz</span>
          {isOutOfPhase && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-pink-100 text-pink-900 border border-pink-400 dark:bg-pink-950/60 dark:text-pink-300 dark:border-pink-500/50">
              ⚡ Out of Phase
            </span>
          )}
          {isSeries && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-purple-100 text-purple-900 border border-purple-400 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-500/50">
              Series (+4dB)
            </span>
          )}
          {isCoilSplit && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-400 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-500/50">
              Coil Split
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: strokeColor }}
            />
            <span className="text-[10px] font-mono text-zinc-700 dark:text-zinc-300 font-medium">
              Peak f₀:{' '}
              <strong className="font-bold" style={{ color: strokeColor }}>
                {analysis.resonantFrequencyHz} Hz
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-zinc-700 dark:text-zinc-300 font-medium">
              Q: <strong className="text-zinc-950 dark:text-zinc-100 font-bold">{analysis.qFactor}</strong> (+{analysis.peakBoostDb}dB)
            </span>
          </div>
        </div>
      </div>

      <div className="relative w-full h-[150px] bg-white dark:bg-zinc-950/40 rounded-lg border border-zinc-300 dark:border-zinc-800/80 p-0.5">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full select-none cursor-crosshair overflow-visible"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverData(null)}
        >
          <defs>
            <linearGradient id="plotGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={gradientColor} stopOpacity="0.38" />
              <stop offset="60%" stopColor={gradientColor} stopOpacity="0.08" />
              <stop offset="100%" stopColor={gradientColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Background grid */}
          {gridFreqs.map((f) => {
            const x = freqToX(f);
            return (
              <g key={f}>
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={padding.top + plotH}
                  stroke="#cbd5e1"
                  className="stroke-zinc-300 dark:stroke-zinc-800"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <text
                  x={x}
                  y={height - 8}
                  fill="#334155"
                  className="fill-zinc-700 dark:fill-zinc-400 font-mono font-bold"
                  fontSize="8"
                  textAnchor="middle"
                >
                  {f >= 1000 ? `${f / 1000}k` : f}
                </text>
              </g>
            );
          })}

          {gridDbs.map((db) => {
            const y = dbToY(db);
            return (
              <g key={db}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + plotW}
                  y2={y}
                  stroke={db === 0 ? '#64748b' : '#cbd5e1'}
                  className={db === 0 ? 'stroke-zinc-400 dark:stroke-zinc-650' : 'stroke-zinc-300 dark:stroke-zinc-800'}
                  strokeWidth={db === 0 ? '1.4' : '1'}
                  strokeDasharray={db === 0 ? undefined : '2 2'}
                />
                <text
                  x={padding.left - 6}
                  y={y + 3}
                  fill={db === 0 ? '#0f172a' : '#334155'}
                  className={db === 0 ? 'fill-zinc-950 dark:fill-zinc-200 font-black' : 'fill-zinc-700 dark:fill-zinc-400 font-bold'}
                  fontSize="8"
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  {db > 0 ? `+${db}` : db}
                </text>
              </g>
            );
          })}

          {/* Shaded Area under Curve */}
          <path d={areaD} fill="url(#plotGradient)" />

          {/* Curve Stroke */}
          <path
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.6"
            strokeLinecap="round"
          />

          {/* Resonant Frequency Indicator Marker */}
          {analysis.hasOutputSignal && (
            <g>
              <line
                x1={freqToX(analysis.resonantFrequencyHz)}
                y1={padding.top}
                x2={freqToX(analysis.resonantFrequencyHz)}
                y2={padding.top + plotH}
                stroke={strokeColor}
                strokeWidth="1.2"
                strokeDasharray="3 3"
                opacity="0.85"
              />
              <circle
                cx={freqToX(analysis.resonantFrequencyHz)}
                cy={dbToY(calculateGainAtFreq(analysis.resonantFrequencyHz))}
                r="3.8"
                fill={strokeColor}
                stroke="#ffffff"
                strokeWidth="1.4"
              />
            </g>
          )}

          {/* Interactive Hover Crosshair */}
          {hoverData && (
            <g>
              <line
                x1={hoverData.x}
                y1={padding.top}
                x2={hoverData.x}
                y2={padding.top + plotH}
                stroke="#71717a"
                strokeWidth="1"
              />
              <circle
                cx={hoverData.x}
                cy={hoverData.y}
                r="4"
                fill="#ffffff"
                stroke="#d97706"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Floating Tooltip */}
        {hoverData && (
          <div
            className="absolute px-2 py-1 bg-zinc-950/95 border border-zinc-700 rounded text-[10px] font-mono pointer-events-none z-30 shadow-xl text-zinc-100"
            style={{
              left: Math.min(width - 100, Math.max(10, hoverData.x - 40)),
              top: Math.max(0, hoverData.y - 30),
            }}
          >
            {hoverData.freq >= 1000
              ? `${(hoverData.freq / 1000).toFixed(2)} kHz`
              : `${hoverData.freq} Hz`}
            : <span className="text-amber-400 font-bold">{hoverData.db > 0 ? `+${hoverData.db}` : hoverData.db} dB</span>
          </div>
        )}
      </div>
    </div>
  );
};
