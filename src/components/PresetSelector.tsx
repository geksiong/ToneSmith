import React, { useState } from 'react';
import { WIRING_PRESETS } from '../lib/presets';
import { WiringPreset } from '../types/guitar';
import { BookOpen, Search, X, Check, ArrowRight } from 'lucide-react';

interface PresetSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset: (preset: WiringPreset) => void;
  currentPresetId?: string;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  isOpen,
  onClose,
  onSelectPreset,
  currentPresetId,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  if (!isOpen) return null;

  const categories = ['All', 'Fender', 'Gibson', 'Custom / Mods', 'Bass'];

  const filtered = WIRING_PRESETS.filter((p) => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesQuery =
      searchQuery === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesQuery;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-zinc-900 dark:text-zinc-100 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-950 dark:text-zinc-100 font-mono">POPULAR WIRING DIAGRAMS</h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Tested schematics with authentic pots, switches, color codes, and component loads
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Categories Bar */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-950/40">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/20'
                    : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 font-semibold'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-zinc-500 dark:text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search schematics or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono shadow-xs"
            />
          </div>
        </div>

        {/* Preset Cards Grid */}
        <div className="p-4 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[55vh]">
          {filtered.map((preset) => {
            const isCurrent = currentPresetId === preset.id;
            return (
              <div
                key={preset.id}
                className={`flex flex-col justify-between p-4 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-amber-50/90 border-amber-400 shadow-md shadow-amber-500/10 dark:bg-amber-950/20 dark:border-amber-500/50'
                    : 'bg-white hover:bg-zinc-50/80 border-zinc-300 hover:border-zinc-400 shadow-xs dark:bg-zinc-800/60 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-800'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 border border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700 text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider">
                        {preset.category}
                      </span>
                      <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-100 font-mono mt-1.5">
                        {preset.name}
                      </h3>
                    </div>
                    {isCurrent && (
                      <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-400 dark:border-emerald-500/40 font-bold">
                        <Check className="w-3 h-3" /> Active
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-zinc-700 dark:text-zinc-400 font-sans leading-relaxed mb-3">
                    {preset.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {preset.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[9px] font-mono px-2 py-0.5 rounded bg-zinc-100 border border-zinc-300 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 font-medium">
                    {preset.components.length} components • {preset.wires.length} wires
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectPreset(preset);
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-mono font-bold transition-all shadow-md shadow-amber-500/20"
                  >
                    <span>Load Wiring</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 flex justify-between items-center text-xs font-mono text-zinc-600 dark:text-zinc-400 font-medium">
          <span>{filtered.length} diagrams available</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded bg-zinc-200 hover:bg-zinc-300 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
