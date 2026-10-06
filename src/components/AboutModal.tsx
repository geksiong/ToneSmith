import React, { useState } from 'react';
import {
  X,
  Zap,
  User,
  Sliders,
  Volume2,
  BarChart3,
  Layers,
  Sparkles,
  GitBranch,
  ShieldCheck,
  CheckCircle2,
  Mail,
  Heart,
  Cpu,
  BookOpen,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPresets?: () => void;
  onOpenAnalysisReport?: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
  onOpenPresets,
  onOpenAnalysisReport,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'features' | 'guide' | 'creator' | 'tech'>('overview');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-zinc-900 dark:text-zinc-100 transition-colors animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-md shadow-amber-500/25 text-zinc-950 font-black shrink-0">
              <Zap className="w-6 h-6 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black font-mono tracking-wider text-zinc-950 dark:text-zinc-100">
                  ABOUT TONESMITH
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold border border-amber-500/30">
                  v2.0
                </span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 font-sans">
                Interactive Electric Guitar Wiring Simulator, Audio Lab & Schematic Workbench
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Close About modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: BookOpen },
            { id: 'features', label: 'Key Features', icon: Sparkles },
            { id: 'guide', label: 'Wiring Guide', icon: HelpCircle },
            { id: 'creator', label: 'Creator & Credits', icon: User },
            { id: 'tech', label: 'How It Works', icon: Cpu },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-zinc-700 hover:text-zinc-950 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 font-semibold'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm leading-relaxed">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <h3 className="font-bold font-mono text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
                    The Modern Guitarist's Virtual Workbench
                  </h3>
                  <p className="text-zinc-700 dark:text-zinc-300">
                    ToneSmith lets guitarists, luthiers, techs, and electronics hobbyists design, inspect, wire, and audition custom electric guitar circuits directly in the browser—<strong>before ever warming up a soldering iron</strong>.
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                  What Can You Do With ToneSmith?
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400 font-mono">
                      <Layers className="w-4 h-4" />
                      <span>Physical Cavity Layout</span>
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      Drag and drop authentic Strat, Tele, Les Paul, and custom components onto a realistic guitar cavity canvas with accurate terminal lugs and snap-to-pin wiring.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400 font-mono">
                      <Sliders className="w-4 h-4" />
                      <span>Interactive Switching</span>
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      Turn volume and tone knobs, flick 3-way & 5-way selector switches, pull push-pull pots, and flip pickup magnet polarities directly on the canvas.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400 font-mono">
                      <Volume2 className="w-4 h-4" />
                      <span>Real-Time Audio Testing</span>
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      Play clean DI guitar riffs or plug in your live microphone to audition the pickup resonance, treble bleed, and tone capacitor roll-off through a simulated tube amp.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400 font-mono">
                      <BarChart3 className="w-4 h-4" />
                      <span>Bode Frequency Analysis</span>
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      View an exact logarithmic 20Hz–20kHz frequency response curve, calculating resonant peak frequency, Q damping factor, and total DC resistance.
                    </p>
                  </div>
                </div>
              </div>

              {/* Creator Callout in Overview */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-amber-500/5 border border-amber-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-500 text-zinc-950 font-black flex items-center justify-center font-mono text-sm shadow-sm">
                    GS
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono block">Designed & Developed by</span>
                    <span className="text-sm font-bold text-zinc-950 dark:text-zinc-100 font-mono">Gek Siong</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('creator')}
                  className="flex items-center gap-1 text-xs font-mono font-bold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  <span>Meet the creator</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: KEY FEATURES */}
          {activeTab === 'features' && (
            <div className="space-y-4 text-xs animate-in fade-in duration-150">
              <div className="grid grid-cols-1 gap-3">
                <div className="p-3.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 space-y-1.5">
                  <h4 className="font-bold text-zinc-950 dark:text-zinc-100 font-mono text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Interactive Signal Path Tracing
                  </h4>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    ToneSmith traces active electrical connections from pickup coil terminals all the way through selector switches and potentiometers to the output jack. Inactive conductors are intelligently dimmed while active lines glow with the current wire color.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 space-y-1.5">
                  <h4 className="font-bold text-zinc-950 dark:text-zinc-100 font-mono text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Pickup Polarity, Phase & Peter Green Out-of-Phase Blues Tone
                  </h4>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Humbuckers feature interactive magnetic polarity toggle buttons ("MAG") and 4-conductor color code wiring. Flip the magnet to experience the nasal, hollow out-of-phase sound made famous by Peter Green and Gary Moore.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 space-y-1.5">
                  <h4 className="font-bold text-zinc-950 dark:text-zinc-100 font-mono text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Built-In Historic & Modern Wiring Presets
                  </h4>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Load ready-to-test schematics including Modern Stratocaster SSS, Telecaster 3-Way, Gibson Les Paul 2V2T '50s Wiring, HSS Strat with Auto Coil-Split, Jimmy Page 4-Push/Pull Mod, and Treble Bleed networks with a single click.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 space-y-1.5">
                  <h4 className="font-bold text-zinc-950 dark:text-zinc-100 font-mono text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Switch Combination Matrix & Comprehensive Analysis Report
                  </h4>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Generate an instant matrix covering every pickup switch combination and push-pull toggle permutation, reporting active pickups, tone status, hum canceling, DC resistance, and resonant frequency.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 space-y-1.5">
                  <h4 className="font-bold text-zinc-950 dark:text-zinc-100 font-mono text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Export Bill of Materials (BOM) & Printable Schematics
                  </h4>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Export high-res vector SVG schematics, copy component BOM shopping lists, check 4-conductor pickup color codes, and save/load circuit JSON files with technician notes.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WIRING GUIDE & TIPS */}
          {activeTab === 'guide' && (
            <div className="space-y-4 text-xs animate-in fade-in duration-150">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <h4 className="font-bold font-mono text-xs text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  Quick Getting Started Guide
                </h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-xs">
                  Follow these essential steps to design, wire, and test any electric guitar wiring circuit.
                </p>
              </div>

              <div className="space-y-2.5">
                {[
                  {
                    step: '1',
                    title: 'Add Parts to Canvas',
                    desc: 'Click any component in the left Component Palette (pickups, pots, blade switches, jacks, capacitors) to drop it into the cavity canvas.',
                  },
                  {
                    step: '2',
                    title: 'Snap & Draw Wires',
                    desc: 'Click on any component terminal/lug to begin a wire, then click on the target lug to complete the connection. You can pick wire colors from the toolbar.',
                  },
                  {
                    step: '3',
                    title: 'Turn Knobs & Flick Switches',
                    desc: 'Drag volume/tone knobs circularly, flick 3-way/5-way pickup switches, and click push-pull potentiometer shafts to pull them up or push down.',
                  },
                  {
                    step: '4',
                    title: 'Trace Active Signal Path',
                    desc: 'Notice how active conductors glow with their wire color while inactive or muted parts dim, visually proving how pickup current reaches the output jack.',
                  },
                  {
                    step: '5',
                    title: 'Audition in Real-Time Audio Lab',
                    desc: 'Toggle the Audio Lab looper to hear clean DI guitar riffs filtered by your circuit, or enable your microphone to speak/sing through your pickup model!',
                  },
                  {
                    step: '6',
                    title: 'Export Schematic & BOM',
                    desc: 'Click "Export Schematic" to generate printable wiring sheets, step-by-step soldering directions, and a Bill of Materials shopping list.',
                  },
                ].map(({ step, title, desc }) => (
                  <div
                    key={step}
                    className="p-3 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 flex items-start gap-3"
                  >
                    <span className="w-6 h-6 rounded-lg bg-amber-500 text-zinc-950 font-black font-mono flex items-center justify-center shrink-0 text-xs">
                      {step}
                    </span>
                    <div>
                      <h5 className="font-bold text-zinc-950 dark:text-zinc-100 font-mono text-xs">{title}</h5>
                      <p className="text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: CREATOR & CREDITS */}
          {activeTab === 'creator' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Creator Hero Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-zinc-100 dark:to-zinc-800/50 border border-amber-500/30 flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-zinc-950 font-black flex items-center justify-center font-mono text-2xl shadow-lg shadow-amber-500/25 shrink-0">
                  GS
                </div>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h3 className="text-lg font-black font-mono text-zinc-950 dark:text-zinc-100">
                      Gek Siong
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold border border-amber-500/40">
                      Creator & Lead Engineer
                    </span>
                  </div>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300">
                    Creator and engineer of <strong>ToneSmith</strong>. Built with a passion for electric guitar tone physics, audio engineering, and intuitive visual simulation tools for musicians and luthiers worldwide.
                  </p>
                  <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs font-mono">
                    <a
                      href="mailto:geksiong@gmail.com"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-400 transition-colors shadow-xs"
                    >
                      <Mail className="w-3.5 h-3.5 text-amber-500" />
                      <span>geksiong@gmail.com</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Creator Statement */}
              <div className="p-4 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-2 text-xs">
                <h4 className="font-bold font-mono text-zinc-950 dark:text-zinc-100 flex items-center gap-2 uppercase tracking-wide">
                  <Heart className="w-3.5 h-3.5 text-rose-500 fill-current" />
                  Why ToneSmith Was Created
                </h4>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  "Guitar wiring is often shrouded in mystery, conflicting forum advice, and trial-and-error soldering. Many players want to try a 4-conductor coil split, a '50s wiring mod, or out-of-phase wiring, but are unsure how the signal path actually flows or how pot resistance affects pickup resonant peaks.
                </p>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  ToneSmith was built to remove the guesswork—combining real-time circuit physics, live Web Audio RLC simulation, and an intuitive virtual breadboard canvas so anyone can confidently craft their dream guitar tone."
                </p>
                <div className="pt-1 text-right font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  — Gek Siong
                </div>
              </div>

              {/* Acknowledgements */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <span className="font-mono font-bold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Acoustic & Electrical Models
                  </span>
                  <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                    Pickup RLC inductance and Bode transfer functions based on Donald Brosnac, Helmuth Lemme, and classic guitar electronics literature.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <span className="font-mono font-bold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Color Code Database
                  </span>
                  <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                    4-Conductor humbucker color mappings verified against official Seymour Duncan, DiMarzio, Gibson, and Fender specifications.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: HOW IT WORKS */}
          {activeTab === 'tech' && (
            <div className="space-y-4 text-xs animate-in fade-in duration-150">
              <div className="p-3.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 space-y-1.5">
                <h4 className="font-bold text-zinc-950 dark:text-zinc-100 font-mono text-xs flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-amber-500" />
                  1. Graph-Theoretic Circuit Analysis
                </h4>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Components and wire splices form a directed electrical graph. ToneSmith traverses paths from the active audio jack tip and sleeve, checking switch contacts, pot wiper positions, and pickup coil loops to discover complete closed circuits and identify shorts or floating ground paths.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 space-y-1.5">
                <h4 className="font-bold text-zinc-950 dark:text-zinc-100 font-mono text-xs flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-500" />
                  2. RLC Resonant Frequency Modeling
                </h4>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Pickups are modeled as second-order RLC resonators with inductance (L in Henries), internal DC resistance (R in kΩ), and parasitic winding capacitance (C in pF) combined with guitar cable capacitance (~500pF–700pF) and amp input resistance (1 MΩ). The resonant peak frequency is computed using:
                </p>
                <div className="p-2 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono text-[11px] text-amber-600 dark:text-amber-400 text-center font-bold">
                  f_res = 1 / (2π · √(L · C_total))
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 space-y-1.5">
                <h4 className="font-bold text-zinc-950 dark:text-zinc-100 font-mono text-xs flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-amber-500" />
                  3. Real-Time Web Audio DSP Filter Cascade
                </h4>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  The audio engine dynamically reconfigures native Web Audio API BiquadFilterNodes (peaking and low-pass filters), GainNodes, and waveshaper distortion curves in real-time as you drag knobs or flip switches, providing instant auditory feedback without latency.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-600 dark:text-zinc-400">
            <span>Created by</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">Gek Siong</span>
            <span>•</span>
            <a
              href="mailto:geksiong@gmail.com"
              className="text-amber-600 dark:text-amber-400 hover:underline"
            >
              geksiong@gmail.com
            </a>
          </div>

          <div className="flex items-center gap-2">
            {onOpenPresets && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPresets();
                }}
                className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 text-xs font-mono font-bold transition-all cursor-pointer hidden sm:inline-flex"
              >
                Browse Presets
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-mono font-bold transition-all shadow-md shadow-amber-500/20 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
