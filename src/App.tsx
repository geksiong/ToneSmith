import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CircuitComponent, CircuitState, Wire, WireColor, WiringPreset } from './types/guitar';
import { WIRING_PRESETS } from './lib/presets';
import { analyzeCircuit, computeSignalPath } from './lib/circuitEngine';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { CircuitAnalyzer } from './components/CircuitAnalyzer';
import { FrequencyResponsePlot } from './components/FrequencyResponsePlot';
import { AudioPanel } from './components/AudioPanel';
import { ComponentLibrary } from './components/ComponentLibrary';
import { PresetSelector } from './components/PresetSelector';
import { ExportModal } from './components/ExportModal';
import { AnalysisReportModal } from './components/AnalysisReportModal';
import { ComponentEditModal } from './components/ComponentEditModal';
import { AboutModal } from './components/AboutModal';
import { TechnicianNotesPanel } from './components/TechnicianNotesPanel';
import {
  Activity,
  Volume2,
  HelpCircle,
  BarChart3,
  PanelRightClose,
  PanelRightOpen,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  RotateCcw,
  FileEdit,
} from 'lucide-react';

const STORAGE_KEY = 'tonesmith_circuit_state_v2';

export default function App() {
  // Load initial preset (Modern Strat SSS)
  const defaultPreset = WIRING_PRESETS[0];

  const [state, setState] = useState<CircuitState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.components && parsed.wires) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not restore from localStorage:', e);
    }
    return {
      components: defaultPreset.components,
      wires: defaultPreset.wires,
    };
  });

  const [activePreset, setActivePreset] = useState<WiringPreset | undefined>(defaultPreset);

  // Collapsible Sidebars
  const [isLeftCollapsed, setIsLeftCollapsed] = useState<boolean>(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState<boolean>(false);

  // Theme state: dark | light
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const savedTheme = localStorage.getItem('tonesmith_theme');
      if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
    } catch (e) {}
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    localStorage.setItem('tonesmith_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  // Interactive Play Mode vs Edit & Wire Mode
  const [isInteractiveMode, setIsInteractiveMode] = useState<boolean>(false);

  // Signal Path Trace Mode (highlights active path from pickups to audio jack, dimming inactive parts)
  const [showSignalPath, setShowSignalPath] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('tonesmith_show_signal_path');
      if (saved !== null) return JSON.parse(saved);
    } catch (e) {}
    return true; // enabled by default so the signal path feature is immediately active
  });

  useEffect(() => {
    try {
      localStorage.setItem('tonesmith_show_signal_path', JSON.stringify(showSignalPath));
    } catch (e) {}
  }, [showSignalPath]);

  const handleToggleSignalPath = useCallback(() => {
    setShowSignalPath((prev) => !prev);
  }, []);

  // Undo / Redo History
  const [history, setHistory] = useState<CircuitState[]>([state]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Active selections & tools
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [activeWireColor, setActiveWireColor] = useState<WireColor>('#eab308');

  // Right Sidebar Analysis Tab
  const [rightTab, setRightTab] = useState<'overview' | 'audio' | 'frequency' | 'notes'>('overview');

  const handleUpdateTechnicianNotes = useCallback((notes: string) => {
    setState((prev) => ({ ...prev, technicianNotes: notes }));
  }, []);

  // Modals
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isAnalysisReportOpen, setIsAnalysisReportOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    const timer = setTimeout(() => {
      setToast((cur) => (cur?.message === message ? null : cur));
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  // Audition switch and push/pull combination handler
  const handleApplySwitchCombination = useCallback(
    (updates: { id: string; properties: Partial<CircuitComponent['properties']> }[]) => {
      setState((prev) => {
        const nextComponents = prev.components.map((c) => {
          const u = updates.find((item) => item.id === c.id);
          return u ? { ...c, properties: { ...c.properties, ...u.properties } } : c;
        });
        return { ...prev, components: nextComponents };
      });
      showToast('Switches and push/pull pots updated on canvas!', 'info');
    },
    [showToast]
  );

  // Save to localStorage on state changes (debounced to avoid blocking main thread)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        console.warn('Failed to save state to localStorage:', e);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [state]);

  // Push to history helper
  const pushState = useCallback((newState: CircuitState) => {
    setState(newState);
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, newState];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  // Undo / Redo handlers
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    const newIdx = historyIndex - 1;
    setHistoryIndex(newIdx);
    setState(history[newIdx]);
    setSelectedComponentId(null);
    setSelectedWireId(null);
  }, [canUndo, historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    const newIdx = historyIndex + 1;
    setHistoryIndex(newIdx);
    setState(history[newIdx]);
    setSelectedComponentId(null);
    setSelectedWireId(null);
  }, [canRedo, historyIndex, history]);

  // Keyboard undo/redo shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Component Updates
  const handleUpdateComponent = useCallback((id: string, updates: Partial<CircuitComponent>) => {
    setState((prev) => {
      const nextComponents = prev.components.map((c) =>
        c.id === id ? { ...c, ...updates, properties: { ...c.properties, ...updates.properties } } : c
      );
      return { ...prev, components: nextComponents };
    });
  }, []);

  // Component Add
  const handleAddComponent = useCallback((comp: CircuitComponent) => {
    const nextState: CircuitState = {
      ...state,
      components: [...state.components, comp],
    };
    pushState(nextState);
    setSelectedComponentId(comp.id);
    setIsInteractiveMode(false); // Switch to edit mode so user can wire up the component
  }, [state, pushState]);

  // Component Delete
  const handleDeleteComponent = useCallback((id: string) => {
    const nextState: CircuitState = {
      components: state.components.filter((c) => c.id !== id),
      wires: state.wires.filter((w) => w.fromComponentId !== id && w.toComponentId !== id),
    };
    pushState(nextState);
    setSelectedComponentId(null);
  }, [state, pushState]);

  // Wire Add
  const handleAddWire = useCallback((wire: Wire) => {
    const nextState: CircuitState = {
      ...state,
      wires: [...state.wires, wire],
    };
    pushState(nextState);
  }, [state, pushState]);

  // Wire Delete
  const handleDeleteWire = useCallback((wireId: string) => {
    const nextState: CircuitState = {
      ...state,
      wires: state.wires.filter((w) => w.id !== wireId),
    };
    pushState(nextState);
    setSelectedWireId(null);
  }, [state, pushState]);

  // Wire Update (Color, path, etc.)
  const handleUpdateWire = useCallback((wireId: string, updates: Partial<Wire>) => {
    const nextState: CircuitState = {
      ...state,
      wires: state.wires.map((w) => (w.id === wireId ? { ...w, ...updates } : w)),
    };
    pushState(nextState);
    if (updates.color) {
      setActiveWireColor(updates.color);
    }
  }, [state, pushState]);

  // Currently selected wire object
  const selectedWire = useMemo(() => {
    return state.wires.find((w) => w.id === selectedWireId) ?? null;
  }, [state.wires, selectedWireId]);

  // Clear Canvas
  const handleClearCanvas = () => {
    if (state.components.length === 0 && state.wires.length === 0) {
      showToast('Canvas is already empty', 'info');
      return;
    }
    setIsClearConfirmOpen(true);
  };

  const handleExecuteClearCanvas = () => {
    const nextState: CircuitState = { components: [], wires: [] };
    pushState(nextState);
    setSelectedComponentId(null);
    setSelectedWireId(null);
    setActivePreset(undefined);
    setIsClearConfirmOpen(false);
    showToast('Canvas cleared. Press Ctrl+Z to undo.', 'info');
  };

  // Load Preset
  const handleSelectPreset = (preset: WiringPreset) => {
    const nextState: CircuitState = {
      components: JSON.parse(JSON.stringify(preset.components)),
      wires: JSON.parse(JSON.stringify(preset.wires)),
    };
    pushState(nextState);
    setActivePreset(preset);
    setSelectedComponentId(null);
    setSelectedWireId(null);
  };

  // Import JSON
  const handleImportJson = (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed.components) && Array.isArray(parsed.wires)) {
        pushState(parsed);
        setSelectedComponentId(null);
        setSelectedWireId(null);
        showToast('Schematic imported successfully!', 'success');
      } else {
        showToast('Invalid guitar schematic JSON format.', 'error');
      }
    } catch (e) {
      showToast('Error parsing JSON file.', 'error');
    }
  };

  // Delete Selected Item
  const handleDeleteSelected = () => {
    if (selectedWireId) {
      handleDeleteWire(selectedWireId);
    } else if (selectedComponentId) {
      handleDeleteComponent(selectedComponentId);
    }
  };

  // Real-time Circuit Analysis
  const analysis = useMemo(() => {
    return analyzeCircuit(state);
  }, [state]);

  // Real-time Signal Path Info (Active wires and components from pickups to audio jack)
  const signalPathInfo = useMemo(() => {
    return computeSignalPath(state);
  }, [state]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-stone-100 dark:bg-[#121110] text-stone-900 dark:text-stone-100 font-sans transition-colors duration-150 print:h-auto print:w-auto print:overflow-visible print:bg-white">
      {/* Top Main Toolbar with high stacking context */}
      <div className="relative z-50 shrink-0 print:hidden">
        <Toolbar
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          activeWireColor={activeWireColor}
          onSelectWireColor={(color) => {
            setActiveWireColor(color);
            if (selectedWireId) {
              handleUpdateWire(selectedWireId, { color });
            }
          }}
          selectedWire={selectedWire}
          onChangeSelectedWireColor={(color) => {
            if (selectedWireId) {
              handleUpdateWire(selectedWireId, { color });
            } else {
              setActiveWireColor(color);
            }
          }}
          onOpenPresets={() => setIsPresetsOpen(true)}
          onSelectPresetDirect={handleSelectPreset}
          onOpenExport={() => setIsExportOpen(true)}
          onOpenAnalysisReport={() => setIsAnalysisReportOpen(true)}
          onOpenNotes={() => {
            setRightTab('notes');
            setIsRightCollapsed(false);
          }}
          onOpenAbout={() => setIsAboutOpen(true)}
          onClearCanvas={handleClearCanvas}
          onImportJson={handleImportJson}
          selectedComponentId={selectedComponentId}
          selectedWireId={selectedWireId}
          onDeleteSelected={handleDeleteSelected}
          onEditSelectedComponent={() => {
            if (selectedComponentId) setEditingComponentId(selectedComponentId);
          }}
          isInteractiveMode={isInteractiveMode}
          onToggleInteractiveMode={() => setIsInteractiveMode(!isInteractiveMode)}
          showSignalPath={showSignalPath}
          onToggleSignalPath={handleToggleSignalPath}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenHelp={() => setShowHelp(true)}
        />
      </div>

      {/* Main Workspace: Collapsible Left Palette + Center Canvas + Collapsible Right Analysis */}
      <div className="flex-1 flex overflow-hidden relative print:hidden">
        {/* LEFT SIDE: Collapsible Components Palette */}
        <ComponentLibrary
          onAddComponent={handleAddComponent}
          isCollapsed={isLeftCollapsed}
          onToggleCollapse={() => setIsLeftCollapsed(!isLeftCollapsed)}
          theme={theme}
        />

        {/* CENTER: Interactive Circuit Board & Cavity Canvas */}
        <div className="flex-1 h-full relative overflow-hidden bg-stone-100 dark:bg-[#141210]">
          <Canvas
            state={state}
            selectedComponentId={selectedComponentId}
            selectedWireId={selectedWireId}
            activeWireColor={activeWireColor}
            isInteractiveMode={isInteractiveMode}
            onToggleInteractiveMode={() => setIsInteractiveMode(!isInteractiveMode)}
            showSignalPath={showSignalPath}
            signalPathInfo={signalPathInfo}
            onToggleSignalPath={handleToggleSignalPath}
            onSelectComponent={(id) => {
              setSelectedComponentId(id);
              if (id) setSelectedWireId(null);
            }}
            onSelectWire={(id) => {
              setSelectedWireId(id);
              if (id) {
                setSelectedComponentId(null);
                const wire = state.wires.find((w) => w.id === id);
                if (wire) {
                  setActiveWireColor(wire.color);
                }
              }
            }}
            onOpenEditComponent={(id) => {
              setSelectedComponentId(id);
              setSelectedWireId(null);
              setEditingComponentId(id);
            }}
            onUpdateComponent={handleUpdateComponent}
            onUpdateWire={handleUpdateWire}
            onAddWire={handleAddWire}
            onDeleteWire={handleDeleteWire}
            onDeleteComponent={handleDeleteComponent}
            theme={theme}
          />

          {/* Clean Quick Help Modal */}
          {showHelp && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
              onClick={() => setShowHelp(false)}
            >
              <div
                className="w-full max-w-lg p-5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-2xl font-mono text-xs text-stone-800 dark:text-stone-300 flex flex-col gap-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="font-bold text-amber-700 dark:text-amber-400 tracking-wider">
                      LUTHIER WORKBENCH QUICK GUIDE
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowHelp(false)}
                    className="p-1 rounded text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <ul className="space-y-2 text-xs list-disc list-inside text-stone-700 dark:text-stone-300 font-sans leading-relaxed">
                  <li><strong className="font-mono text-stone-950 dark:text-stone-100">Add Components:</strong> Search or click any component from the left palette to drop it into the guitar cavity.</li>
                  <li><strong className="font-mono text-stone-950 dark:text-stone-100">Wiring Terminals:</strong> Click on any solder lug, then click the destination lug to route a vintage cloth wire.</li>
                  <li><strong className="font-mono text-stone-950 dark:text-stone-100">Change Wire Color:</strong> Click any wire to open the inline swatch palette and change cloth colors.</li>
                  <li><strong className="font-mono text-stone-950 dark:text-stone-100">Interactive Knobs:</strong> Turn pot shafts, flip blade/toggle switches, or pull up push-pull pots in real time.</li>
                  <li><strong className="font-mono text-stone-950 dark:text-stone-100">Audio Testing:</strong> Open the <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">Audio Lab</span> tab on the right to audition clean DI strat loops, blues riffs, or your live microphone.</li>
                  <li><strong className="font-mono text-stone-950 dark:text-stone-100">Bode Analysis:</strong> Switch to the <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">Bode</span> tab to see live resonant frequency peaks and high-frequency roll-off curves.</li>
                  <li><strong className="font-mono text-stone-950 dark:text-stone-100">Signal Path Trace:</strong> Toggle the Signal Path tool in the bottom dock to illuminate the active signal route to the output jack.</li>
                </ul>
                <div className="pt-2 border-t border-stone-200 dark:border-stone-800 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowHelp(false)}
                    className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs font-mono transition-colors"
                  >
                    Got it
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SIDE: Collapsible Real-Time Circuit Analysis & Audio Lab */}
        {isRightCollapsed ? (
          <aside className="w-12 h-full border-l border-stone-200 dark:border-stone-800/80 bg-white/95 dark:bg-[#151210]/95 backdrop-blur flex flex-col items-center py-3 z-20 shrink-0 shadow-lg select-none transition-all">
            {/* Expand button */}
            <button
              type="button"
              onClick={() => setIsRightCollapsed(false)}
              title="Expand Analysis & Audio Lab"
              className="p-2 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-800/80 dark:hover:bg-stone-700 text-amber-600 dark:text-amber-400 transition-colors shadow-xs"
            >
              <PanelRightOpen className="w-4 h-4" />
            </button>

            <div className="w-5 h-[1px] bg-stone-200 dark:bg-stone-800 my-3" />

            {/* Quick status icons */}
            <div className="flex flex-col gap-2.5 items-center">
              <button
                type="button"
                onClick={() => {
                  setRightTab('overview');
                  setIsRightCollapsed(false);
                }}
                title="Analysis"
                className={`p-2 rounded-lg transition-colors ${
                  rightTab === 'overview'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <Activity className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setRightTab('frequency');
                  setIsRightCollapsed(false);
                }}
                title="Bode Plot"
                className={`p-2 rounded-lg transition-colors ${
                  rightTab === 'frequency'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setRightTab('audio');
                  setIsRightCollapsed(false);
                }}
                title="Audio Lab"
                className={`p-2 rounded-lg transition-colors ${
                  rightTab === 'audio'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <Volume2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setRightTab('notes');
                  setIsRightCollapsed(false);
                }}
                title="Technician Notes"
                className={`p-2 rounded-lg transition-colors ${
                  rightTab === 'notes'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <FileEdit className="w-4 h-4" />
              </button>
            </div>

            {/* Signal Active Indicator Dot */}
            <div className="mt-auto py-3 flex flex-col items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  analysis.hasOutputSignal ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
                title={analysis.hasOutputSignal ? 'Circuit complete: Signal reaching output jack' : 'Open circuit: No signal'}
              />
              <span
                className="text-[9px] font-mono text-stone-400 tracking-widest uppercase cursor-pointer hover:text-stone-700 dark:hover:text-stone-300"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                onClick={() => setIsRightCollapsed(false)}
              >
                INSPECTOR
              </span>
            </div>
          </aside>
        ) : (
          <aside className="w-[450px] xl:w-[470px] h-full border-l border-stone-200 dark:border-stone-800/80 bg-white/95 dark:bg-[#161311]/95 backdrop-blur flex flex-col z-20 shrink-0 select-none shadow-xl overflow-hidden transition-all">
            {/* Right Header with Filter Tabs and Collapse Button */}
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800/80 p-2 bg-stone-50 dark:bg-stone-950/40 gap-1">
              <div className="flex items-center gap-1 flex-1 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setRightTab('overview')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-md text-xs font-mono transition-colors cursor-pointer whitespace-nowrap ${
                    rightTab === 'overview'
                      ? 'bg-white dark:bg-stone-800 text-stone-950 dark:text-white font-bold shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Analysis</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRightTab('frequency')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-md text-xs font-mono transition-colors cursor-pointer whitespace-nowrap ${
                    rightTab === 'frequency'
                      ? 'bg-white dark:bg-stone-800 text-stone-950 dark:text-white font-bold shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Bode</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRightTab('audio')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-md text-xs font-mono transition-colors cursor-pointer whitespace-nowrap ${
                    rightTab === 'audio'
                      ? 'bg-white dark:bg-stone-800 text-stone-950 dark:text-white font-bold shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Audio</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRightTab('notes')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-md text-xs font-mono transition-colors cursor-pointer whitespace-nowrap ${
                    rightTab === 'notes'
                      ? 'bg-white dark:bg-stone-800 text-stone-950 dark:text-white font-bold shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  <FileEdit className="w-3.5 h-3.5" />
                  <span>Notes</span>
                </button>
              </div>

              {/* Collapse Right Panel Button */}
              <button
                type="button"
                onClick={() => setIsRightCollapsed(true)}
                title="Collapse Panel"
                className="p-1 rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer shrink-0"
              >
                <PanelRightClose className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Right Tab Content - Focused Single-View Per Active Tab */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
              {rightTab === 'overview' && (
                <CircuitAnalyzer analysis={analysis} onOpenReport={() => setIsAnalysisReportOpen(true)} />
              )}

              {rightTab === 'frequency' && (
                <FrequencyResponsePlot analysis={analysis} />
              )}

              {rightTab === 'audio' && (
                <AudioPanel analysis={analysis} />
              )}

              {rightTab === 'notes' && (
                <TechnicianNotesPanel
                  notes={state.technicianNotes}
                  onChangeNotes={handleUpdateTechnicianNotes}
                  components={state.components}
                  wiresCount={state.wires.length}
                  activePresetName={activePreset?.name}
                />
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Preset Wiring Diagrams Modal */}
      <PresetSelector
        isOpen={isPresetsOpen}
        onClose={() => setIsPresetsOpen(false)}
        onSelectPreset={handleSelectPreset}
        currentPresetId={activePreset?.id}
      />

      {/* Export Schematic & BOM Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        state={state}
        activePreset={activePreset}
        theme={theme}
      />

      {/* Switching Combinations Analysis Report Modal */}
      <AnalysisReportModal
        isOpen={isAnalysisReportOpen}
        onClose={() => setIsAnalysisReportOpen(false)}
        state={state}
        activePreset={activePreset}
        onApplyCombination={handleApplySwitchCombination}
      />

      {/* About ToneSmith & Creator Modal */}
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
        onOpenPresets={() => {
          setIsAboutOpen(false);
          setIsPresetsOpen(true);
        }}
        onOpenAnalysisReport={() => {
          setIsAboutOpen(false);
          setIsAnalysisReportOpen(true);
        }}
      />

      {/* Component Edit Specs & Name Pop-up Dialog */}
      {editingComponentId && (
        <ComponentEditModal
          isOpen={true}
          component={state.components.find((c) => c.id === editingComponentId) ?? null}
          onClose={() => setEditingComponentId(null)}
          onSave={(id, updates) => {
            handleUpdateComponent(id, updates);
          }}
          onDelete={(id) => {
            handleDeleteComponent(id);
            setEditingComponentId(null);
            setSelectedComponentId(null);
          }}
        />
      )}

      {/* Clear Canvas Confirmation Modal */}
      {isClearConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsClearConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-6 flex flex-col gap-4 text-zinc-900 dark:text-zinc-100"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-full bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Clear Canvas Cavity?
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1.5 leading-relaxed">
                  This will remove all{' '}
                  <strong className="text-zinc-900 dark:text-zinc-200">
                    {state.components.length} component{state.components.length === 1 ? '' : 's'}
                  </strong>{' '}
                  and{' '}
                  <strong className="text-zinc-900 dark:text-zinc-200">
                    {state.wires.length} wire{state.wires.length === 1 ? '' : 's'}
                  </strong>{' '}
                  from the cavity canvas.
                </p>
                <div className="mt-2.5 px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/50 flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                  <RotateCcw className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>
                    Don't worry — you can undo this anytime using{' '}
                    <kbd className="px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono text-[10px] text-zinc-800 dark:text-zinc-200">
                      Ctrl+Z
                    </kbd>{' '}
                    or the Undo button.
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsClearConfirmOpen(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteClearCanvas}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Canvas</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-xl border text-xs font-medium backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-3 bg-white/95 dark:bg-zinc-900/95 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 pointer-events-none">
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
          {toast.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />}
          {toast.type === 'info' && <RotateCcw className="w-4 h-4 text-amber-500 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
