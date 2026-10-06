import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { CircuitComponent, CircuitState, SignalPathInfo, Terminal, Wire, WireColor } from '../types/guitar';
import { getComponentTerminals } from '../lib/componentDefs';
import { WIRE_COLOR_OPTIONS, getWireColorLabel } from '../lib/colorCodes';
import { ComponentVisual } from './ComponentVisuals';
import { Sliders, Trash2, Palette, Check, X, Zap, Activity, Gamepad2, Wrench } from 'lucide-react';

interface CanvasProps {
  state: CircuitState;
  selectedComponentId: string | null;
  selectedWireId: string | null;
  activeWireColor: WireColor;
  onSelectComponent: (id: string | null) => void;
  onSelectWire: (id: string | null) => void;
  onUpdateComponent: (id: string, updates: Partial<CircuitComponent>) => void;
  onUpdateWire?: (wireId: string, updates: Partial<Wire>) => void;
  onAddWire: (wire: Wire) => void;
  onDeleteWire: (wireId: string) => void;
  onDeleteComponent: (componentId: string) => void;
  onOpenEditComponent?: (id: string) => void;
  isInteractiveMode?: boolean;
  onToggleInteractiveMode?: () => void;
  showSignalPath?: boolean;
  signalPathInfo?: SignalPathInfo;
  onToggleSignalPath?: () => void;
  theme?: 'dark' | 'light';
}

