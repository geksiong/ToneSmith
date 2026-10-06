import React, { useRef, useState, useEffect } from 'react';
import { Wire, WireColor } from '../types/guitar';
import { WIRE_COLOR_OPTIONS, getWireColorLabel } from '../lib/colorCodes';
import { guitarAudio } from '../lib/audioEngine';
import {
  Undo,
  Redo,
  Trash2,
  Download,
  BookOpen,
  FolderOpen,
  RotateCcw,
  Zap,
  Palette,
  Check,
  Sun,
  Moon,
  Square,
  FileSpreadsheet,
  HelpCircle,
  FileEdit,
} from 'lucide-react';

interface ToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  activeWireColor: WireColor;
  onSelectWireColor: (color: WireColor) => void;
  onOpenPresets: () => void;
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
}

export const Toolbar: React.FC<ToolbarProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  activeWireColor,
  onSelectWireColor,
  onOpenPresets,
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
  onEditSelectedComponent,
  onChangeSelectedWireColor,
  isInteractiveMode = false,
  onToggleInteractiveMode,
  showSignalPath = false,
  onToggleSignalPath,
  theme = 'dark',
  onToggleTheme,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(() => guitarAudio.isRiffPlaying);

  useEffect(() => {
    return guitarAudio.subscribe(() => {
      setIsAudioPlaying(guitarAudio.isRiffPlaying);
    });
  }, []);

  const handleSelectColor = (color: WireColor) => {
    onSelectWireColor(color);
    if (selectedWireId && onChangeSelectedWireColor) {
      onChangeSelectedWireColor(color);
    }
  };

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
  };

  return (
    <header className="h-14 border-b border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/95 backdrop-blur px-4 flex items-center justify-between select-none z-30 transition-colors duration-150 shadow-xs">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-md shadow-amber-500/20 text-zinc-950 font-black">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black font-mono tracking-wider text-zinc-950 dark:text-zinc-100">
                TONESMITH
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 font-black border border-amber-500/30">
                GUITAR LAB
              </span>
            </div>
            <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 font-medium hidden xl:inline">
              Wiring Simulator & Physical Schematic Builder
            </span>
          </div>
        </div>
      </div>

      {/* Center Tools: Stop Audio, Undo, Redo, Wire Color Selector */}
      <div className="flex items-center gap-3">
        {/* Quick Stop Audio Button when audio playback is active */}
        {isAudioPlaying && (
          <button
            type="button"
            onClick={() => guitarAudio.stopRiff()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-mono font-black animate-pulse shadow-md shadow-amber-500/30 transition-all border border-amber-400 cursor-pointer"
            title="Stop guitar audio playback immediately"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>STOP AUDIO</span>
          </button>
        )}

        {/* Undo / Redo */}
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-950/70 p-1 rounded-lg border border-zinc-300 dark:border-zinc-800">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className={`p-1.5 rounded transition-all ${
              canUndo
                ? 'text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800'
                : 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
            }`}
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className={`p-1.5 rounded transition-all ${
              canRedo
                ? 'text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800'
                : 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
            }`}
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>

        {/* Wire Color Controls (Only in Edit Mode) */}
        {!isInteractiveMode && (
          <>
            {selectedWireId ? (
              /* Selected Wire Active Color Changer */
              <div className="flex items-center gap-1.5 bg-amber-100/90 dark:bg-amber-950/40 border border-amber-400 dark:border-amber-500/50 p-1 rounded-lg shadow-md animate-in fade-in">
                <div className="flex items-center gap-1 px-1.5 text-amber-800 dark:text-amber-300">
                  <Palette className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="text-[11px] font-mono font-bold whitespace-nowrap">
                    Wire Color:
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {WIRE_COLOR_OPTIONS.map(({ color, label, isDark }) => {
                    const currentWireColor = selectedWire?.color || activeWireColor;
                    const isCurrent = currentWireColor.toLowerCase() === color.toLowerCase();
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleSelectColor(color)}
                        title={`Change wire to ${label}`}
                        className={`w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center relative ${
                          isCurrent
                            ? 'border-zinc-950 dark:border-white scale-125 shadow-md shadow-amber-400/40 ring-2 ring-amber-400/60 z-10'
                            : 'border-zinc-400 dark:border-zinc-700 hover:scale-110 hover:border-zinc-800 dark:hover:border-zinc-300'
                        }`}
                        style={{ backgroundColor: color }}
                      >
                        {isCurrent && (
                          <Check
                            className={`w-2.5 h-2.5 stroke-[3] ${
                              isDark || color === '#18181b' ? 'text-white' : 'text-zinc-950'
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}

                  {/* Custom Hex Color Picker */}
                  <label
                    title="Choose custom wire color"
                    className="w-5 h-5 rounded-full border border-zinc-400 dark:border-zinc-600 hover:border-zinc-950 dark:hover:border-white hover:scale-110 cursor-pointer overflow-hidden relative flex items-center justify-center bg-gradient-to-br from-red-500 via-amber-400 via-emerald-400 to-blue-500 ml-0.5 shadow-sm"
                  >
                    <input
                      type="color"
                      value={selectedWire?.color || activeWireColor}
                      onChange={(e) => handleSelectColor(e.target.value)}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            ) : (
              /* Default Wire Color Palette for New Wires */
              <div className="hidden lg:flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-950/70 p-1.5 rounded-lg border border-zinc-300 dark:border-zinc-800">
                <span className="text-[10px] font-mono text-zinc-700 dark:text-zinc-400 font-semibold px-1">Wire:</span>
                {WIRE_COLOR_OPTIONS.map(({ color, label, isDark }) => {
                  const isCurrent = activeWireColor.toLowerCase() === color.toLowerCase();
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleSelectColor(color)}
                      title={`Default: ${label}`}
                      className={`w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center ${
                        isCurrent
                          ? 'border-zinc-950 dark:border-white scale-125 shadow-md shadow-amber-400/30 ring-2 ring-amber-400/50'
                          : 'border-zinc-400 dark:border-zinc-700 hover:scale-110 hover:border-zinc-800 dark:hover:border-zinc-300'
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      {isCurrent && (
                        <Check
                          className={`w-2.5 h-2.5 stroke-[3] ${
                            isDark || color === '#18181b' ? 'text-white' : 'text-zinc-950'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}

                {/* Custom Color Picker for New Wires */}
                <label
                  title="Choose custom wire color"
                  className="w-5 h-5 rounded-full border border-zinc-400 dark:border-zinc-600 hover:border-zinc-950 dark:hover:border-white hover:scale-110 cursor-pointer overflow-hidden relative flex items-center justify-center bg-gradient-to-br from-red-500 via-amber-400 via-emerald-400 to-blue-500 ml-0.5 shadow-sm"
                >
                  <input
                    type="color"
                    value={activeWireColor}
                    onChange={(e) => handleSelectColor(e.target.value)}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  />
                </label>
              </div>
            )}
          </>
        )}

        {/* Delete Selected Wire Button (Only in Edit Mode when a wire is selected) */}
        {!isInteractiveMode && selectedWireId && (
          <button
            type="button"
            onClick={onDeleteSelected}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/15 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40 text-xs font-mono font-bold hover:bg-rose-500/25 transition-all cursor-pointer"
            title="Delete Selected Wire"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Wire</span>
          </button>
        )}
      </div>

      {/* Right Action Buttons */}
      <div className="flex items-center gap-2">
        {/* Analysis Report Button */}
        {onOpenAnalysisReport && (
          <button
            type="button"
            onClick={onOpenAnalysisReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 text-xs font-mono font-bold transition-all cursor-pointer"
            title="View comprehensive report of all switch & push/pull combinations"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="hidden md:inline">Analysis Report</span>
          </button>
        )}

        {/* Preset Diagrams Button */}
        <button
          type="button"
          onClick={onOpenPresets}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 text-xs font-mono font-bold transition-all cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span className="hidden sm:inline">Wiring Diagrams</span>
        </button>

        {/* Technician Notes Button */}
        {onOpenNotes && (
          <button
            type="button"
            onClick={onOpenNotes}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 text-xs font-mono font-bold transition-all cursor-pointer"
            title="Open Technician Notes (saved in circuit JSON)"
          >
            <FileEdit className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="hidden sm:inline">Tech Notes</span>
          </button>
        )}

        {/* Export Schematic & BOM */}
        <button
          type="button"
          onClick={onOpenExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-mono font-bold transition-all shadow-md shadow-amber-500/20"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Schematic</span>
        </button>

        {/* Clear Canvas */}
        <button
          type="button"
          onClick={onClearCanvas}
          title="Clear Canvas (remove all components & wires)"
          className="p-2 rounded-lg text-zinc-700 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Hidden Import file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Import JSON schematic"
          className="p-2 rounded-lg text-zinc-700 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors hidden md:block"
        >
          <FolderOpen className="w-4 h-4" />
        </button>

        {/* Light / Dark Mode Toggle Button */}
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            className="p-2 rounded-lg text-zinc-800 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all border border-zinc-300 dark:border-zinc-700 shadow-xs"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 transition-transform hover:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 text-zinc-800 transition-transform hover:-rotate-12" />
            )}
          </button>
        )}

        {/* About ("?" Question Mark Icon) Button */}
        {onOpenAbout && (
          <button
            type="button"
            onClick={onOpenAbout}
            title="About ToneSmith & Creator (Gek Siong)"
            aria-label="About ToneSmith"
            className="p-2 rounded-lg text-zinc-800 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all border border-zinc-300 dark:border-zinc-700 shadow-xs cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
