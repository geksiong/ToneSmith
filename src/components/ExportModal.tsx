import React, { useState, useMemo, useRef } from 'react';
import { CircuitState, WiringPreset } from '../types/guitar';
import { getComponentTerminals, COMPONENT_METADATA } from '../lib/componentDefs';
import { PickupColorCodesVisual } from './PickupColorCodesVisual';
import {
  Download,
  FileText,
  Copy,
  Check,
  X,
  Layers,
  Palette,
  FileCode,
  Code2,
  FileCheck2,
  BookOpen,
  Sun,
  Moon,
  Laptop,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Image,
  Loader2,
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: CircuitState;
  activePreset?: WiringPreset;
  theme?: 'dark' | 'light';
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  state,
  activePreset,
  theme = 'dark',
}) => {
  const [activeTab, setActiveTab] = useState<'schematic' | 'bom' | 'colorcodes' | 'json'>('schematic');
  const [svgThemeMode, setSvgThemeMode] = useState<'match' | 'light' | 'dark'>('match');
  const [copied, setCopied] = useState(false);
  const [isPrettyJson, setIsPrettyJson] = useState(true);
  const [customFilename, setCustomFilename] = useState(() => {
    const base = activePreset
      ? activePreset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      : 'custom-circuit';
    return `tonesmith-${base}.json`;
  });

  const effectiveSvgTheme = svgThemeMode === 'match' ? theme : svgThemeMode;
  const isDark = effectiveSvgTheme === 'dark';

  // Zoom & Pan state for Schematic SVG preview
  const [zoom, setZoom] = useState(1.0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // High-Resolution PNG export states
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [pngScale, setPngScale] = useState<number>(2);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!previewContainerRef.current) return;
    setIsPanning(true);
    setPanStart({
      x: e.clientX,
      y: e.clientY,
      scrollLeft: previewContainerRef.current.scrollLeft,
      scrollTop: previewContainerRef.current.scrollTop,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning || !previewContainerRef.current) return;
    e.preventDefault();
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    previewContainerRef.current.scrollLeft = panStart.scrollLeft - dx;
    previewContainerRef.current.scrollTop = panStart.scrollTop - dy;
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.2 : -0.2;
      setZoom((prev) => Math.min(3.0, Math.max(0.5, +(prev + delta).toFixed(2))));
    }
  };

  const jsonContent = useMemo(() => {
    return isPrettyJson ? JSON.stringify(state, null, 2) : JSON.stringify(state);
  }, [state, isPrettyJson]);

  const jsonStats = useMemo(() => {
    const bytes = new Blob([jsonContent]).size;
    const kb = (bytes / 1024).toFixed(1);
    const pickupsCount = state.components.filter((c) => c.type.startsWith('pickup')).length;
    const potsCount = state.components.filter((c) => c.type.startsWith('pot')).length;
    const switchesCount = state.components.filter((c) => c.type.startsWith('switch')).length;
    const capsCount = state.components.filter((c) => c.type === 'capacitor').length;
    return {
      bytes,
      kb,
      componentsCount: state.components.length,
      wiresCount: state.wires.length,
      pickupsCount,
      potsCount,
      switchesCount,
      capsCount,
    };
  }, [state, jsonContent]);

  if (!isOpen) return null;

  // Bill of Materials generation
  const bomMap = new Map<string, { count: number; name: string; specs: string }>();
  for (const comp of state.components) {
    const key = `${comp.type}-${comp.name}`;
    let specs = '';
    if (comp.properties.resistanceK) specs += `${comp.properties.resistanceK}kΩ `;
    if (comp.properties.taper) specs += `${comp.properties.taper} taper `;
    if (comp.properties.capacitanceUf) specs += `${comp.properties.capacitanceUf}µF `;
    if (comp.properties.inductanceH) specs += `(${comp.properties.inductanceH}H) `;

    if (bomMap.has(key)) {
      bomMap.get(key)!.count++;
    } else {
      bomMap.set(key, { count: 1, name: comp.name, specs });
    }
  }

  // Generate SVG string with accurate non-cropped bounds and theme-aware styling
  const generateSvgString = (forDownload: boolean = false) => {
    const bgFill = isDark ? '#09090b' : '#ffffff';
    const gridDot = isDark ? '#27272a' : '#e2e8f0';
    const titleFill = isDark ? '#f59e0b' : '#b45309';
    const subtitleFill = isDark ? '#71717a' : '#64748b';
    const compBoxFill = isDark ? '#18181b' : '#f8fafc';
    const compBoxStroke = isDark ? '#3f3f46' : '#cbd5e1';
    const compTitleFill = isDark ? '#f4f4f5' : '#0f172a';
    const compTypeFill = isDark ? '#a1a1aa' : '#64748b';
    const lugOuter = isDark ? '#27272a' : '#f1f5f9';
    const lugStroke = isDark ? '#f59e0b' : '#d97706';
    const lugText = isDark ? '#e4e4e7' : '#334155';
    const jointFill = isDark ? '#cbd5e1' : '#f1f5f9';
    const jointStroke = isDark ? '#334155' : '#64748b';

    if (state.components.length === 0) {
      const w = 900;
      const h = 500;
      const sizeAttrs = forDownload
        ? `width="${w}" height="${h}"`
        : `width="100%" height="100%" preserveAspectRatio="xMidYMid meet"`;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ${sizeAttrs} style="background-color: ${bgFill}; font-family: 'JetBrains Mono', monospace;">
        <rect width="${w}" height="${h}" fill="${bgFill}" />
        <text x="${w / 2}" y="${h / 2}" fill="${subtitleFill}" font-size="14" text-anchor="middle">Canvas is empty. Add components from the library to generate a schematic.</text>
      </svg>`;
    }

    // Accurate component and wire bounds computation
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const comp of state.components) {
      const meta = COMPONENT_METADATA[comp.type];
      const compW = meta?.defaultWidth ?? 180;
      const compH = meta?.defaultHeight ?? 80;

      minX = Math.min(minX, comp.x);
      minY = Math.min(minY, comp.y);
      maxX = Math.max(maxX, comp.x + compW);
      maxY = Math.max(maxY, comp.y + compH);

      const terms = getComponentTerminals(comp);
      for (const t of terms) {
        minX = Math.min(minX, comp.x + t.x - 25);
        maxX = Math.max(maxX, comp.x + t.x + 25);
        minY = Math.min(minY, comp.y + t.y - 18);
        maxY = Math.max(maxY, comp.y + t.y + 18);
      }
    }

    // Include wire sag curves in bounding box
    for (const wire of state.wires) {
      const c1 = state.components.find((c) => c.id === wire.fromComponentId);
      const c2 = state.components.find((c) => c.id === wire.toComponentId);
      if (!c1 || !c2) continue;
      const t1 = getComponentTerminals(c1).find((t) => t.id === wire.fromTerminalId);
      const t2 = getComponentTerminals(c2).find((t) => t.id === wire.toTerminalId);
      if (!t1 || !t2) continue;

      const p1x = c1.x + t1.x;
      const p1y = c1.y + t1.y;
      const p2x = c2.x + t2.x;
      const p2y = c2.y + t2.y;
      const dx = p2x - p1x;
      const dy = p2y - p1y;
      const sag = Math.min(60, Math.max(15, Math.hypot(dx, dy) * 0.15));

      const cp1x = p1x + dx * 0.25;
      const cp1y = p1y + dy * 0.25 + sag;
      const cp2x = p1x + dx * 0.75;
      const cp2y = p1y + dy * 0.75 + sag;

      minX = Math.min(minX, p1x, p2x, cp1x, cp2x);
      maxX = Math.max(maxX, p1x, p2x, cp1x, cp2x);
      minY = Math.min(minY, p1y, p2y, cp1y, cp2y);
      maxY = Math.max(maxY, p1y, p2y, cp1y, cp2y);
    }

    // Layout margins
    const headerHeight = 90;
    const padding = 50;
    const contentW = maxX - minX;
    const contentH = maxY - minY;

    const w = Math.max(900, Math.ceil(contentW + padding * 2));
    const h = Math.max(620, Math.ceil(contentH + headerHeight + padding * 2));

    // Center content horizontally and pad below header banner
    const offsetX = padding - minX + (w - (contentW + padding * 2)) / 2;
    const offsetY = headerHeight + padding - minY;

    const escapeXml = (unsafe: string) => {
      return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const sizeAttrs = forDownload
      ? `width="${w}" height="${h}"`
      : `width="100%" height="100%" preserveAspectRatio="xMidYMid meet"`;

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ${sizeAttrs} style="background-color: ${bgFill}; font-family: 'JetBrains Mono', monospace;">
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="1" fill="${gridDot}" />
        </pattern>
      </defs>
      <rect width="${w}" height="${h}" fill="${bgFill}" />
      <rect width="${w}" height="${h}" fill="url(#grid)" />
      
      <!-- Schematic Header Banner -->
      <g transform="translate(30, 24)">
        <text x="0" y="24" fill="${titleFill}" font-size="18" font-weight="bold" font-family="'JetBrains Mono', monospace">TONESMITH GUITAR WIRING SCHEMATIC</text>
        <text x="0" y="44" fill="${subtitleFill}" font-size="11" font-family="'JetBrains Mono', monospace">${
          escapeXml(activePreset ? activePreset.name : 'Custom Circuit')
        } • ${state.components.length} Components • ${state.wires.length} Connections</text>
      </g>
    `;

    // Render components
    for (const comp of state.components) {
      const x = comp.x + offsetX;
      const y = comp.y + offsetY;
      const terms = getComponentTerminals(comp);

      const meta = COMPONENT_METADATA[comp.type];
      const compW = meta?.defaultWidth ?? 180;
      const compH = meta?.defaultHeight ?? 80;

      svgContent += `
        <g transform="translate(${x}, ${y})">
          <rect width="${compW}" height="${compH}" rx="8" fill="${compBoxFill}" stroke="${compBoxStroke}" stroke-width="1.5" />
          <text x="12" y="22" fill="${compTitleFill}" font-size="11" font-weight="bold">${escapeXml(comp.name)}</text>
          <text x="12" y="38" fill="${compTypeFill}" font-size="9">${escapeXml(comp.type)}</text>
      `;

      for (const t of terms) {
        svgContent += `
          <circle cx="${t.x}" cy="${t.y}" r="5.5" fill="${lugOuter}" stroke="${lugStroke}" stroke-width="1.5" />
          <circle cx="${t.x}" cy="${t.y}" r="2" fill="${lugStroke}" />
          <text x="${t.x}" y="${t.y - 8}" fill="${lugText}" font-size="8" font-weight="600" text-anchor="middle">${escapeXml(t.label)}</text>
        `;
      }

      svgContent += `</g>`;
    }

    // Render wires in front of components
    for (const wire of state.wires) {
      const c1 = state.components.find((c) => c.id === wire.fromComponentId);
      const c2 = state.components.find((c) => c.id === wire.toComponentId);
      if (!c1 || !c2) continue;
      const t1 = getComponentTerminals(c1).find((t) => t.id === wire.fromTerminalId);
      const t2 = getComponentTerminals(c2).find((t) => t.id === wire.toTerminalId);
      if (!t1 || !t2) continue;

      const p1x = c1.x + t1.x + offsetX;
      const p1y = c1.y + t1.y + offsetY;
      const p2x = c2.x + t2.x + offsetX;
      const p2y = c2.y + t2.y + offsetY;

      const dx = p2x - p1x;
      const dy = p2y - p1y;
      const sag = Math.min(60, Math.max(15, Math.hypot(dx, dy) * 0.15));

      const cp1x = p1x + dx * 0.25;
      const cp1y = p1y + dy * 0.25 + sag;
      const cp2x = p1x + dx * 0.75;
      const cp2y = p1y + dy * 0.75 + sag;

      // Ensure contrast: if wire is pure white on light background or black on dark background, add border outline
      const isWhiteWire = wire.color.toLowerCase() === '#f8fafc' || wire.color.toLowerCase() === '#ffffff';
      const isBlackWire = wire.color.toLowerCase() === '#18181b' || wire.color.toLowerCase() === '#000000';

      if (isWhiteWire && !isDark) {
        svgContent += `<path d="M ${p1x} ${p1y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2x} ${p2y}" fill="none" stroke="#94a3b8" stroke-width="5" stroke-linecap="round" />`;
      } else if (isBlackWire && isDark) {
        svgContent += `<path d="M ${p1x} ${p1y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2x} ${p2y}" fill="none" stroke="#52525b" stroke-width="5" stroke-linecap="round" />`;
      }

      svgContent += `
        <path d="M ${p1x} ${p1y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2x} ${p2y}" fill="none" stroke="${wire.color}" stroke-width="3.5" stroke-linecap="round" />
        <circle cx="${p1x}" cy="${p1y}" r="4" fill="${jointFill}" stroke="${jointStroke}" stroke-width="1.2" />
        <circle cx="${p2x}" cy="${p2y}" r="4" fill="${jointFill}" stroke="${jointStroke}" stroke-width="1.2" />
      `;
    }

    svgContent += `</svg>`;
    return svgContent;
  };

  const handleDownloadSvg = () => {
    const svgStr = generateSvgString(true);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guitar-schematic-${effectiveSvgTheme}-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPng = async () => {
    if (isExportingPng) return;
    setIsExportingPng(true);

    try {
      const svgStr = generateSvgString(true);

      // Extract width and height from SVG attributes
      let baseW = 900;
      let baseH = 620;
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgStr, 'image/svg+xml');
        const svgEl = doc.documentElement;
        if (svgEl) {
          const parsedW = parseFloat(svgEl.getAttribute('width') || '');
          const parsedH = parseFloat(svgEl.getAttribute('height') || '');
          if (!isNaN(parsedW) && parsedW > 0) baseW = parsedW;
          if (!isNaN(parsedH) && parsedH > 0) baseH = parsedH;
        }
      } catch {
        // Fallback default
      }

      const scale = pngScale || 2;
      const canvasW = Math.round(baseW * scale);
      const canvasH = Math.round(baseH * scale);

      const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      await new Promise<void>((resolve, reject) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = canvasW;
            canvas.height = canvasH;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Canvas 2D context is not available'));
              return;
            }

            // High-definition rendering
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Solid background matching active theme
            ctx.fillStyle = isDark ? '#09090b' : '#ffffff';
            ctx.fillRect(0, 0, canvasW, canvasH);

            // Draw SVG circuit image to canvas
            ctx.drawImage(img, 0, 0, canvasW, canvasH);

            // Convert canvas to Blob
            canvas.toBlob((pngBlob) => {
              if (!pngBlob) {
                reject(new Error('Failed to create PNG blob from canvas'));
                return;
              }

              const pngUrl = URL.createObjectURL(pngBlob);
              const a = document.createElement('a');
              const baseName = activePreset
                ? activePreset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                : 'custom-circuit';
              a.download = `guitar-schematic-${baseName}-${effectiveSvgTheme}-${scale}x-${Date.now()}.png`;
              a.href = pngUrl;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);

              setTimeout(() => {
                URL.revokeObjectURL(pngUrl);
              }, 1500);

              resolve();
            }, 'image/png');
          } catch (err) {
            reject(err);
          }
        };

        img.onerror = (err) => {
          reject(err || new Error('SVG image failed to load'));
        };

        img.src = svgUrl;
      });

      URL.revokeObjectURL(svgUrl);
    } catch (err) {
      console.error('Failed to export PNG:', err);
    } finally {
      setIsExportingPng(false);
    }
  };

  const handleDownloadJson = () => {
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = customFilename.endsWith('.json') ? customFilename : `${customFilename}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyJson = () => {
    navigator.clipboard.writeText(jsonContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden text-zinc-900 dark:text-zinc-100 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-950 dark:text-zinc-100 font-mono">
                EXPORT SCHEMATIC & BOM
              </h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Vector SVG wiring diagram, Bill of Materials (BOM), 4-conductor color codes, and JSON
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 overflow-x-auto">
          {[
            { id: 'schematic', label: 'Schematic SVG', icon: Layers },
            { id: 'bom', label: 'Bill of Materials (BOM)', icon: FileText },
            { id: 'colorcodes', label: 'Pickup Color Codes', icon: Palette },
            { id: 'json', label: 'JSON Schematic', icon: FileCode },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
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

        {/* Content Area */}
        <div className="p-4 overflow-y-auto max-h-[62vh] space-y-4">
          {activeTab === 'schematic' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-100 font-mono">Vector Schematic Export</h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    High-resolution vector diagram. Use zoom controls or drag to inspect joints and lugs.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Zoom Controls */}
                  <div className="flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                      disabled={zoom <= 0.5}
                      title="Zoom Out (-)"
                      className="p-1 rounded-md text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoom(1.0)}
                      title="Click to reset to 100%"
                      className="px-2 py-0.5 text-[11px] font-bold text-zinc-800 dark:text-zinc-200 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer min-w-[46px] text-center"
                    >
                      {Math.round(zoom * 100)}%
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.min(3.0, +(z + 0.25).toFixed(2)))}
                      disabled={zoom >= 3.0}
                      title="Zoom In (+)"
                      className="p-1 rounded-md text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoom(1.0)}
                      title="Fit to window"
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer text-[10px]"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Fit</span>
                    </button>
                  </div>

                  {/* Theme Switcher Toggle for Schematic */}
                  <div className="flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => setSvgThemeMode('match')}
                      title="Match application mode"
                      className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer ${
                        svgThemeMode === 'match'
                          ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-zinc-100 font-bold shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                      }`}
                    >
                      <Laptop className="w-3 h-3" />
                      <span>App Theme</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSvgThemeMode('light')}
                      title="Printable black-on-white schematic"
                      className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer ${
                        svgThemeMode === 'light'
                          ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-zinc-100 font-bold shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                      }`}
                    >
                      <Sun className="w-3 h-3 text-amber-500" />
                      <span>Light</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSvgThemeMode('dark')}
                      title="Dark blueprint schematic"
                      className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer ${
                        svgThemeMode === 'dark'
                          ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-zinc-100 font-bold shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                      }`}
                    >
                      <Moon className="w-3 h-3 text-indigo-400" />
                      <span>Dark</span>
                    </button>
                  </div>

                  {/* PNG Resolution Scale Selector */}
                  <div className="flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-mono">
                    <span className="px-1.5 text-[10px] text-zinc-500 font-bold uppercase tracking-wider select-none">
                      PNG
                    </span>
                    {([1, 2, 3] as const).map((scale) => (
                      <button
                        key={scale}
                        type="button"
                        onClick={() => setPngScale(scale)}
                        title={`${scale}× Resolution (${scale === 1 ? 'Standard' : scale === 2 ? 'High-Def / 2K' : 'Ultra-HD / 300 DPI'})`}
                        className={`px-1.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                          pngScale === scale
                            ? 'bg-white dark:bg-zinc-700 text-amber-600 dark:text-amber-400 shadow-xs'
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                        }`}
                      >
                        {scale}×
                      </button>
                    ))}
                  </div>

                  {/* Export High-Resolution PNG Button */}
                  <button
                    type="button"
                    onClick={handleDownloadPng}
                    disabled={isExportingPng}
                    title={`Export circuit diagram as high-resolution ${pngScale}× PNG image`}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-400 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-amber-300 text-xs font-mono font-bold transition-all border border-amber-500/40 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                  >
                    {isExportingPng ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                        <span>Rendering PNG...</span>
                      </>
                    ) : (
                      <>
                        <Image className="w-4 h-4 text-amber-500" />
                        <span>Export PNG</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadSvg}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-mono font-bold transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download SVG</span>
                  </button>
                </div>
              </div>

              {/* Responsive Live Preview Container with Zoom and Pan */}
              <div
                ref={previewContainerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                onDoubleClick={() => setZoom((z) => (z === 1.0 ? 1.75 : 1.0))}
                className={`w-full h-[410px] rounded-xl border relative overflow-auto flex items-center justify-center transition-colors shadow-inner select-none ${
                  isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-300'
                } ${zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
                title={zoom > 1 ? 'Click and drag to pan' : 'Double-click to toggle zoom'}
              >
                <div
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: isPanning ? 'none' : 'transform 0.12s ease-out',
                    width: '100%',
                    height: '100%',
                    minWidth: '100%',
                    minHeight: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: isPanning ? 'none' : 'auto',
                  }}
                  dangerouslySetInnerHTML={{ __html: generateSvgString(false) }}
                />

                {/* Subtle Viewport Info Overlay */}
                <div
                  className={`absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-md text-[10px] font-mono pointer-events-none flex items-center gap-1.5 backdrop-blur-xs border transition-colors ${
                    isDark
                      ? 'bg-black/75 text-zinc-300 border-white/10 shadow-md'
                      : 'bg-white text-zinc-700 border-zinc-300 shadow-sm'
                  }`}
                >
                  <span className={`font-bold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                    {Math.round(zoom * 100)}%
                  </span>
                  <span className={isDark ? 'text-zinc-500' : 'text-zinc-400'}>•</span>
                  <span className={isDark ? 'text-zinc-300' : 'text-zinc-600'}>
                    {zoom > 1 ? 'Drag to pan' : 'Ctrl+Scroll / Double-click to zoom'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bom' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-100 font-mono">Parts Checklist for Physical Build</h3>
                <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400 font-medium">{state.components.length} components total</span>
              </div>

              <div className="border border-zinc-300 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-zinc-100 text-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-400 border-b border-zinc-300 dark:border-zinc-800 font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-3">Qty</th>
                      <th className="py-2.5 px-3">Component Specs & Values</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {Array.from(bomMap.entries()).map(([key, item]) => (
                      <tr key={key} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                        <td className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold border border-amber-500/30">
                            {item.count}×
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400">{item.specs || 'Standard hardware'}</td>
                      </tr>
                    ))}
                    {/* Wires row */}
                    <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      <td className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-zinc-100">Hookup Cloth Wire (22 AWG)</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold">
                          {state.wires.length} runs
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400">
                        {Array.from(new Set(state.wires.map((w) => w.color))).length} colors used
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'colorcodes' && (
            <PickupColorCodesVisual theme={effectiveSvgTheme} />
          )}

          {activeTab === 'json' && (
            <div className="flex flex-col gap-3">
              {/* Stats & Metadata Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 bg-zinc-100/60 dark:bg-zinc-950/40 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-mono">
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <Layers className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <div className="text-[10px] text-zinc-500">Components</div>
                    <div className="font-bold text-zinc-950 dark:text-zinc-100">
                      {jsonStats.componentsCount} ({jsonStats.pickupsCount} pu · {jsonStats.potsCount} pot · {jsonStats.switchesCount} sw)
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <Code2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div>
                    <div className="text-[10px] text-zinc-500">Wires & Nets</div>
                    <div className="font-bold text-zinc-950 dark:text-zinc-100">
                      {jsonStats.wiresCount} connections
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <FileCheck2 className="w-4 h-4 text-blue-500 shrink-0" />
                  <div>
                    <div className="text-[10px] text-zinc-500">File Size</div>
                    <div className="font-bold text-zinc-950 dark:text-zinc-100">
                      {jsonStats.kb} KB ({jsonStats.bytes.toLocaleString()} B)
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <BookOpen className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <div className="text-[10px] text-zinc-500">Preset Context</div>
                    <div className="font-bold text-zinc-950 dark:text-zinc-100 truncate" title={activePreset?.name || 'Custom Circuit'}>
                      {activePreset?.name || 'Custom Circuit'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Controls bar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-0.5">
                {/* Filename input */}
                <div className="flex items-center gap-2 flex-1 max-w-sm">
                  <span className="text-xs font-mono text-zinc-500 shrink-0">File:</span>
                  <input
                    type="text"
                    value={customFilename}
                    onChange={(e) => setCustomFilename(e.target.value)}
                    className="flex-1 px-2.5 py-1 text-xs font-mono bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:border-amber-500"
                    placeholder="filename.json"
                  />
                </div>

                {/* Pretty / Minified toggle + Actions */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setIsPrettyJson(true)}
                      className={`px-2.5 py-1 text-xs font-mono font-medium rounded-md transition-all cursor-pointer ${
                        isPrettyJson
                          ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 shadow-xs font-bold'
                          : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-200'
                      }`}
                    >
                      Pretty
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPrettyJson(false)}
                      className={`px-2.5 py-1 text-xs font-mono font-medium rounded-md transition-all cursor-pointer ${
                        !isPrettyJson
                          ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 shadow-xs font-bold'
                          : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-200'
                      }`}
                    >
                      Minified
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={copyJson}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 text-xs font-mono font-bold transition-all cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadJson}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-mono font-bold transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download JSON</span>
                  </button>
                </div>
              </div>

              {/* JSON preview code block */}
              <pre className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 text-xs font-mono overflow-auto max-h-60 leading-relaxed shadow-inner">
                {jsonContent}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 flex items-center justify-between text-xs font-mono text-zinc-600 dark:text-zinc-400">
          <span>Active mode: <strong className="text-zinc-900 dark:text-zinc-200 uppercase">{effectiveSvgTheme}</strong></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-bold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