export const Canvas: React.FC<CanvasProps> = ({
  state,
  selectedComponentId,
  selectedWireId,
  activeWireColor,
  onSelectComponent,
  onSelectWire,
  onUpdateComponent,
  onUpdateWire,
  onAddWire,
  onDeleteWire,
  onDeleteComponent,
  onOpenEditComponent,
  isInteractiveMode = false,
  onToggleInteractiveMode,
  showSignalPath = false,
  signalPathInfo,
  onToggleSignalPath,
  theme = 'dark',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDark = theme === 'dark';

  const selectedWire = useMemo(() => {
    return state.wires.find((w) => w.id === selectedWireId) ?? null;
  }, [state.wires, selectedWireId]);
  
  // Pan and Zoom
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 40, y: 30 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Component Dragging & Click Selection
  const [draggingCompId, setDraggingCompId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null);
  const mouseDownClientPos = useRef<{ x: number; y: number } | null>(null);
  const clickTargetCompId = useRef<string | null>(null);

  // Wire creation
  const [pendingWire, setPendingWire] = useState<{
    fromComponentId: string;
    fromTerminalId: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Keyboard shortcuts (Delete, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedWireId) {
          onDeleteWire(selectedWireId);
        } else if (selectedComponentId) {
          onDeleteComponent(selectedComponentId);
        }
      } else if (e.key === 'Escape') {
        setPendingWire(null);
        onSelectComponent(null);
        onSelectWire(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedWireId, selectedComponentId, onDeleteWire, onDeleteComponent, onSelectComponent, onSelectWire]);

  // Terminal coordinates helper (instantly tracking dragged component coordinates)
  const getTerminalAbsolutePos = useCallback(
    (compId: string, termId: string) => {
      const comp = state.components.find((c) => c.id === compId);
      if (!comp) return { x: 0, y: 0 };
      const compX = dragPos && dragPos.id === comp.id ? dragPos.x : comp.x;
      const compY = dragPos && dragPos.id === comp.id ? dragPos.y : comp.y;
      const terms = getComponentTerminals(comp);
      const term = terms.find((t) => t.id === termId);
      if (!term) return { x: compX, y: compY };
      return {
        x: compX + term.x,
        y: compY + term.y,
      };
    },
    [state.components, dragPos]
  );

  // Convert screen mouse coordinates (clientX/clientY) to canvas world coordinates
  const getCanvasCoords = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      };
    },
    [pan.x, pan.y, zoom]
  );

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom((prev) => Math.min(2.2, Math.max(0.45, prev * zoomFactor)));
  };

  // Canvas Mouse Down
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // If middle mouse or spacebar or target is canvas background
    if (e.button === 1 || e.button === 0) {
      if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        onSelectComponent(null);
        onSelectWire(null);
      }
    }
  };

  // Canvas Mouse Move (instant 60fps local position update with zero lag)
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (draggingCompId) {
      const coords = getCanvasCoords(e.clientX, e.clientY);
      const newX = Math.round(coords.x - dragOffset.x);
      const newY = Math.round(coords.y - dragOffset.y);
      setDragPos({
        id: draggingCompId,
        x: newX,
        y: newY,
      });
      return;
    }

    if (pendingWire) {
      const coords = getCanvasCoords(e.clientX, e.clientY);
      setPendingWire((prev) =>
        prev
          ? {
              ...prev,
              currentX: coords.x,
              currentY: coords.y,
            }
          : null
      );
    }
  };

  // Canvas Mouse Up
  const handleMouseUp = (e: React.MouseEvent) => {
    setIsPanning(false);
    if (dragPos) {
      onUpdateComponent(dragPos.id, { x: dragPos.x, y: dragPos.y });
      setDragPos(null);
    }

    // If mouse didn't drag, treat as a selection click to open the edit pop-up dialog
    if (clickTargetCompId.current && mouseDownClientPos.current) {
      const dist = Math.hypot(
        e.clientX - mouseDownClientPos.current.x,
        e.clientY - mouseDownClientPos.current.y
      );
      if (dist < 4) {
        onOpenEditComponent?.(clickTargetCompId.current);
      }
      clickTargetCompId.current = null;
      mouseDownClientPos.current = null;
    }

    setDraggingCompId(null);
  };

  // Start dragging component
  const handleComponentMouseDown = (comp: CircuitComponent, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0 || isInteractiveMode) return;

    mouseDownClientPos.current = { x: e.clientX, y: e.clientY };
    clickTargetCompId.current = comp.id;

    onSelectComponent(comp.id);
    onSelectWire(null);

    const coords = getCanvasCoords(e.clientX, e.clientY);

    setDraggingCompId(comp.id);
    setDragOffset({
      x: coords.x - comp.x,
      y: coords.y - comp.y,
    });
  };

  // Start wire from terminal
  const handleTerminalMouseDown = (comp: CircuitComponent, term: Terminal, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0 || isInteractiveMode) return;

    const startPos = { x: comp.x + term.x, y: comp.y + term.y };

    if (!pendingWire) {
      // Begin creating wire
      setPendingWire({
        fromComponentId: comp.id,
        fromTerminalId: term.id,
        startX: startPos.x,
        startY: startPos.y,
        currentX: startPos.x,
        currentY: startPos.y,
      });
    } else {
      // Connect pending wire to this terminal
      if (
        pendingWire.fromComponentId === comp.id &&
        pendingWire.fromTerminalId === term.id
      ) {
        // Clicked same terminal twice, cancel
        setPendingWire(null);
        return;
      }

      // Check if duplicate wire already exists
      const exists = state.wires.some(
        (w) =>
          (w.fromComponentId === pendingWire.fromComponentId &&
            w.fromTerminalId === pendingWire.fromTerminalId &&
            w.toComponentId === comp.id &&
            w.toTerminalId === term.id) ||
          (w.toComponentId === pendingWire.fromComponentId &&
            w.toTerminalId === pendingWire.fromTerminalId &&
            w.fromComponentId === comp.id &&
            w.fromTerminalId === term.id)
      );

      if (!exists) {
        onAddWire({
          id: `wire-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          fromComponentId: pendingWire.fromComponentId,
          fromTerminalId: pendingWire.fromTerminalId,
          toComponentId: comp.id,
          toTerminalId: term.id,
          color: activeWireColor,
        });
      }

      setPendingWire(null);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-slate-100 dark:bg-zinc-950 cursor-default select-none transition-colors duration-150"
      onWheel={handleWheel}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Background Copper Shield Foil & Grid Pattern */}
      <div
        className={`absolute inset-0 pointer-events-none ${isDark ? 'opacity-40' : 'opacity-85'}`}
        style={{
          backgroundImage: isDark
            ? `radial-gradient(circle at 1px 1px, rgba(217, 119, 6, 0.25) 1px, transparent 0),
               linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
               linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`
            : `radial-gradient(circle at 1px 1px, rgba(180, 83, 9, 0.45) 1.2px, transparent 0),
               linear-gradient(to right, rgba(15, 23, 42, 0.09) 1px, transparent 1px),
               linear-gradient(to bottom, rgba(15, 23, 42, 0.09) 1px, transparent 1px)`,
          backgroundSize: `${30 * zoom}px ${30 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      {/* Cavity Shield Glow Vignette */}
      <div
        className={`absolute inset-0 pointer-events-none ${
          isDark
            ? 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-950/10 via-transparent to-zinc-950/80'
            : 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/5 via-transparent to-slate-200/50'
        }`}
      />

      {/* Main World Container (Scaled & Panned) */}
      <div
        className="absolute origin-top-left"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {/* Layer 1: Components Layer (Instant 60fps tracking) */}
        {state.components.map((comp) => {
          const isSelected = selectedComponentId === comp.id;
          const terminals = getComponentTerminals(comp);
          const compX = dragPos && dragPos.id === comp.id ? dragPos.x : comp.x;
          const compY = dragPos && dragPos.id === comp.id ? dragPos.y : comp.y;
          const isSignalActive = !showSignalPath || (signalPathInfo?.activeComponentIds.has(comp.id) ?? true);

          return (
            <div
              key={comp.id}
              id={`comp-dom-${comp.id}`}
              className={`absolute pointer-events-auto z-0 transition-opacity duration-300 ${
                showSignalPath && !isSignalActive
                  ? 'opacity-25 filter grayscale-[60%]'
                  : 'opacity-100'
              }`}
              style={{
                left: compX,
                top: compY,
              }}
              onMouseDown={(e) => handleComponentMouseDown(comp, e)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onOpenEditComponent?.(comp.id);
              }}
            >
              {/* Selected Component Floating Quick-Action Bar */}
              {isSelected && !isInteractiveMode && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-30 bg-white/95 dark:bg-zinc-900/95 border border-amber-400 rounded-lg px-2 py-0.5 shadow-xl select-none animate-in fade-in whitespace-nowrap">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenEditComponent?.(comp.id);
                    }}
                    className="flex items-center gap-1 text-[10px] font-mono text-amber-600 dark:text-amber-300 font-bold hover:text-zinc-900 dark:hover:text-white transition-colors"
                    title="Edit Name, Resistance, Taper, or Capacitance"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>Edit Specs</span>
                  </button>
                  <div className="w-[1px] h-3 bg-zinc-300 dark:bg-zinc-700" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteComponent(comp.id);
                    }}
                    className="text-zinc-400 hover:text-rose-500 p-0.5 transition-colors"
                    title="Delete Component"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}

              <ComponentVisual
                component={comp}
                terminals={terminals}
                isSelected={isSelected}
                isInteractiveMode={isInteractiveMode}
                hideTerminals={true}
                showSignalPath={showSignalPath}
                isSignalActive={isSignalActive}
                activeCoils={signalPathInfo?.activeHumbuckerCoils?.[comp.id]}
                activeTerminalId={
                  pendingWire && pendingWire.fromComponentId === comp.id
                    ? pendingWire.fromTerminalId
                    : null
                }
                onTerminalMouseDown={(term, e) => handleTerminalMouseDown(comp, term, e)}
                onPropertyChange={(props) =>
                  onUpdateComponent(comp.id, {
                    properties: { ...comp.properties, ...props },
                  })
                }
              />
            </div>
          );
        })}

        {/* Layer 2: SVG Layer for Wires (IN FRONT of components so all wire paths and pin connections are visible) */}
        <svg
          className="absolute inset-0 overflow-visible pointer-events-none z-10"
          style={{ width: '4000px', height: '3000px' }}
        >
          <defs>
            <filter id="wire-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.6" />
            </filter>
            <filter id="active-wire-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#f59e0b" floodOpacity="0.8" />
            </filter>
            <filter id="signal-path-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#10b981" floodOpacity="0.85" />
            </filter>
          </defs>

          {/* Render All Connected Wires IN FRONT of Component Bodies */}
          {state.wires.map((wire) => {
            const p1 = getTerminalAbsolutePos(wire.fromComponentId, wire.fromTerminalId);
            const p2 = getTerminalAbsolutePos(wire.toComponentId, wire.toTerminalId);
            const isSelected = selectedWireId === wire.id;
            const isWireActive = !showSignalPath || (signalPathInfo?.activeWireIds.has(wire.id) ?? true);

            // Generate organic guitar wire curve (slight downward sag)
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.hypot(dx, dy);
            const sag = Math.min(80, Math.max(15, dist * 0.15));

            const cp1X = p1.x + dx * 0.25;
            const cp1Y = p1.y + dy * 0.25 + sag;
            const cp2X = p1.x + dx * 0.75;
            const cp2Y = p1.y + dy * 0.75 + sag;

            const pathD = `M ${p1.x} ${p1.y} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${p2.x} ${p2.y}`;

            return (
              <g
                key={wire.id}
                opacity={showSignalPath && !isWireActive ? 0.16 : 1.0}
                className={`transition-opacity duration-300 ${
                  isInteractiveMode
                    ? 'pointer-events-none'
                    : 'pointer-events-auto cursor-pointer group/wire'
                }`}
              >
                {/* Active Signal Path Energized Glow Effect */}
                {showSignalPath && isWireActive && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="8"
                    strokeOpacity="0.4"
                    strokeLinecap="round"
                    className="animate-pulse pointer-events-none"
                  />
                )}

                {/* Invisible wide stroke for easier clicking in edit mode */}
                {!isInteractiveMode && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="18"
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectWire(wire.id);
                      onSelectComponent(null);
                    }}
                  />
                )}

                {/* Selected Wire Glowing Selection Halo */}
                {isSelected && !isInteractiveMode && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="9"
                    strokeOpacity="0.45"
                    strokeLinecap="round"
                    className="animate-pulse"
                  />
                )}

                {/* Wire 3D Shadow (casting shadow onto cavity and components beneath) */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={isDark ? 'rgba(0,0,0,0.5)' : 'rgba(15,23,42,0.3)'}
                  strokeWidth={isSelected && !isInteractiveMode ? '6.5' : '5'}
                  strokeLinecap="round"
                  transform="translate(1, 2.5)"
                />

                {/* Wire Outer Casing (Guarantees sharp contrast for all wire colors in light & dark modes) */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={
                    isDark
                      ? 'rgba(9,9,11,0.8)'
                      : (wire.color === '#f8fafc' || wire.color.toLowerCase() === '#ffffff'
                          ? 'rgba(30,41,59,0.9)'
                          : 'rgba(15,23,42,0.75)')
                  }
                  strokeWidth={isSelected && !isInteractiveMode ? '5.8' : '4.8'}
                  strokeLinecap="round"
                />

                {/* Main Vintage Cloth Wire Stroke (in front of component bodies) */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={wire.color}
                  strokeWidth={isSelected && !isInteractiveMode ? '4.5' : '3.5'}
                  strokeLinecap="round"
                  filter={isSelected && !isInteractiveMode ? 'url(#active-wire-glow)' : 'url(#wire-glow)'}
                  onClick={(e) => {
                    if (isInteractiveMode) return;
                    e.stopPropagation();
                    onSelectWire(wire.id);
                    onSelectComponent(null);
                  }}
                />

                {/* Cloth Braided Texture Highlights */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={
                    wire.color === '#f8fafc' || wire.color.toLowerCase() === '#ffffff'
                      ? (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.25)')
                      : (isDark ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.45)')
                  }
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                  className="pointer-events-none"
                />
              </g>
            );
          })}

          {/* Pending Wire while user is connecting terminals */}
          {pendingWire && (
            <g className="pointer-events-none">
              <path
                d={`M ${pendingWire.startX} ${pendingWire.startY} Q ${
                  (pendingWire.startX + pendingWire.currentX) / 2
                } ${
                  (pendingWire.startY + pendingWire.currentY) / 2 + 30
                } ${pendingWire.currentX} ${pendingWire.currentY}`}
                fill="none"
                stroke={activeWireColor}
                strokeWidth="3.5"
                strokeDasharray="6 4"
                className="animate-pulse"
              />
              <circle
                cx={pendingWire.currentX}
                cy={pendingWire.currentY}
                r="5"
                fill={activeWireColor}
                stroke="#fff"
                strokeWidth="2"
              />
            </g>
          )}

          {/* Terminal Pins & Solder Lugs (Rendered inside SVG directly over wire endpoints for guaranteed dead-center alignment) */}
          {state.components.map((comp) => {
            const compX = dragPos && dragPos.id === comp.id ? dragPos.x : comp.x;
            const compY = dragPos && dragPos.id === comp.id ? dragPos.y : comp.y;
            const terminals = getComponentTerminals(comp);

            return terminals.map((term) => {
              const cx = compX + term.x;
              const cy = compY + term.y;
              const termKey = `${comp.id}:${term.id}`;
              const isTermSignalActive = !showSignalPath || (signalPathInfo?.activeTerminalKeys.has(termKey) ?? true);
              const isActive =
                pendingWire &&
                pendingWire.fromComponentId === comp.id &&
                pendingWire.fromTerminalId === term.id;

              const connectedWires = state.wires.filter(
                (w) =>
                  (w.fromComponentId === comp.id && w.fromTerminalId === term.id) ||
                  (w.toComponentId === comp.id && w.toTerminalId === term.id)
              );
              const hasWires = connectedWires.length > 0;
              const isConnectedToSelectedWire =
                !isInteractiveMode &&
                selectedWire &&
                ((selectedWire.fromComponentId === comp.id && selectedWire.fromTerminalId === term.id) ||
                  (selectedWire.toComponentId === comp.id && selectedWire.toTerminalId === term.id));

              // In interactive mode, only render solder eyelet for connected pins so cavity is clean
              if (isInteractiveMode) {
                if (!hasWires) return null;
                return (
                  <g
                    key={`${comp.id}-${term.id}`}
                    opacity={showSignalPath && !isTermSignalActive ? 0.2 : 1.0}
                    className="pointer-events-none transition-opacity duration-300"
                  >
                    <circle cx={cx} cy={cy} r="6" fill="#18181b" stroke="#71717a" strokeWidth="1.5" />
                    <circle cx={cx} cy={cy} r="3.5" fill="#cbd5e1" stroke="#475569" strokeWidth="0.8" />
                    <circle cx={cx - 0.7} cy={cy - 0.7} r="1.3" fill="#ffffff" />
                    {showSignalPath && isTermSignalActive && (
                      <circle cx={cx} cy={cy} r="8.5" fill="none" stroke="#10b981" strokeWidth="1.2" strokeOpacity="0.75" className="animate-pulse" />
                    )}
                  </g>
                );
              }

              // Edit Mode: Sleek, refined hardware solder lugs with concentric center alignment
              const lugColor =
                isActive
                  ? '#f59e0b'
                  : hasWires
                  ? '#fbbf24'
                  : term.type === 'ground'
                  ? '#a1a1aa'
                  : term.type === 'switch-common'
                  ? '#fb923c'
                  : '#fef08a';

              return (
                <g
                  key={`${comp.id}-${term.id}`}
                  opacity={showSignalPath && !isTermSignalActive ? 0.2 : 1.0}
                  className="cursor-crosshair pointer-events-auto group/pin transition-opacity duration-300"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleTerminalMouseDown(comp, term, e);
                  }}
                >
                  {/* Active target pulse ring when creating a wire or when terminal belongs to selected wire */}
                  {(isActive || isConnectedToSelectedWire) && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r="10"
                      fill="none"
                      stroke={isConnectedToSelectedWire ? '#fbbf24' : '#f59e0b'}
                      strokeWidth="2"
                      strokeDasharray={isConnectedToSelectedWire ? undefined : '4 2'}
                      className="animate-pulse pointer-events-none"
                    />
                  )}

                  {/* Hover Halo Ring (Sleek golden glow on hover, zero coordinate shift) */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r="8.5"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="1.2"
                    opacity="0"
                    className="transition-opacity duration-150 group-hover/pin:opacity-100 pointer-events-none"
                  />

                  {/* Outer Solder Lug Eyelet Ring - Refined 5.5px radius */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r="5.5"
                    fill="#18181b"
                    stroke={lugColor}
                    strokeWidth={isActive ? '2.2' : '1.5'}
                    filter="url(#wire-glow)"
                    className="transition-colors duration-150 group-hover/pin:stroke-white pointer-events-none"
                  />

                  {/* Center Eyelet Solder Hole - Exact origin of wires */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r="2.2"
                    fill={hasWires ? '#f59e0b' : '#09090b'}
                    stroke="#3f3f46"
                    strokeWidth="0.5"
                    className="pointer-events-none"
                  />

                  {/* Shiny Molten Solder Bead when wires are connected */}
                  {hasWires && (
                    <g className="pointer-events-none">
                      <circle cx={cx} cy={cy} r="3" fill="#cbd5e1" stroke="#475569" strokeWidth="0.5" />
                      <circle cx={cx - 0.7} cy={cy - 0.7} r="1.1" fill="#ffffff" />
                    </g>
                  )}

                  {/* Sleek Floating Hover Tooltip (Appears ONLY on pin hover - Zero canvas clutter!) */}
                  <g className="pointer-events-none select-none opacity-0 group-hover/pin:opacity-100 transition-opacity duration-150">
                    <rect
                      x={cx - 40}
                      y={cy - 24}
                      width="80"
                      height="16"
                      rx="4"
                      fill="#09090b"
                      stroke="#f59e0b"
                      strokeWidth="1"
                      filter="url(#wire-glow)"
                    />
                    <text
                      x={cx}
                      y={cy - 13}
                      textAnchor="middle"
                      fill="#fef08a"
                      fontSize="8"
                      fontFamily="ui-monospace, monospace"
                      fontWeight="bold"
                    >
                      {term.label}
                    </text>
                  </g>

                  {/* Transparent hit area for easy, reliable clicking */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r="10"
                    fill="transparent"
                    className="cursor-crosshair"
                  />
                </g>
              );
            });
          })}
        </svg>

        {/* Layer 3: Selected Wire Floating Action Bar & Live Color Palette */}
        {selectedWire && !isInteractiveMode && (() => {
          const p1 = getTerminalAbsolutePos(selectedWire.fromComponentId, selectedWire.fromTerminalId);
          const p2 = getTerminalAbsolutePos(selectedWire.toComponentId, selectedWire.toTerminalId);
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.hypot(dx, dy);
          const sag = Math.min(80, Math.max(15, dist * 0.15));

          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2 + sag * 0.75;

          const fromComp = state.components.find((c) => c.id === selectedWire.fromComponentId);
          const toComp = state.components.find((c) => c.id === selectedWire.toComponentId);
          const fromTerm = fromComp ? getComponentTerminals(fromComp).find((t) => t.id === selectedWire.fromTerminalId) : null;
          const toTerm = toComp ? getComponentTerminals(toComp).find((t) => t.id === selectedWire.toTerminalId) : null;

          return (
            <div
              className="absolute z-30 -translate-x-1/2 -translate-y-full mb-3 pointer-events-auto select-none animate-in fade-in zoom-in-95 duration-150"
              style={{ left: midX, top: midY - 10 }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div
                className="bg-white/95 dark:bg-zinc-900/95 border border-zinc-300 dark:border-zinc-700/90 rounded-xl p-2 shadow-2xl backdrop-blur-md flex flex-col gap-1.5 w-[156px] ring-1 ring-amber-500/20"
                title={`${fromComp?.name || 'Lug'}:${fromTerm?.label || ''} ➔ ${toComp?.name || 'Lug'}:${toTerm?.label || ''}`}
              >
                {/* Header row: Connection info & delete button */}
                <div className="flex items-center justify-between gap-1 border-b border-zinc-200 dark:border-zinc-800 pb-1 px-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 border border-zinc-400 dark:border-white/60 shadow-sm"
                      style={{ backgroundColor: selectedWire.color }}
                    />
                    <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-300 truncate">
                      Wire Color
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteWire(selectedWire.id);
                      }}
                      className="p-1 rounded text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                      title="Delete Wire (Del)"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectWire(null);
                      }}
                      className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      title="Deselect Wire (Esc)"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Compact 2-Row Swatch Grid (6 cols x 2 rows) */}
                <div className="grid grid-cols-6 gap-1 pt-0.5 justify-items-center">
                  {WIRE_COLOR_OPTIONS.map(({ color, label, isDark: colorIsDark }) => {
                    const isCurrent = (selectedWire.color || '').toLowerCase() === color.toLowerCase();
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateWire?.(selectedWire.id, { color });
                        }}
                        title={label}
                        className={`w-4 h-4 rounded-full border transition-all flex items-center justify-center relative ${
                          isCurrent
                            ? 'border-zinc-900 dark:border-white scale-125 shadow-md shadow-amber-400/40 ring-1 ring-amber-400/60 z-10'
                            : 'border-zinc-300 dark:border-zinc-700 hover:scale-110 hover:border-zinc-500 dark:hover:border-zinc-300'
                        }`}
                        style={{ backgroundColor: color }}
                      >
                        {isCurrent && (
                          <Check
                            className={`w-2 h-2 stroke-[3] ${
                              colorIsDark || color === '#18181b' ? 'text-white' : 'text-zinc-950'
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}

                  {/* Custom Color Input */}
                  <label
                    title="Custom color hex"
                    className="w-4 h-4 rounded-full border border-zinc-400 dark:border-zinc-600 hover:border-zinc-900 dark:hover:border-white hover:scale-110 cursor-pointer overflow-hidden relative flex items-center justify-center bg-gradient-to-br from-red-500 via-amber-400 via-emerald-400 to-blue-500 shadow-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="color"
                      value={selectedWire.color || '#eab308'}
                      onChange={(e) => {
                        e.stopPropagation();
                        onUpdateWire?.(selectedWire.id, { color: e.target.value });
                      }}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Floating Canvas Zoom, View, Signal Path & Interactive Controls */}
      <div
        className="absolute bottom-4 left-4 z-30 flex flex-col bg-white/95 dark:bg-zinc-900/95 backdrop-blur border border-zinc-300 dark:border-zinc-700/80 rounded-xl shadow-xl text-zinc-800 dark:text-zinc-200 select-none overflow-hidden max-w-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Controls Row */}
        <div className="flex items-center gap-1.5 p-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.0, z + 0.15))}
            title="Zoom In"
            className="w-7 h-7 flex items-center justify-center font-bold hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded font-mono text-sm cursor-pointer"
          >
            +
          </button>
          <span className="text-[11px] font-mono text-zinc-700 dark:text-zinc-300 font-bold px-1 w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
            title="Zoom Out"
            className="w-7 h-7 flex items-center justify-center font-bold hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded font-mono text-sm cursor-pointer"
          >
            -
          </button>
          <div className="w-[1px] h-4 bg-zinc-300 dark:bg-zinc-700 mx-0.5" />
          <button
            type="button"
            onClick={() => {
              setZoom(1.0);
              setPan({ x: 40, y: 30 });
            }}
            title="Reset View"
            className="px-2 h-7 flex items-center text-[10px] font-mono font-bold hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded cursor-pointer"
          >
            Reset View
          </button>

          {onToggleSignalPath && (
            <>
              <div className="w-[1px] h-4 bg-zinc-300 dark:bg-zinc-700 mx-0.5" />
              <button
                type="button"
                onClick={onToggleSignalPath}
                title={showSignalPath ? 'Hide Signal Path trace' : 'Show Signal Path trace'}
                className={`px-2 h-7 flex items-center gap-1.5 text-[10px] font-mono font-bold rounded transition-all cursor-pointer ${
                  showSignalPath
                    ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                    : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800'
                }`}
              >
                <Zap className={`w-3 h-3 ${showSignalPath ? 'fill-current' : ''}`} />
                <span>Signal Path {showSignalPath ? 'ON' : 'OFF'}</span>
              </button>
            </>
          )}

          {onToggleInteractiveMode && (
            <>
              <div className="w-[1px] h-4 bg-zinc-300 dark:bg-zinc-700 mx-0.5" />
              <button
                type="button"
                onClick={onToggleInteractiveMode}
                title={
                  isInteractiveMode
                    ? 'Interactive Mode: Controls live, canvas locked. Click to switch to Edit mode.'
                    : 'Edit Mode: Drag parts and wire lugs. Click to switch to Interactive mode.'
                }
                className={`px-2.5 h-7 flex items-center gap-1.5 text-[10px] font-mono font-bold rounded transition-all cursor-pointer ${
                  isInteractiveMode
                    ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400/40'
                    : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800'
                }`}
              >
                <Gamepad2 className={`w-3 h-3 ${isInteractiveMode ? 'fill-current' : ''}`} />
                <span>Interactive {isInteractiveMode ? 'ON' : 'OFF'}</span>
              </button>
            </>
          )}
        </div>

        {/* Info messages displayed below the floating panel at the bottom */}
        {(isInteractiveMode || showSignalPath) && (
          <div className="border-t border-zinc-200 dark:border-zinc-800/80 px-2.5 py-1.5 text-[10px] font-mono flex flex-col gap-1 bg-zinc-50/80 dark:bg-zinc-950/50">
            {isInteractiveMode && (
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="font-bold">Interactive Mode:</span>
                <span className="text-zinc-600 dark:text-zinc-300">Controls live • Canvas locked</span>
              </div>
            )}
            {showSignalPath && (
              <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    signalPathInfo?.hasSignalPath ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span className="font-bold text-emerald-700 dark:text-emerald-400">Signal Path:</span>
                <span>
                  {signalPathInfo?.hasSignalPath
                    ? `${signalPathInfo.activeComponentIds.size} components • ${signalPathInfo.activeWireIds.size} wires active to Jack`
                    : 'No closed circuit from pickups to Jack'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Instructions Overlay Banner */}
      {!isInteractiveMode && pendingWire && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-amber-500 text-zinc-950 px-4 py-1.5 rounded-full font-mono text-xs font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <span>Click any destination lug to complete wire</span>
          <button
            type="button"
            onClick={() => setPendingWire(null)}
            className="ml-2 underline text-[11px]"
          >
            Cancel (Esc)
          </button>
        </div>
      )}
    </div>
  );
};
