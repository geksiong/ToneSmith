import React from 'react';
import { CircuitAnalysisResult } from '../types/guitar';
import { ShieldCheck, ShieldAlert, Zap, Activity, AlertTriangle, Layers, Disc, FileSpreadsheet } from 'lucide-react';

interface CircuitAnalyzerProps {
  analysis: CircuitAnalysisResult;
  onOpenReport?: () => void;
}

export const CircuitAnalyzer: React.FC<CircuitAnalyzerProps> = ({ analysis, onOpenReport }) => {
  return (
    <div className="bg-white dark:bg-zinc-900/90 border border-zinc-300 dark:border-zinc-800 rounded-xl p-3 shadow-sm dark:shadow-lg flex flex-col gap-3 transition-colors">
      {/* Header & Status Indicator */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-mono font-bold text-zinc-950 dark:text-zinc-100">REAL-TIME CIRCUIT ANALYSIS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              analysis.hasOutputSignal ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="text-[10px] font-mono text-zinc-700 dark:text-zinc-300 font-bold">
            {analysis.hasOutputSignal ? 'SIGNAL ACTIVE' : 'NO SIGNAL / OPEN'}
          </span>
        </div>
      </div>

      {/* Warnings / Issues */}
      {analysis.circuitIssues.length > 0 && (
        <div className="flex flex-col gap-1">
          {analysis.circuitIssues.map((issue, idx) => (
            <div
              key={idx}
              className="flex items-start gap-1.5 p-2 rounded bg-amber-50 dark:bg-amber-500/10 border border-amber-400 dark:border-amber-500/30 text-amber-900 dark:text-amber-300 text-[11px] font-mono font-bold"
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
              <span>{issue}</span>
            </div>
          ))}
        </div>
      )}

      {/* Core Badges Row */}
      <div className="grid grid-cols-3 gap-2">
        {/* Hum Cancellation Status */}
        <div
          className={`p-2 rounded-lg border flex flex-col justify-between ${
            analysis.isHumCancelling
              ? 'bg-emerald-100/90 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-500/40 text-emerald-950 dark:text-emerald-300'
              : 'bg-zinc-100 dark:bg-zinc-800/50 border-zinc-300 dark:border-zinc-700/60 text-zinc-800 dark:text-zinc-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-bold">
              Noise Cancel
            </span>
            {analysis.isHumCancelling ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <div className="text-xs font-mono font-black">
            {analysis.isHumCancelling ? 'HUM-CANCELLING' : '60Hz HUM PRESENT'}
          </div>
        </div>

        {/* Phase Relationship */}
        <div
          className={`p-2 rounded-lg border flex flex-col justify-between ${
            analysis.phaseRelationship === 'out-of-phase'
              ? 'bg-pink-100/90 dark:bg-pink-950/40 border-pink-400 dark:border-pink-500/50 text-pink-950 dark:text-pink-300'
              : 'bg-blue-100/90 dark:bg-blue-950/30 border-blue-400 dark:border-blue-500/40 text-blue-950 dark:text-blue-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-bold">
              Phase Alignment
            </span>
            <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-xs font-mono font-black uppercase">
            {analysis.phaseRelationship === 'out-of-phase'
              ? '⚡ OUT OF PHASE'
              : analysis.phaseRelationship === 'in-phase'
              ? '✓ IN-PHASE'
              : 'SOLO COIL'}
          </div>
        </div>

        {/* Configuration (Series vs Parallel / Split) */}
        <div className="p-2 rounded-lg border bg-zinc-100 dark:bg-zinc-800/40 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-bold">
              Coil Routing
            </span>
            <Layers className="w-3.5 h-3.5 text-cyan-700 dark:text-cyan-400" />
          </div>
          <div className="text-xs font-mono font-black uppercase text-cyan-800 dark:text-cyan-300">
            {analysis.isCoilSplit
              ? 'COIL SPLIT'
              : analysis.wiringConfiguration === 'series'
              ? 'SERIES (+4dB)'
              : analysis.wiringConfiguration === 'parallel'
              ? 'PARALLEL'
              : 'SOLO COIL'}
          </div>
        </div>
      </div>

      {/* Hum Explanation Text */}
      <div className="px-2.5 py-1.5 rounded bg-zinc-100 dark:bg-zinc-950/60 border border-zinc-300 dark:border-zinc-800 text-[10px] font-mono text-zinc-800 dark:text-zinc-300 leading-relaxed font-medium">
        {analysis.humCancellingReason}
      </div>

      {/* Selected Pickups & Coils Breakdown */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-700 dark:text-zinc-400 font-bold uppercase">
          <span>Active Coils & Magnetic Polarities ({analysis.activeCoils.length})</span>
          <span>{analysis.activePickups.length} Pickups Selected</span>
        </div>

        {analysis.activeCoils.length === 0 ? (
          <div className="text-center py-3 text-zinc-600 dark:text-zinc-400 text-[11px] font-mono bg-zinc-100 dark:bg-zinc-950/40 rounded border border-dashed border-zinc-300 dark:border-zinc-800 font-medium">
            No active coils in output path.
          </div>
        ) : (
          <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto pr-1">
            {analysis.activeCoils.map((coil, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-2.5 py-1.5 rounded bg-white dark:bg-zinc-800/60 border border-zinc-300 dark:border-zinc-700/60 text-[10px] font-mono shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <Disc className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span className="font-bold text-zinc-950 dark:text-zinc-100">{coil.pickupName}</span>
                  <span className="text-zinc-600 dark:text-zinc-400 text-[9px] font-medium">({coil.coilName})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      coil.magneticPolarity === 'North'
                        ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-900 dark:text-blue-300 border border-blue-400 dark:border-blue-500/30'
                        : 'bg-rose-100 dark:bg-rose-500/20 text-rose-900 dark:text-rose-300 border border-rose-400 dark:border-rose-500/30'
                    }`}
                  >
                    Mag: {coil.magneticPolarity}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      coil.electricalPhase === 'In-Phase'
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border border-emerald-400 dark:border-transparent'
                        : 'bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-400 dark:border-transparent'
                    }`}
                  >
                    {coil.electricalPhase}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Electrical Specifications Readout */}
      <div className="grid grid-cols-5 gap-1.5 pt-1 border-t border-zinc-200 dark:border-zinc-800/80 text-[10px] font-mono">
        <div className="p-1.5 bg-zinc-100 dark:bg-zinc-950/50 rounded border border-zinc-300 dark:border-zinc-800">
          <div className="text-zinc-600 dark:text-zinc-400 text-[9px] font-bold">DC RESISTANCE</div>
          <div className="text-zinc-950 dark:text-zinc-100 font-black">{analysis.estimatedTotalResistanceK} kΩ</div>
        </div>
        <div className="p-1.5 bg-zinc-100 dark:bg-zinc-950/50 rounded border border-zinc-300 dark:border-zinc-800">
          <div className="text-zinc-600 dark:text-zinc-400 text-[9px] font-bold">INDUCTANCE</div>
          <div className="text-zinc-950 dark:text-zinc-100 font-black">{analysis.estimatedTotalInductanceH} H</div>
        </div>
        <div className="p-1.5 bg-zinc-100 dark:bg-zinc-950/50 rounded border border-zinc-300 dark:border-zinc-800">
          <div className="text-zinc-600 dark:text-zinc-400 text-[9px] font-bold">RESONANT f₀</div>
          <div className="text-amber-800 dark:text-amber-300 font-black">{analysis.resonantFrequencyHz} Hz</div>
        </div>
        <div className="p-1.5 bg-zinc-100 dark:bg-zinc-950/50 rounded border border-zinc-300 dark:border-zinc-800">
          <div className="text-zinc-600 dark:text-zinc-400 text-[9px] font-bold">Q FACTOR</div>
          <div className="text-purple-800 dark:text-purple-300 font-black">{analysis.qFactor} (+{analysis.peakBoostDb}dB)</div>
        </div>
        <div className="p-1.5 bg-zinc-100 dark:bg-zinc-950/50 rounded border border-zinc-300 dark:border-zinc-800">
          <div className="text-zinc-600 dark:text-zinc-400 text-[9px] font-bold">TONE CUTOFF</div>
          <div className="text-cyan-800 dark:text-cyan-300 font-black">
            {analysis.effectiveToneCutoffHz >= 1000
              ? `${(analysis.effectiveToneCutoffHz / 1000).toFixed(1)}k`
              : analysis.effectiveToneCutoffHz} Hz
          </div>
        </div>
      </div>

      {/* Switch Combinations Report Action Button */}
      {onOpenReport && (
        <button
          type="button"
          onClick={onOpenReport}
          className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-mono font-bold transition-all cursor-pointer shadow-xs"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>Switching Combinations Report</span>
        </button>
      )}
    </div>
  );
};
