import React, { useState, useEffect, useRef } from 'react';
import {
  CircuitComponent,
  PotTaper,
} from '../types/guitar';
import { COMPONENT_METADATA } from '../lib/componentDefs';
import {
  Sliders,
  X,
  Trash2,
  Check,
  Zap,
  Disc,
  GripHorizontal,
  ToggleLeft,
  Settings2,
} from 'lucide-react';

interface ComponentEditModalProps {
  component: CircuitComponent | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<CircuitComponent>) => void;
  onDelete: (id: string) => void;
}

export const ComponentEditModal: React.FC<ComponentEditModalProps> = ({
  component,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  // Local state - unconditionally declared before any return statements
  const [name, setName] = useState(component?.name ?? '');
  const [properties, setProperties] = useState(component?.properties ?? {});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Draggable window coordinates
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 100, y: 80 });
  const isDragging = useRef(false);
  const dragStartOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Calculate intelligent position that avoids obscuring the component
  useEffect(() => {
    if (!component) return;
    setName(component.name);
    setProperties({ ...component.properties });
    setShowDeleteConfirm(false);

    // Measure component DOM element on screen
    const compDom = document.getElementById(`comp-dom-${component.id}`);
    const dialogWidth = 320;
    const dialogHeight = 420;
    const padding = 20;

    if (compDom) {
      const rect = compDom.getBoundingClientRect();
      let targetX = rect.right + padding;
      let targetY = Math.max(65, rect.top - 10);

      // If overflowing right edge, place on the left of the component
      if (targetX + dialogWidth > window.innerWidth - 10) {
        targetX = rect.left - dialogWidth - padding;
      }

      // If still overflowing left edge, place below or centered
      if (targetX < 10) {
        targetX = Math.max(10, Math.min(rect.left, window.innerWidth - dialogWidth - 10));
        targetY = rect.bottom + padding;
      }

      // Constrain within viewport bounds
      targetX = Math.max(10, Math.min(targetX, window.innerWidth - dialogWidth - 10));
      targetY = Math.max(65, Math.min(targetY, window.innerHeight - dialogHeight));

      setPosition({ x: Math.round(targetX), y: Math.round(targetY) });
    } else {
      // Default to upper area of canvas
      setPosition({
        x: Math.max(20, window.innerWidth - 320 - 480),
        y: 80,
      });
    }
  }, [component?.id]);

  // Keyboard shortcut: Escape to close, Enter to submit
  useEffect(() => {
    if (!isOpen || !component) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        onSave(component.id, {
          name: name.trim() || component.name,
          properties,
        });
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, component, name, properties, onClose, onSave]);

  // Return null ONLY AFTER ALL HOOKS HAVE BEEN EXECUTED UNCONDITIONALLY!
  if (!isOpen || !component) return null;

  const meta = COMPONENT_METADATA[component.type];

  // Dragging logic
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    // Only allow left button and not when clicking buttons
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    
    isDragging.current = true;
    dragStartOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return;
      const nextX = Math.max(
        10,
        Math.min(moveEvent.clientX - dragStartOffset.current.x, window.innerWidth - 330)
      );
      const nextY = Math.max(
        60,
        Math.min(moveEvent.clientY - dragStartOffset.current.y, window.innerHeight - 100)
      );
      setPosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleSave = () => {
    onSave(component.id, {
      name: name.trim() || component.name,
      properties,
    });
    onClose();
  };

  // Live apply property change so audio and bode update immediately while dialog is open
  const updateProp = (newProps: Partial<typeof properties>) => {
    const updated = { ...properties, ...newProps };
    setProperties(updated);
    onSave(component.id, {
      name: name.trim() || component.name,
      properties: updated,
    });
  };

  const isPot = component.type.startsWith('pot-');
  const isCap = component.type === 'capacitor';
  const isResistor = component.type === 'resistor';
  const isPickup = component.type.startsWith('pickup-');
  const isSwitch = component.type.startsWith('switch-');

  return (
    /* Floating, non-modal inspector panel without any background blur or overlay */
    <div
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      className="fixed z-40 w-[320px] bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700/90 rounded-xl shadow-2xl flex flex-col overflow-hidden select-none animate-in fade-in zoom-in-95 duration-100 ring-1 ring-amber-500/20 text-zinc-900 dark:text-zinc-100"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Draggable Compact Header Bar */}
      <div
        onMouseDown={handleHeaderMouseDown}
        className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 cursor-grab active:cursor-grabbing hover:bg-zinc-200/70 dark:hover:bg-zinc-900/80 transition-colors"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <GripHorizontal className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-500 shrink-0" />
          <div className="flex items-center gap-1.5 truncate">
            {isPot ? (
              <Sliders className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : isCap ? (
              <Disc className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : isPickup ? (
              <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : isSwitch ? (
              <ToggleLeft className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : (
              <Settings2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            )}
            <span className="text-[11px] font-bold text-zinc-950 dark:text-zinc-100 font-mono tracking-wide truncate">
              {name || meta?.name || 'EDIT PART'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors ml-1"
          title="Close dialog (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Compact Scrollable Form Content */}
      <div className="p-3 overflow-y-auto max-h-[60vh] space-y-3 text-xs font-mono">
        {/* Component Name Input */}
        <div>
          <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-400 uppercase tracking-wider mb-1">
            Component Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              onSave(component.id, { name: e.target.value.trim() || component.name });
            }}
            placeholder="e.g. Master Volume"
            className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700/80 rounded-lg px-2.5 py-1 text-xs text-zinc-950 dark:text-zinc-100 font-mono focus:outline-none focus:border-amber-500 transition-all shadow-inner"
          />

          {/* Quick Name Chips for Pots */}
          {isPot && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {['Volume', 'Tone', 'Neck Vol', 'Bridge Vol', 'Neck Tone', 'Bridge Tone'].map(
                (quick) => (
                  <button
                    key={quick}
                    type="button"
                    onClick={() => {
                      setName(quick);
                      onSave(component.id, { name: quick });
                    }}
                    className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors font-semibold ${
                      name === quick
                        ? 'bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/50'
                        : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-300 dark:bg-zinc-800/80 dark:text-zinc-400 dark:border-zinc-700 dark:hover:text-zinc-200'
                    }`}
                  >
                    {quick}
                  </button>
                )
              )}
            </div>
          )}
        </div>

        {/* POTENTIOMETERS */}
        {isPot && (
          <div className="space-y-2.5 pt-2 border-t border-zinc-800">
            {/* Resistance Row */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Resistance (kΩ)
                </span>
                <span className="text-xs font-bold text-amber-400">
                  {properties.resistanceK ?? 500}kΩ
                </span>
              </div>

              {/* Segmented Value Pills */}
              <div className="grid grid-cols-4 gap-1 mb-1.5">
                {[
                  { val: 250, label: '250k' },
                  { val: 500, label: '500k' },
                  { val: 1000, label: '1M' },
                  { val: 25, label: '25k' },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => updateProp({ resistanceK: item.val })}
                    className={`py-1 text-[10px] font-bold rounded border transition-all ${
                      properties.resistanceK === item.val
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Custom Number Input */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-500">Custom:</span>
                <input
                  type="number"
                  min={1}
                  max={2000}
                  step={5}
                  value={properties.resistanceK ?? 500}
                  onChange={(e) =>
                    updateProp({
                      resistanceK: Math.max(1, parseFloat(e.target.value) || 500),
                    })
                  }
                  className="flex-1 bg-zinc-950 border border-zinc-700/80 rounded px-2 py-0.5 text-xs text-zinc-100 font-mono"
                />
                <span className="text-[10px] text-zinc-400">kΩ</span>
              </div>
            </div>

            {/* Taper Selection */}
            <div>
              <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Taper Curve
              </span>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'audio' as PotTaper, label: 'Audio (A)' },
                  { id: 'linear' as PotTaper, label: 'Linear (B)' },
                  { id: 'reverse-audio' as PotTaper, label: 'Rev (C)' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => updateProp({ taper: t.id })}
                    className={`py-1 text-[10px] font-bold rounded border text-center transition-all ${
                      (properties.taper ?? 'audio') === t.id
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-sm'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Push-Pull Switch Position */}
            {component.type === 'pot-pushpull' && (
              <div>
                <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  DPDT Switch State
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => updateProp({ pulledUp: false })}
                    className={`py-1 text-[10px] font-bold rounded border transition-all ${
                      !properties.pulledUp
                        ? 'bg-blue-600/30 border-blue-400 text-blue-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    PUSHED (Normal)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateProp({ pulledUp: true })}
                    className={`py-1 text-[10px] font-bold rounded border transition-all ${
                      properties.pulledUp
                        ? 'bg-amber-500/30 border-amber-400 text-amber-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    PULLED (Active)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CAPACITORS */}
        {isCap && (
          <div className="space-y-2.5 pt-2 border-t border-zinc-800">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Capacitance (µF)
                </span>
                <span className="text-xs font-bold text-amber-400">
                  {properties.capacitanceUf ?? 0.022} µF
                </span>
              </div>

              {/* Segmented Value Pills */}
              <div className="grid grid-cols-4 gap-1 mb-1.5">
                {[
                  { val: 0.022, label: '.022' },
                  { val: 0.047, label: '.047' },
                  { val: 0.015, label: '.015' },
                  { val: 0.001, label: '.001' },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => updateProp({ capacitanceUf: item.val })}
                    className={`py-1 text-[10px] font-bold rounded border transition-all ${
                      properties.capacitanceUf === item.val
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Custom Number Input */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-500">Custom:</span>
                <input
                  type="number"
                  min={0.0001}
                  max={1.0}
                  step={0.001}
                  value={properties.capacitanceUf ?? 0.022}
                  onChange={(e) =>
                    updateProp({
                      capacitanceUf: Math.max(0.0001, parseFloat(e.target.value) || 0.022),
                    })
                  }
                  className="flex-1 bg-zinc-950 border border-zinc-700/80 rounded px-2 py-0.5 text-xs text-zinc-100 font-mono"
                />
                <span className="text-[10px] text-zinc-400">µF</span>
              </div>
            </div>

            {/* Construction Type */}
            <div>
              <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Type
              </span>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'orange-drop', label: 'Orange Drop' },
                  { id: 'paper-in-oil', label: 'PIO' },
                  { id: 'ceramic-disc', label: 'Ceramic' },
                ].map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => updateProp({ capType: type.id as any })}
                    className={`py-1 text-[10px] font-bold rounded border text-center transition-all ${
                      (properties.capType ?? 'orange-drop') === type.id
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* RESISTORS */}
        {isResistor && (
          <div className="space-y-2.5 pt-2 border-t border-zinc-800">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Resistance (Ω)
                </span>
                <span className="text-xs font-bold text-amber-400">
                  {((properties.resistanceOhms ?? 150000) / 1000).toFixed(0)}kΩ
                </span>
              </div>

              {/* Segmented Value Pills */}
              <div className="grid grid-cols-4 gap-1 mb-1.5">
                {[
                  { val: 150000, label: '150k' },
                  { val: 220000, label: '220k' },
                  { val: 470000, label: '470k' },
                  { val: 68000, label: '68k' },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => updateProp({ resistanceOhms: item.val })}
                    className={`py-1 text-[10px] font-bold rounded border transition-all ${
                      properties.resistanceOhms === item.val
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Custom Number Input */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-500">Custom:</span>
                <input
                  type="number"
                  min={1}
                  max={2000000}
                  step={1000}
                  value={properties.resistanceOhms ?? 150000}
                  onChange={(e) =>
                    updateProp({
                      resistanceOhms: Math.max(1, parseFloat(e.target.value) || 150000),
                    })
                  }
                  className="flex-1 bg-zinc-950 border border-zinc-700/80 rounded px-2 py-0.5 text-xs text-zinc-100 font-mono"
                />
                <span className="text-[10px] text-zinc-400">Ω</span>
              </div>
            </div>
          </div>
        )}

        {/* PICKUPS */}
        {isPickup && (
          <div className="space-y-2.5 pt-2 border-t border-zinc-800">
            {/* Position */}
            <div>
              <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Cavity Position
              </span>
              <div className="grid grid-cols-3 gap-1">
                {['neck', 'middle', 'bridge'].map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => updateProp({ pickupPosition: pos as any })}
                    className={`py-1 text-[10px] font-bold uppercase rounded border transition-all ${
                      (properties.pickupPosition ?? 'bridge') === pos
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            {/* DC Resistance & Inductance */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  DCR (kΩ)
                </span>
                <input
                  type="number"
                  min={2.0}
                  max={25.0}
                  step={0.1}
                  value={properties.dcResistanceK ?? 8.4}
                  onChange={(e) =>
                    updateProp({ dcResistanceK: parseFloat(e.target.value) || 8.4 })
                  }
                  className="w-full bg-zinc-950 border border-zinc-700/80 rounded px-2 py-1 text-xs text-zinc-100 font-mono"
                />
              </div>

              <div>
                <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Inductance (H)
                </span>
                <input
                  type="number"
                  min={1.0}
                  max={12.0}
                  step={0.1}
                  value={properties.inductanceH ?? 4.2}
                  onChange={(e) =>
                    updateProp({ inductanceH: parseFloat(e.target.value) || 4.2 })
                  }
                  className="w-full bg-zinc-950 border border-zinc-700/80 rounded px-2 py-1 text-xs text-zinc-100 font-mono"
                />
              </div>
            </div>

            {/* Magnet Type */}
            <div>
              <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Magnet
              </span>
              <div className="grid grid-cols-3 gap-1">
                {['Alnico II', 'Alnico V', 'Ceramic'].map((mag) => (
                  <button
                    key={mag}
                    type="button"
                    onClick={() => updateProp({ magnetType: mag as any })}
                    className={`py-1 text-[9px] font-bold rounded border transition-all ${
                      (properties.magnetType ?? 'Alnico V') === mag
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {mag}
                  </button>
                ))}
              </div>
            </div>

            {/* Peter Green Mod & RWRP */}
            <div className="space-y-1.5 pt-1 border-t border-zinc-800">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!properties.magnetFlipped}
                  onChange={(e) => updateProp({ magnetFlipped: e.target.checked })}
                  className="w-3.5 h-3.5 rounded border-zinc-700 text-amber-500 focus:ring-amber-400 bg-zinc-950"
                />
                <span className="text-[10px] text-zinc-300 font-medium">
                  Flip Magnet Bar (Peter Green Out-Of-Phase)
                </span>
              </label>

              {component.type === 'pickup-singlecoil' && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!properties.rwrp}
                    onChange={(e) => updateProp({ rwrp: e.target.checked })}
                    className="w-3.5 h-3.5 rounded border-zinc-700 text-amber-500 focus:ring-amber-400 bg-zinc-950"
                  />
                  <span className="text-[10px] text-zinc-300 font-medium">
                    RWRP (Reverse Wound, Reverse Polarity)
                  </span>
                </label>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Compact Footer Bar */}
      <div className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 flex items-center justify-between">
        {showDeleteConfirm ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-rose-600 dark:text-rose-400 font-bold">Delete?</span>
            <button
              type="button"
              onClick={() => {
                onDelete(component.id);
                onClose();
              }}
              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="px-1.5 py-0.5 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white text-[10px] font-semibold"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1 text-zinc-500 hover:text-rose-600 dark:text-zinc-500 dark:hover:text-rose-400 transition-colors"
            title="Delete this component"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={handleSave}
          className="flex items-center gap-1 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-lg text-xs font-mono font-bold shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Done</span>
        </button>
      </div>
    </div>
  );
};
