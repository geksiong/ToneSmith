import React, { useState } from 'react';
import { CircuitComponent } from '../types/guitar';
import {
  FileEdit,
  Copy,
  Check,
  Trash2,
  Clock,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';

interface TechnicianNotesPanelProps {
  notes?: string;
  onChangeNotes: (notes: string) => void;
  components: CircuitComponent[];
  wiresCount: number;
  activePresetName?: string;
}

export const TechnicianNotesPanel: React.FC<TechnicianNotesPanelProps> = ({
  notes = '',
  onChangeNotes,
  components,
  wiresCount,
  activePresetName,
}) => {
  const [copied, setCopied] = useState(false);

  const wordCount = notes.trim() ? notes.trim().split(/\s+/).length : 0;
  const charCount = notes.length;

  const handleCopy = () => {
    navigator.clipboard.writeText(notes);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    if (notes && window.confirm('Clear all technician notes?')) {
      onChangeNotes('');
    }
  };

  const handleInsertTimestamp = () => {
    const now = new Date();
    const timestamp = `\n[Log - ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]: `;
    onChangeNotes((notes ? notes + '\n' : '') + timestamp);
  };

  const handleInsertComponentList = () => {
    if (components.length === 0) return;
    const header = `\n--- Bill of Materials / Circuit Summary ---\n`;
    const lines = components.map((c) => {
      let specStr = '';
      if (c.properties.dcResistanceK) specStr += ` (DC: ${c.properties.dcResistanceK}kΩ)`;
      if (c.properties.resistanceK) specStr += ` (${c.properties.resistanceK}kΩ ${c.properties.taper || ''})`;
      if (c.properties.capacitanceUf) specStr += ` (${c.properties.capacitanceUf}µF)`;
      return `• ${c.name}${specStr}`;
    });
    const summary = `${header}${lines.join('\n')}\nTotal connections: ${wiresCount}\n`;
    onChangeNotes((notes ? notes + '\n' : '') + summary);
  };

  const handleInsertPickupReadings = () => {
    const pickups = components.filter((c) => c.type.startsWith('pickup'));
    if (pickups.length === 0) {
      onChangeNotes((notes ? notes + '\n' : '') + '\n[Pickup Measurements]: No pickups currently installed on canvas.\n');
      return;
    }
    const lines = pickups.map(
      (p) => `• ${p.name}: ${p.properties.dcResistanceK || 0}kΩ DCR, ${p.properties.inductanceH || 0}H inductance`
    );
    const reading = `\n--- Bench Pickup Measurements ---\n${lines.join('\n')}\n`;
    onChangeNotes((notes ? notes + '\n' : '') + reading);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl p-3.5 flex flex-col gap-3 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
            <FileEdit className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold font-mono tracking-wider text-zinc-950 dark:text-zinc-100 flex items-center gap-2">
              TECHNICIAN NOTES
              {activePresetName && (
                <span className="text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                  ({activePresetName})
                </span>
              )}
            </h3>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
              Bench scratchpad, customer requests & wiring quirks. Saved in circuit JSON.
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!notes.trim()}
            title="Copy notes to clipboard"
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              notes.trim()
                ? 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
                : 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed'
            }`}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={!notes.trim()}
            title="Clear notes"
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              notes.trim()
                ? 'text-zinc-600 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                : 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Insert Snippet Buttons */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
        <span className="text-zinc-500 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
          Insert:
        </span>
        <button
          type="button"
          onClick={handleInsertTimestamp}
          className="px-2 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <Clock className="w-3 h-3 text-amber-500" />
          <span>Timestamp</span>
        </button>
        <button
          type="button"
          onClick={handleInsertPickupReadings}
          className="px-2 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Pickup DCR</span>
        </button>
        <button
          type="button"
          onClick={handleInsertComponentList}
          className="px-2 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <Layers className="w-3 h-3 text-amber-500" />
          <span>Parts List</span>
        </button>
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          value={notes}
          onChange={(e) => onChangeNotes(e.target.value)}
          placeholder="Write technician notes here (e.g. customer name, guitar body wood, pickup DCR readings, custom capacitor specs, treble bleed mod notes, grounding checks)..."
          rows={14}
          className="w-full p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 font-mono text-xs leading-relaxed resize-y focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-inner"
        />
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
        <div className="flex items-center gap-1">
          <Info className="w-3 h-3 text-amber-500" />
          <span>Included in exported JSON</span>
        </div>
        <div className="flex items-center gap-2">
          <span>{wordCount} words</span>
          <span>•</span>
          <span>{charCount} chars</span>
        </div>
      </div>
    </div>
  );
};
