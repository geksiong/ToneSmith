import React, { useRef, useState, useEffect } from 'react';
import { Wire, WireColor, WiringPreset } from '../types/guitar';
import { WIRING_PRESETS } from '../lib/presets';
import { guitarAudio } from '../lib/audioEngine';
import {
  Undo2,
  Redo2,
  Trash2,
  Download,
  BookOpen,
  FolderOpen,
  RotateCcw,
  Sun,
  Moon,
  Square,
  FileSpreadsheet,
  HelpCircle,
  FileEdit,
  ChevronDown,
  Printer,
  Sparkles,
  Zap,
  Sliders,
  Check,
  Compass,
  Palette,
} from 'lucide-react';

interface ToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  activeWireColor: WireColor;
  onSelectWireColor: (color: WireColor) => void;
  onOpenPresets: () => void;
  onSelectPresetDirect?: (preset: WiringPreset) => void;
  onOpenExport: () => void;
  onOpenAnalysisReport?: () => void;
  onOpenNotes?: () => void;
  onOpenAbout?: () => void;
  onClearCanvas: () => void;
  onImportJson: (json: string) => void;
  selectedComponentId: string | null;
  selectedWireId: string | null;
  selectedWire?: Wire | null;
  onDeleteSelected: () => void;
  onEditSelectedComponent?: () => void;
  onChangeSelectedWireColor?: (color: WireColor) => void;
  isInteractiveMode?: boolean;
  onToggleInteractiveMode?: () => void;
  showSignalPath?: boolean;
  onToggleSignalPath?: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  onResetView?: () => void;
  onOpenHelp?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  activeWireColor,
  onSelectWireColor,
  onOpenPresets,
  onSelectPresetDirect,
  onOpenExport,
  onOpenAnalysisReport,
  onOpenNotes,
  onOpenAbout,
  onClearCanvas,
  onImportJson,
  selectedComponentId,
  selectedWireId,
  selectedWire,
  onDeleteSelected,
  isInteractiveMode = false,
  onToggleInteractiveMode,
  showSignalPath = false,
  onToggleSignalPath,
  theme = 'dark',
  onToggleTheme,
  onResetView,
  onOpenHelp,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(() => guitarAudio.isRiffPlaying);
  const [openMenu, setOpenMenu] = useState<'file' | 'presets' | 'tools' | 'view' | null>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  // Subscribe to audio state
  useEffect(() => {
    return guitarAudio.subscribe(() => {
      setIsAudioPlaying(guitarAudio.isRiffPlaying);
    });
  }, []);

  // Close menus on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onImportJson(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
    setOpenMenu(null);
  };

  const handlePrint = () => {
    setOpenMenu(null);
    window.print();
  };

  const toggleMenu = (menu: 'file' | 'presets' | 'tools' | 'view') => {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  };

  // Popular quick presets for the dropdown menu
  const quickPresets = WIRING_PRESETS.slice(0, 7);

  return (
    <header className="h-13 border-b border-stone-200 dark:border-stone-800/80 bg-white/95 dark:bg-[#151210]/95 backdrop-blur px-4 flex items-center justify-between select-none relative z-50 transition-colors shadow-xs">
      {/* ZONE 1: Brand & Luthier Wordmark */}
      <div className="flex items-center gap-6 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-md shadow-amber-500/20 text-stone-950 font-black">
            <Zap className="w-4 h-4 fill-current" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-black font-mono tracking-wider text-stone-900 dark:text-stone-100">
              TONESMITH
            </span>
            <span className="text-[10px] font-mono tracking-widest uppercase text-amber-700 dark:text-amber-400 font-semibold hidden sm:inline">
              LUTHIER LAB
            </span>
          </div>
        </div>

        {/* ZONE 2: Streamlined Desktop Menu Bar */}
        <nav
          ref={menuContainerRef}
          aria-label="Workbench actions"
          className="flex items-center gap-0.5 text-xs font-medium text-stone-700 dark:text-stone-300 relative"
        >
          {/* FILE MENU */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleMenu('file')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800/80 hover:text-stone-950 dark:hover:text-white transition-colors cursor-pointer ${
                openMenu === 'file' ? 'bg-stone-100 dark:bg-stone-800 text-stone-950 dark:text-white font-semibold' : ''
              }`}
            >
              <span>File</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {openMenu === 'file' && (
              <div className="absolute top-full left-0 mt-1.5 w-60 py-1.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    onClearCanvas();
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2 text-xs text-left hover:bg-stone-100 dark:hover:bg-stone-800/80 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>New / Clear Cavity</span>
                  </span>
                  <span className="text-[10px] font-mono text-stone-400">Ctrl+Z to undo</span>
                </button>

                <div className="h-[1px] bg-stone-100 dark:bg-stone-800 my-1" />

                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    fileInputRef.current?.click();
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2 text-xs text-left hover:bg-stone-100 dark:hover:bg-stone-800/80 text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <FolderOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Import JSON Circuit...</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    onOpenExport();
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2 text-xs text-left hover:bg-stone-100 dark:hover:bg-stone-800/80 text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Download className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Export Schematic & BOM...</span>
                  </span>
                </button>

                <div className="h-[1px] bg-stone-100 dark:bg-stone-800 my-1" />

                <button
                  type="button"
                  onClick={handlePrint}
                  className="w-full flex items-center justify-between px-3.5 py-2 text-xs text-left hover:bg-stone-100 dark:hover:bg-stone-800/80 text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Printer className="w-3.5 h-3.5 text-stone-500" />
                    <span>Print Schematic</span>
                  </span>
                  <span className="text-[10px] font-mono text-stone-400">Ctrl+P</span>
                </button>
              </div>
            )}
          </div>

          {/* PRESETS MENU */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleMenu('presets')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800/80 hover:text-stone-950 dark:hover:text-white transition-colors cursor-pointer ${
                openMenu === 'presets' ? 'bg-stone-100 dark:bg-stone-800 text-stone-950 dark:text-white font-semibold' : ''
              }`}
            >
              <span>Presets</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {openMenu === 'presets' && (
              <div className="absolute top-full left-0 mt-1.5 w-72 py-1.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3.5 py-1 text-[10px] font-mono uppercase tracking-wider text-stone-400 font-bold">
                  Standard Guitar Wirings
                </div>
                {quickPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      if (onSelectPresetDirect) {
                        onSelectPresetDirect(preset);
                      } else {
                        onOpenPresets();
                      }
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2 text-xs text-left hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-400 text-stone-800 dark:text-stone-200 transition-colors"
                  >
                    <span className="truncate">{preset.name}</span>
                    <span className="text-[10px] font-mono text-stone-400 shrink-0 ml-2">{preset.category}</span>
                  </button>
                ))}

                <div className="h-[1px] bg-stone-100 dark:bg-stone-800 my-1" />

                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    onOpenPresets();
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-stone-100 dark:hover:bg-stone-800/80 text-left transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Browse All 14 Presets...</span>
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* TOOLS MENU */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleMenu('tools')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800/80 hover:text-stone-950 dark:hover:text-white transition-colors cursor-pointer ${
                openMenu === 'tools' ? 'bg-stone-100 dark:bg-stone-800 text-stone-950 dark:text-white font-semibold' : ''
              }`}
            >
              <span>Tools</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {openMenu === 'tools' && (
              <div className="absolute top-full left-0 mt-1.5 w-68 py-1.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                {onOpenAnalysisReport && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      onOpenAnalysisReport();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-left hover:bg-stone-100 dark:hover:bg-stone-800/80 text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Switching Combinations Matrix</span>
                  </button>
                )}

                {onOpenNotes && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      onOpenNotes();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-left hover:bg-stone-100 dark:hover:bg-stone-800/80 text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white transition-colors"
                  >
                    <FileEdit className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Technician Notes & Bench Log</span>
                  </button>
                )}

                <div className="h-[1px] bg-stone-100 dark:bg-stone-800 my-1" />

                {onOpenAbout && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      onOpenAbout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-left hover:bg-stone-100 dark:hover:bg-stone-800/80 text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white transition-colors"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-stone-400" />
                    <span>About ToneSmith Workbench</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* VIEW MENU */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleMenu('view')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800/80 hover:text-stone-950 dark:hover:text-white transition-colors cursor-pointer ${
                openMenu === 'view' ? 'bg-stone-100 dark:bg-stone-800 text-stone-950 dark:text-white font-semibold' : ''
              }`}
            >
              <span>View</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {openMenu === 'view' && (
              <div className="absolute top-full left-0 mt-1.5 w-60 py-1.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                {onToggleSignalPath && (
                  <button
                    type="button"
                    onClick={() => {
                      onToggleSignalPath();
                      setOpenMenu(null);
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2 text-xs text-left hover:bg-stone-100 dark:hover:bg-stone-800/80 text-stone-700 dark:text-stone-300 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span>Signal Path Trace</span>
                    </span>
                    {showSignalPath && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                  </button>
                )}

                {onToggleInteractiveMode && (
                  <button
                    type="button"
                    onClick={() => {
                      onToggleInteractiveMode();
                      setOpenMenu(null);
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2 text-xs text-left hover:bg-stone-100 dark:hover:bg-stone-800/80 text-stone-700 dark:text-stone-300 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Sliders className="w-3.5 h-3.5 text-blue-500" />
                      <span>Interactive Play Mode</span>
                    </span>
                    {isInteractiveMode && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                  </button>
                )}

                <div className="h-[1px] bg-stone-100 dark:bg-stone-800 my-1" />

                {onResetView && (
                  <button
                    type="button"
                    onClick={() => {
                      onResetView();
                      setOpenMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-left hover:bg-stone-100 dark:hover:bg-stone-800/80 text-stone-700 dark:text-stone-300 transition-colors"
                  >
                    <Compass className="w-3.5 h-3.5 text-stone-400" />
                    <span>Reset Cavity View (100%)</span>
                  </button>
                )}

                {onOpenHelp && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenHelp();
                      setOpenMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-left hover:bg-stone-100 dark:hover:bg-stone-800/80 text-stone-700 dark:text-stone-300 transition-colors"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-stone-400" />
                    <span>Wiring Guide & Shortcuts</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* ZONE 3: Primary Action & Tools */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 bg-stone-100 dark:bg-stone-900/90 p-0.5 rounded-lg border border-stone-200 dark:border-stone-800">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className={`p-1.5 rounded transition-all ${
              canUndo
                ? 'text-stone-800 dark:text-stone-200 hover:text-stone-950 dark:hover:text-white hover:bg-stone-200 dark:hover:bg-stone-800'
                : 'text-stone-400 dark:text-stone-600 cursor-not-allowed'
            }`}
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className={`p-1.5 rounded transition-all ${
              canRedo
                ? 'text-stone-800 dark:text-stone-200 hover:text-stone-950 dark:hover:text-white hover:bg-stone-200 dark:hover:bg-stone-800'
                : 'text-stone-400 dark:text-stone-600 cursor-not-allowed'
            }`}
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Stop Audio Indicator Button (Only active when audio is playing) */}
        {isAudioPlaying && (
          <button
            type="button"
            onClick={() => guitarAudio.stopRiff()}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-mono font-bold animate-pulse shadow-sm shadow-amber-500/30 transition-all border border-amber-400 cursor-pointer"
            title="Stop guitar audio loop"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>STOP</span>
          </button>
        )}

        {/* Delete Selected Item Button (when an element is selected) */}
        {(selectedWireId || selectedComponentId) && (
          <button
            type="button"
            onClick={onDeleteSelected}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-xs font-mono font-bold hover:bg-rose-500/25 transition-all cursor-pointer"
            title="Delete selected wire or component (Delete key)"
          >
            <Trash2 className="w-3 h-3" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        )}

        {/* Primary Action Button: Export Schematic */}
        <button
          type="button"
          onClick={onOpenExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs font-mono transition-all shadow-sm shadow-amber-600/20 cursor-pointer whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>

        {/* Hidden Import file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Theme Toggle */}
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            className="p-1.5 rounded-lg text-stone-700 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors border border-stone-200 dark:border-stone-800 cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-stone-700" />
            )}
          </button>
        )}

        {/* Guide / About modal trigger */}
        {onOpenHelp && (
          <button
            type="button"
            onClick={onOpenHelp}
            title="Wiring Guide & Quick Tips"
            className="p-1.5 rounded-lg text-stone-700 dark:text-stone-400 hover:text-stone-950 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
