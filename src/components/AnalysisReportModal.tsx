import React, { useState, useMemo } from 'react';
import { CircuitComponent, CircuitState, WiringPreset, GroupedSwitchingCombinationItem } from '../types/guitar';
import { analyzeAllSwitchingCombinations } from '../lib/circuitEngine';
import {
  X,
  FileSpreadsheet,
  Printer,
  Copy,
  Check,
  ShieldCheck,
  Radio,
  Zap,
  Sliders,
  Flame,
  ArrowRight,
  Download,
  Search,
  Layers,
  Sparkles,
  FileText,
  AlertCircle,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react';

interface AnalysisReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: CircuitState;
  activePreset?: WiringPreset;
  onApplyCombination?: (
    updates: { id: string; properties: Partial<CircuitComponent['properties']> }[]
  ) => void;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const AnalysisReportModal: React.FC<AnalysisReportModalProps> = ({
  isOpen,
  onClose,
  state,
  activePreset,
  onApplyCombination,
}) => {
  const [filter, setFilter] = useState<
    'all' | 'hum-cancelling' | 'split' | 'out-of-phase' | 'series'
  >('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);
  const [downloadedHtml, setDownloadedHtml] = useState(false);
  const [viewMode, setViewMode] = useState<'grouped' | 'all'>('grouped');
  const [isPrintPreview, setIsPrintPreview] = useState(false);
  const [printNotice, setPrintNotice] = useState<{
    message: string;
    autoDownloaded?: boolean;
  } | null>(null);

  // Generate full report with grouped combinations
  const report = useMemo(() => {
    return analyzeAllSwitchingCombinations(state);
  }, [state]);

  // Determine items based on view mode (grouped by default as requested)
  const sourceItems = useMemo(() => {
    if (viewMode === 'all') {
      // Wrap raw items in GroupedSwitchingCombinationItem interface for unified rendering
      return report.items.map((item, idx) => {
        const controlValues = report.controls.map((ctrl) => {
          if (ctrl.isPushPull) {
            const pp = item.pushPullSettings.find((p) => p.compId === ctrl.id);
            return {
              controlId: ctrl.id,
              controlName: ctrl.name,
              isWildcard: false,
              label: pp?.label ?? (ctrl.options[0]?.label || 'Default'),
              value: pp?.pulledUp ?? false,
            };
          } else {
            const sw = item.switchSettings.find((s) => s.compId === ctrl.id);
            return {
              controlId: ctrl.id,
              controlName: ctrl.name,
              isWildcard: false,
              label: sw?.label ?? (ctrl.options[0]?.label || 'Default'),
              value: sw?.position ?? 0,
            };
          }
        });

        return {
          id: item.id,
          groupIndex: idx + 1,
          controlValues,
          mergedCount: 1,
          rawItems: [item],
          representativeItem: item,
          isCurrentState: item.isCurrentState,
          result: item.result,
          toneDescription: item.toneDescription,
          activePickupSummary: item.activePickupSummary,
          activeCoilsSummary: item.activeCoilsSummary,
        } as GroupedSwitchingCombinationItem;
      });
    }
    return report.groupedItems;
  }, [report, viewMode]);

  // Filtered combinations
  const filteredItems = useMemo(() => {
    return sourceItems.filter((item) => {
      // Filter tab
      if (filter === 'hum-cancelling' && !item.result.isHumCancelling) return false;
      if (filter === 'split' && !item.result.isCoilSplit) return false;
      if (filter === 'out-of-phase' && item.result.phaseRelationship !== 'out-of-phase') return false;
      if (filter === 'series' && item.result.wiringConfiguration !== 'series') return false;

      // Text search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesPickups = item.activePickupSummary.toLowerCase().includes(query);
        const matchesCoils = item.activeCoilsSummary.toLowerCase().includes(query);
        const matchesTone = item.toneDescription.toLowerCase().includes(query);
        const matchesControls = item.controlValues.some(
          (cv) => !cv.isWildcard && cv.label.toLowerCase().includes(query)
        );
        if (!matchesPickups && !matchesCoils && !matchesTone && !matchesControls) {
          return false;
        }
      }

      return true;
    });
  }, [sourceItems, filter, searchTerm]);

  // Dynamic counts for filter tabs based on currently selected view mode
  const filterCounts = useMemo(() => {
    let hum = 0;
    let split = 0;
    let outOfPhase = 0;
    let series = 0;
    sourceItems.forEach((it) => {
      if (it.result.isHumCancelling) hum++;
      if (it.result.isCoilSplit) split++;
      if (it.result.phaseRelationship === 'out-of-phase') outOfPhase++;
      if (it.result.wiringConfiguration === 'series') series++;
    });
    return {
      all: sourceItems.length,
      hum,
      split,
      outOfPhase,
      series,
    };
  }, [sourceItems]);

  if (!isOpen) return null;

  // Generate a self-contained, publication-grade printable HTML document
  const generatePrintableHtml = () => {
    const presetName = activePreset?.name || 'Custom Guitar Circuit';
    const dateStr = new Date().toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    const controlThs =
      report.controls.length > 0
        ? report.controls
            .map(
              (c) => `<th style="text-align: left; padding: 6px 8px; border: 1px solid #cbd5e1; background: #f8fafc; font-size: 11px;">
              <div>${escapeHtml(c.name)}</div>
              <div style="font-size: 9px; font-weight: normal; color: #b45309;">${c.isPushPull ? 'Push/Pull DPDT' : escapeHtml(c.type.replace('switch-', '').replace(/-/g, ' '))}</div>
            </th>`
            )
            .join('')
        : `<th style="text-align: left; padding: 6px 8px; border: 1px solid #cbd5e1; background: #f8fafc; font-size: 11px;">Wiring Configuration</th>`;

    const rowsHtml = filteredItems
      .map((item) => {
        let controlTds = '';
        if (report.controls.length > 0) {
          controlTds = report.controls
            .map((ctrl) => {
              const cv = item.controlValues.find((c) => c.controlId === ctrl.id);
              const isWildcard = !cv || cv.isWildcard;
              if (isWildcard) {
                return `<td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center;">
                  <span style="font-weight: 900; color: #d97706; background: #fef3c7; border: 1px solid #fde68a; padding: 1px 6px; border-radius: 4px; font-size: 12px;">*</span>
                  <span style="font-size: 9px; color: #64748b; margin-left: 3px;">(Any)</span>
                </td>`;
              }
              return `<td style="padding: 6px 8px; border: 1px solid #e2e8f0;">
                <span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1; font-weight: 600; font-size: 11px;">${escapeHtml(cv.label)}</span>
              </td>`;
            })
            .join('');
        } else {
          controlTds = `<td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-style: italic; color: #64748b;">Direct Output</td>`;
        }

        const isHum = item.result.isHumCancelling;
        const humBadge = isHum
          ? `<span style="color: #059669; font-weight: 700;">✓ Hum-Cancelled</span>`
          : `<span style="color: #b45309;">⚡ 60Hz Hum</span>`;

        const phaseBadge =
          item.result.phaseRelationship === 'out-of-phase'
            ? `<span style="background: #ffe4e6; color: #e11d48; border: 1px solid #fecdd3; padding: 1px 5px; border-radius: 3px; font-weight: 700; font-size: 10px;">Out-of-Phase</span>`
            : item.result.wiringConfiguration === 'series'
            ? `<span style="background: #f3e8ff; color: #7e22ce; border: 1px solid #e9d5ff; padding: 1px 5px; border-radius: 3px; font-weight: 700; font-size: 10px;">Series</span>`
            : `<span style="text-transform: capitalize; color: #334155;">${escapeHtml(item.result.wiringConfiguration)}</span>`;

        return `
          <tr style="page-break-inside: avoid; border-bottom: 1px solid #e2e8f0; ${item.isCurrentState ? 'background: #fffbeb;' : ''}">
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: #64748b;">
              ${item.groupIndex}${item.mergedCount > 1 ? ` <span style="font-size: 9px; font-weight: normal;">(${item.mergedCount}x)</span>` : ''}
            </td>
            ${controlTds}
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">
              <div style="font-weight: 600; color: #0f172a;">${escapeHtml(item.activePickupSummary)}</div>
              <div style="font-size: 9px; color: #64748b;">${escapeHtml(item.activeCoilsSummary)}</div>
            </td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${phaseBadge}</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-size: 11px;">${humBadge}</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-family: monospace;">
              <div style="font-weight: 700; color: #0f172a;">${item.result.estimatedTotalResistanceK} kΩ</div>
              <div style="font-size: 9px; color: #64748b;">${item.result.estimatedTotalInductanceH} H</div>
            </td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">
              <div style="font-weight: 700; color: #b45309; font-family: monospace;">${item.result.resonantFrequencyHz} Hz <span style="font-size: 9px; color: #64748b; font-weight: normal;">(Q=${item.result.qFactor})</span></div>
              <div style="font-size: 10px; color: #334155; margin-top: 1px;">${escapeHtml(item.toneDescription)}</div>
            </td>
          </tr>
        `;
      })
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>ToneSmith - Switching Analysis Report - ${escapeHtml(presetName)}</title>
  <style>
    @page {
      size: landscape;
      margin: 10mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, monospace;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 16px;
      font-size: 11px;
      line-height: 1.4;
    }
    .print-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .print-btn {
      background: #f59e0b;
      color: #0f172a;
      border: none;
      font-weight: bold;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .print-btn:hover { background: #d97706; }
    @media print {
      .print-bar { display: none !important; }
      body { padding: 0 !important; }
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .stat-card {
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      border-radius: 6px;
      padding: 8px 10px;
    }
    .stat-title {
      font-size: 9px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .stat-val {
      font-size: 16px;
      font-weight: 900;
      color: #0f172a;
      margin: 2px 0;
      font-family: monospace;
    }
    .stat-sub {
      font-size: 9px;
      color: #64748b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
      page-break-inside: auto;
    }
    thead {
      display: table-header-group;
    }
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    th, td {
      border: 1px solid #cbd5e1;
    }
    .wildcard-legend {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 10px;
      color: #92400e;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <div>
      <strong style="font-size: 13px;">ToneSmith Switching Analysis Report</strong>
      <span style="color: #94a3b8; margin-left: 8px;">• ${escapeHtml(presetName)} (${dateStr})</span>
    </div>
    <div style="display: flex; gap: 8px; align-items: center;">
      <span style="font-size: 11px; color: #cbd5e1;">Print or Save as PDF:</span>
      <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
    </div>
  </div>

  <div style="border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end;">
    <div>
      <h1 style="margin: 0; font-size: 18px; font-weight: 900; color: #0f172a; font-family: monospace; letter-spacing: -0.5px;">
        TONESMITH GUITAR SWITCHING COMBINATIONS & ANALYSIS
      </h1>
      <div style="font-size: 11px; color: #475569; margin-top: 3px;">
        Preset: <strong>${escapeHtml(presetName)}</strong> • Date: ${dateStr} • Analysis Matrix (${viewMode === 'grouped' ? 'Grouped Distinct Tones' : 'All Permutations'})
      </div>
    </div>
    <div style="text-align: right; font-size: 10px; color: #64748b; font-family: monospace;">
      Verified Circuit Simulation • ToneSmith Lab
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-title">Distinct Tones</div>
      <div class="stat-val">${report.distinctTonesCount}</div>
      <div class="stat-sub">${report.totalCombinations} switch permutations</div>
    </div>
    <div class="stat-card">
      <div class="stat-title">Hum-Cancelling</div>
      <div class="stat-val" style="color: #059669;">${report.humCancellingCount} / ${report.distinctTonesCount}</div>
      <div class="stat-sub">${report.distinctTonesCount > 0 ? Math.round((report.humCancellingCount / report.distinctTonesCount) * 100) : 0}% quiet positions</div>
    </div>
    <div class="stat-card">
      <div class="stat-title">Coil-Splits</div>
      <div class="stat-val" style="color: #d97706;">${report.splitCoilCount}</div>
      <div class="stat-sub">Single-bobbin configurations</div>
    </div>
    <div class="stat-card">
      <div class="stat-title">Out-of-Phase</div>
      <div class="stat-val" style="color: #e11d48;">${report.outOfPhaseCount}</div>
      <div class="stat-sub">Phase-reversal combinations</div>
    </div>
    <div class="stat-card">
      <div class="stat-title">DC Resistance</div>
      <div class="stat-val">${report.resistanceRange.min} - ${report.resistanceRange.max} <span style="font-size: 11px; font-weight: normal;">kΩ</span></div>
      <div class="stat-sub">Peak: ${report.resonantFreqRange.min} - ${report.resonantFreqRange.max} Hz</div>
    </div>
  </div>

  <div class="wildcard-legend">
    <strong style="background: #fde68a; border: 1px solid #f59e0b; padding: 1px 6px; border-radius: 4px; font-family: monospace;">*</strong>
    <span><strong>Wildcard (*):</strong> In this position, toggling this control has <em>no effect</em> on tone or output. Equivalent states are grouped into one distinct tonal entry.</span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="padding: 6px 8px; width: 35px; text-align: center; background: #f8fafc;">#</th>
        ${controlThs}
        <th style="padding: 6px 8px; text-align: left; background: #f8fafc;">Active Pickups & Coils</th>
        <th style="padding: 6px 8px; text-align: left; background: #f8fafc;">Mode & Phase</th>
        <th style="padding: 6px 8px; text-align: left; background: #f8fafc;">Hum Status</th>
        <th style="padding: 6px 8px; text-align: left; background: #f8fafc;">Impedance</th>
        <th style="padding: 6px 8px; text-align: left; background: #f8fafc;">Resonance & Sonic Profile</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div style="margin-top: 16px; padding-top: 10px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 9px; color: #64748b; font-family: monospace;">
    <div>Generated by ToneSmith Guitar Wiring Simulator • ToneSmith Analysis Engine</div>
    <div>Total Table Rows: ${filteredItems.length} • Format: Landscape Multi-Page</div>
  </div>

  <script>
    // Automatically trigger browser print dialog upon opening standalone report
    window.addEventListener('load', function() {
      setTimeout(function() {
        try {
          window.print();
        } catch (e) {
          console.warn('Auto print trigger error:', e);
        }
      }, 500);
    });
  </script>
</body>
</html>`;
  };

  // Handle downloading standalone print-ready HTML
  const handleDownloadPrintableHtml = () => {
    const htmlContent = generatePrintableHtml();
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const base = activePreset
      ? activePreset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      : 'custom-wiring';
    link.download = `tonesmith-switching-analysis-report-${base}.html`;
    link.click();
    URL.revokeObjectURL(url);
    setDownloadedHtml(true);
    setTimeout(() => setDownloadedHtml(false), 2500);
  };

  // Handle printing
  const handlePrint = () => {
    const isInIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

    let printAttempted = false;
    try {
      window.print();
      printAttempted = true;
    } catch (err) {
      console.warn('Direct window.print() failed:', err);
    }

    if (isInIframe) {
      // In embedded iframes (e.g. AI Studio preview), browser sandbox restricts window.print() or silently ignores it.
      // Automatically generate & download the standalone printable HTML report
      // AND notify the user so they are immediately unblocked!
      handleDownloadPrintableHtml();
      setPrintNotice({
        message:
          'Browser print dialogs are restricted in embedded preview frames. We downloaded a standalone Print-Ready HTML report for you! Open the file to print or save as PDF.',
        autoDownloaded: true,
      });
    } else if (!printAttempted) {
      handleDownloadPrintableHtml();
      setPrintNotice({
        message:
          'Browser blocked print dialog. A standalone Print-Ready HTML report has been downloaded for you.',
        autoDownloaded: true,
      });
    } else {
      setPrintNotice({
        message: 'Print dialog sent to browser.',
      });
      setTimeout(() => {
        setPrintNotice(null);
      }, 4000);
    }
  };

  // Handle copying markdown report
  const handleCopyMarkdown = () => {
    let md = `# ToneSmith Switching Combinations Analysis Report\n`;
    if (activePreset) {
      md += `**Schematic Preset**: ${activePreset.name}\n\n`;
    }
    md += `**Total Configurations**: ${report.groupedItems.length} Distinct Tones (${report.totalCombinations} Raw Combinations) | **Hum-Cancelling**: ${report.humCancellingCount} | **Coil Splits**: ${report.splitCoilCount} | **Out-of-Phase**: ${report.outOfPhaseCount}\n`;
    md += `**DC Resistance Range**: ${report.resistanceRange.min}kΩ - ${report.resistanceRange.max}kΩ\n\n`;

    const controlHeaders = report.controls.length > 0
      ? report.controls.map((c) => c.name).join(' | ') + ' | '
      : 'Wiring Configuration | ';

    const controlSeparators = report.controls.length > 0
      ? report.controls.map(() => '---').join(' | ') + ' | '
      : '--- | ';

    md += `| # | ${controlHeaders}Active Pickups | Phase | Hum Status | Wiring | Resistance | Resonant Peak | Tone Character |\n`;
    md += `|---| ${controlSeparators}---|---|---|---|---|---|---|\n`;

    filteredItems.forEach((item) => {
      const hum = item.result.isHumCancelling ? 'Hum-Cancelling' : '60Hz Hum';
      const phase = item.result.phaseRelationship;
      const wiring = item.result.wiringConfiguration;
      const res = `${item.result.estimatedTotalResistanceK} kΩ`;
      const freq = `${item.result.resonantFrequencyHz} Hz`;

      let controlCols = '';
      if (report.controls.length > 0) {
        controlCols = report.controls
          .map((ctrl) => {
            const cv = item.controlValues.find((c) => c.controlId === ctrl.id);
            return cv ? (cv.isWildcard ? '*' : cv.label) : '-';
          })
          .join(' | ') + ' | ';
      } else {
        controlCols = 'Direct Out | ';
      }

      md += `| ${item.groupIndex} | ${controlCols}${item.activePickupSummary} | ${phase} | ${hum} | ${wiring} | ${res} | ${freq} | ${item.toneDescription} |\n`;
    });

    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle downloading CSV
  const handleDownloadCsv = () => {
    const controlHeaders = report.controls.length > 0
      ? report.controls.map((c) => `"${c.name.replace(/"/g, '""')}"`)
      : ['"Wiring Configuration"'];

    const headers = [
      'Index',
      ...controlHeaders,
      'Active Pickups',
      'Active Coils',
      'Phase',
      'Hum Status',
      'Wiring Configuration',
      'Resistance (kOhm)',
      'Inductance (H)',
      'Resonant Frequency (Hz)',
      'Q Factor',
      'Tone Character',
      'Merged Permutations',
    ];

    const rows = filteredItems.map((item) => {
      const controlCols = report.controls.length > 0
        ? report.controls.map((ctrl) => {
            const cv = item.controlValues.find((c) => c.controlId === ctrl.id);
            const val = cv ? (cv.isWildcard ? '*' : cv.label) : '-';
            return `"${val.replace(/"/g, '""')}"`;
          })
        : ['"Direct Output"'];

      return [
        item.groupIndex,
        ...controlCols,
        `"${item.activePickupSummary.replace(/"/g, '""')}"`,
        `"${item.activeCoilsSummary.replace(/"/g, '""')}"`,
        item.result.phaseRelationship,
        item.result.isHumCancelling ? 'Hum-Cancelling' : 'Single-Coil Hum',
        item.result.wiringConfiguration,
        item.result.estimatedTotalResistanceK,
        item.result.estimatedTotalInductanceH,
        item.result.resonantFrequencyHz,
        item.result.qFactor,
        `"${item.toneDescription.replace(/"/g, '""')}"`,
        item.mergedCount,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `switching-analysis-report-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Audition handler for applying grouped combination settings to canvas
  const handleAuditionItem = (item: GroupedSwitchingCombinationItem) => {
    if (!onApplyCombination) return;

    const updates: {
      id: string;
      properties: Partial<CircuitComponent['properties']>;
    }[] = [];

    // Apply explicit non-wildcard controls
    item.controlValues.forEach((cv) => {
      if (!cv.isWildcard && cv.value !== undefined) {
        const ctrl = report.controls.find((c) => c.id === cv.controlId);
        if (ctrl) {
          if (ctrl.isPushPull) {
            updates.push({
              id: cv.controlId,
              properties: { pulledUp: Boolean(cv.value) },
            });
          } else {
            updates.push({
              id: cv.controlId,
              properties: { switchPosition: Number(cv.value) },
            });
          }
        }
      }
    });

    // For any wildcard controls not covered, ensure valid setting from representative item
    item.representativeItem.switchSettings.forEach((s) => {
      if (!updates.some((u) => u.id === s.compId)) {
        updates.push({
          id: s.compId,
          properties: { switchPosition: s.position },
        });
      }
    });

    item.representativeItem.pushPullSettings.forEach((p) => {
      if (!updates.some((u) => u.id === p.compId)) {
        updates.push({
          id: p.compId,
          properties: { pulledUp: p.pulledUp },
        });
      }
    });

    onApplyCombination(updates);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150 report-modal-backdrop print:static print:p-0 print:m-0 print:bg-transparent print:backdrop-blur-none print:block print:overflow-visible"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-6xl h-[88vh] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-zinc-900 dark:text-zinc-100 report-modal-container print:static print:max-w-none print:w-full print:h-auto print:max-h-none print:border-none print:shadow-none print:overflow-visible print:bg-white print:text-black"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Print-Only Document Header (activates when printed via browser print) */}
        <div className="hidden print:block p-4 mb-2 border-b-2 border-zinc-950 text-black">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-black font-mono tracking-tight text-black">
                TONESMITH GUITAR SWITCHING ANALYSIS REPORT
              </h1>
              <p className="text-xs text-zinc-700 mt-0.5">
                Schematic: <strong>{activePreset?.name || 'Custom Guitar Circuit'}</strong> • Generated: {new Date().toLocaleDateString()} • Matrix: {viewMode === 'grouped' ? 'Grouped Distinct Tones' : 'All Permutations'}
              </p>
            </div>
            <div className="text-right text-xs font-mono text-zinc-700">
              <div className="font-bold">{report.distinctTonesCount} Distinct Tones ({report.totalCombinations} Combinations)</div>
              <div>Hum-Cancelling: {report.humCancellingCount} ({report.distinctTonesCount > 0 ? Math.round((report.humCancellingCount / report.distinctTonesCount) * 100) : 0}%)</div>
              <div>DC Resistance: {report.resistanceRange.min}kΩ - {report.resistanceRange.max}kΩ</div>
            </div>
          </div>
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/60 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold font-mono text-zinc-950 dark:text-zinc-100">
                  SWITCHING COMBINATIONS & ANALYSIS REPORT
                </h2>
                <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 font-medium">
                  · {report.distinctTonesCount} Distinct Tonal States ({report.totalCombinations} Switch Positions)
                </span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                Individual columns per switch & push/pull pot. Equivalent results are grouped with <strong className="font-bold text-amber-600 dark:text-amber-400 font-mono">*</strong> marking controls that have no effect.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              title="Print report or save as PDF"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPrintPreview(!isPrintPreview)}
              title={isPrintPreview ? 'Exit print preview' : 'Preview clean printable document'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer border ${
                isPrintPreview
                  ? 'bg-amber-500 text-zinc-950 font-bold border-amber-600'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
              }`}
            >
              {isPrintPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="hidden sm:inline">{isPrintPreview ? 'Matrix' : 'Preview'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-950 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Print Notification Banner (shown if iframe security restricted print or auto-downloaded) */}
        {printNotice && (
          <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-900/60 text-xs font-mono text-blue-950 dark:text-blue-200 print:hidden animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <div className="p-1 rounded-md bg-blue-500/20 text-blue-600 dark:text-blue-400 shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <span className="text-xs leading-relaxed">{printNotice.message}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <button
                type="button"
                onClick={handleDownloadPrintableHtml}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] cursor-pointer transition-colors shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{downloadedHtml ? 'Downloaded' : 'Download File'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPrintPreview(true)}
                className="flex items-center gap-1 px-2 py-1 rounded bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:hover:bg-blue-900 text-blue-900 dark:text-blue-200 font-bold text-[11px] cursor-pointer transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Sheet</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintNotice(null)}
                className="p-1 rounded text-blue-600 hover:text-blue-950 dark:text-blue-400 dark:hover:text-white cursor-pointer"
                title="Dismiss message"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Summary Metric Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-zinc-100/60 dark:bg-zinc-950/40 border-b border-zinc-200 dark:border-zinc-800 text-xs font-mono shrink-0">
          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
              Distinct Tones
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-black text-zinc-950 dark:text-zinc-100">
                {report.distinctTonesCount}
              </span>
              <span className="text-[11px] text-zinc-500">
                ({report.totalCombinations} total)
              </span>
            </div>
            <span className="text-[10px] text-zinc-500">
              {report.switchesCount} switch{report.switchesCount === 1 ? '' : 'es'} · {report.pushPullsCount} push/pull{report.pushPullsCount === 1 ? '' : 's'}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              <span>Hum-Cancelling</span>
            </span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
              {report.humCancellingCount} / {report.distinctTonesCount}
            </span>
            <span className="text-[10px] text-zinc-500">
              {report.distinctTonesCount > 0
                ? `${Math.round((report.humCancellingCount / report.distinctTonesCount) * 100)}% quiet tones`
                : 'N/A'}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-500" />
              <span>Coil-Splits</span>
            </span>
            <span className="text-lg font-black text-amber-600 dark:text-amber-400">
              {report.splitCoilCount}
            </span>
            <span className="text-[10px] text-zinc-500">Single-bobbin taps</span>
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold flex items-center gap-1">
              <Flame className="w-3 h-3 text-rose-500" />
              <span>Out-of-Phase</span>
            </span>
            <span className="text-lg font-black text-rose-600 dark:text-rose-400">
              {report.outOfPhaseCount}
            </span>
            <span className="text-[10px] text-zinc-500">Peter Green blues honk</span>
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col gap-0.5 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
              DC Resistance
            </span>
            <span className="text-lg font-black text-zinc-950 dark:text-zinc-100">
              {report.resistanceRange.min} - {report.resistanceRange.max} <span className="text-xs font-normal">kΩ</span>
            </span>
            <span className="text-[10px] text-zinc-500">Peak: {report.resonantFreqRange.min} - {report.resonantFreqRange.max} Hz</span>
          </div>
        </div>

        {/* Legend Notification Banner */}
        <div className="flex items-center justify-between px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200/80 dark:border-amber-900/50 text-[11px] font-mono text-amber-900 dark:text-amber-300 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center font-bold px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-700 dark:text-amber-400 text-xs">
              *
            </span>
            <span>
              <strong>Wildcard (*):</strong> In this position, changing this switch or push/pull has <em>no effect</em> on the resulting sound. Identical states are grouped together.
            </span>
          </div>

          {/* Grouped vs Raw toggle */}
          <div className="flex items-center gap-1 shrink-0 ml-3">
            <span className="text-[10px] text-zinc-500 mr-1 hidden sm:inline">Matrix View:</span>
            <div className="inline-flex p-0.5 rounded-lg bg-zinc-200/80 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => {
                  setViewMode('grouped');
                  setIsPrintPreview(false);
                }}
                className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded cursor-pointer transition-all ${
                  viewMode === 'grouped' && !isPrintPreview
                    ? 'bg-amber-500 text-zinc-950 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100'
                }`}
                title="Group identical tonal outputs and mark non-effecting controls with '*'"
              >
                Grouped (*)
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('all');
                  setIsPrintPreview(false);
                }}
                className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded cursor-pointer transition-all ${
                  viewMode === 'all' && !isPrintPreview
                    ? 'bg-amber-500 text-zinc-950 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100'
                }`}
                title="Show all individual switch permutations unreduced"
              >
                All Permutations
              </button>
            </div>
          </div>
        </div>

        {/* Filter Bar & Search */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 print:hidden">
          {/* Segmented Filter Buttons */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            {[
              { id: 'all', label: `All (${filterCounts.all})` },
              { id: 'hum-cancelling', label: `Hum-Cancelling (${filterCounts.hum})` },
              { id: 'split', label: `Coil Splits (${filterCounts.split})` },
              { id: 'out-of-phase', label: `Out of Phase (${filterCounts.outOfPhase})` },
              { id: 'series', label: `Series (${filterCounts.series})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as any)}
                className={`px-2.5 py-1 text-xs font-mono font-medium rounded-md transition-all cursor-pointer whitespace-nowrap ${
                  filter === tab.id
                    ? 'bg-amber-500 text-zinc-950 font-bold shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input & Action Buttons */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search pickups, tone, switch..."
                className="pl-8 pr-2.5 py-1 text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 w-40 sm:w-48 focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-200 border border-amber-500/30 transition-colors cursor-pointer"
              title="Print report or save as PDF"
            >
              <Printer className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPrintableHtml}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-medium rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
              title="Download standalone print-ready HTML file"
            >
              {downloadedHtml ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-blue-500" />
              )}
              <span>{downloadedHtml ? 'Saved' : 'HTML'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-medium rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
              title="Copy markdown table to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-medium rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
              title="Download CSV table"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Combinations Matrix Table or Print-Ready Preview Sheet */}
        {isPrintPreview ? (
          /* In-Modal Print-Ready Preview Sheet */
          <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-zinc-200/70 dark:bg-zinc-950/70 flex flex-col items-center">
            <div className="w-full max-w-5xl bg-white text-zinc-950 rounded-xl shadow-xl border border-zinc-300 p-6 font-mono">
              {/* Sheet Control Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-zinc-200">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold text-xs uppercase tracking-wider text-zinc-700">
                    Print-Ready Document Preview
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    (Landscape Layout • Letter / A4)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs cursor-pointer shadow-xs transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Sheet</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPrintableHtml}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>{downloadedHtml ? 'Downloaded' : 'Download File (.html)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPrintPreview(false)}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold cursor-pointer border border-zinc-300"
                  >
                    Return to Interactive Matrix
                  </button>
                </div>
              </div>

              {/* Sheet Content Header */}
              <div className="border-b-2 border-zinc-900 pb-3 mb-4 flex justify-between items-end">
                <div>
                  <h1 className="text-lg font-black tracking-tight text-zinc-950">
                    TONESMITH GUITAR SWITCHING COMBINATIONS & ANALYSIS
                  </h1>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    Schematic: <strong>{activePreset?.name || 'Custom Guitar Circuit'}</strong> • Date: {new Date().toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right text-[11px] text-zinc-600 font-mono">
                  <div>{report.distinctTonesCount} Distinct Tones ({report.totalCombinations} Positions)</div>
                  <div>DC Resistance: {report.resistanceRange.min}kΩ - {report.resistanceRange.max}kΩ</div>
                </div>
              </div>

              {/* Sheet Summary Metrics */}
              <div className="grid grid-cols-5 gap-2 mb-4 text-[11px]">
                <div className="p-2 rounded bg-zinc-50 border border-zinc-200">
                  <div className="text-[10px] text-zinc-500 font-semibold uppercase">Distinct Tones</div>
                  <div className="text-base font-black text-zinc-900">{report.distinctTonesCount}</div>
                  <div className="text-[10px] text-zinc-500">{report.totalCombinations} permutations</div>
                </div>
                <div className="p-2 rounded bg-zinc-50 border border-zinc-200">
                  <div className="text-[10px] text-emerald-700 font-semibold uppercase">Hum-Cancelled</div>
                  <div className="text-base font-black text-emerald-600">{report.humCancellingCount}</div>
                  <div className="text-[10px] text-zinc-500">{Math.round((report.humCancellingCount / Math.max(1, report.distinctTonesCount)) * 100)}% quiet</div>
                </div>
                <div className="p-2 rounded bg-zinc-50 border border-zinc-200">
                  <div className="text-[10px] text-amber-700 font-semibold uppercase">Coil-Splits</div>
                  <div className="text-base font-black text-amber-600">{report.splitCoilCount}</div>
                  <div className="text-[10px] text-zinc-500">Single taps</div>
                </div>
                <div className="p-2 rounded bg-zinc-50 border border-zinc-200">
                  <div className="text-[10px] text-rose-700 font-semibold uppercase">Out-of-Phase</div>
                  <div className="text-base font-black text-rose-600">{report.outOfPhaseCount}</div>
                  <div className="text-[10px] text-zinc-500">Peter Green</div>
                </div>
                <div className="p-2 rounded bg-zinc-50 border border-zinc-200">
                  <div className="text-[10px] text-zinc-500 font-semibold uppercase">DC Resistance</div>
                  <div className="text-base font-black text-zinc-900">{report.resistanceRange.min}-{report.resistanceRange.max}kΩ</div>
                  <div className="text-[10px] text-zinc-500">Peak: {report.resonantFreqRange.min}-{report.resonantFreqRange.max}Hz</div>
                </div>
              </div>

              {/* Sheet Table */}
              <div className="border border-zinc-300 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-zinc-100 text-zinc-700 text-[11px] font-bold border-b border-zinc-300">
                    <tr>
                      <th className="py-2 px-2.5 w-8 text-center border-r border-zinc-300">#</th>
                      {report.controls.map((ctrl) => (
                        <th key={ctrl.id} className="py-2 px-2.5 border-r border-zinc-300">
                          <div>{ctrl.name}</div>
                          <div className="text-[9px] font-normal text-amber-700">
                            {ctrl.isPushPull ? 'Push/Pull' : ctrl.type.replace('switch-', '')}
                          </div>
                        </th>
                      ))}
                      <th className="py-2 px-2.5 border-r border-zinc-300">Active Pickups & Coils</th>
                      <th className="py-2 px-2.5 border-r border-zinc-300">Mode & Phase</th>
                      <th className="py-2 px-2.5 border-r border-zinc-300">Hum Status</th>
                      <th className="py-2 px-2.5 border-r border-zinc-300">Impedance</th>
                      <th className="py-2 px-2.5">Resonance & Character</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {filteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-50">
                        <td className="py-2 px-2.5 text-center font-bold text-zinc-500 border-r border-zinc-200">
                          {item.groupIndex}
                        </td>
                        {report.controls.map((ctrl) => {
                          const cv = item.controlValues.find((c) => c.controlId === ctrl.id);
                          const isWildcard = !cv || cv.isWildcard;
                          return (
                            <td key={ctrl.id} className="py-2 px-2.5 border-r border-zinc-200">
                              {isWildcard ? (
                                <span className="font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded text-[11px] border border-amber-300">
                                  * Any
                                </span>
                              ) : (
                                <span className="font-semibold text-zinc-900 bg-zinc-100 px-1.5 py-0.5 rounded text-[11px] border border-zinc-200">
                                  {cv.label}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2 px-2.5 border-r border-zinc-200">
                          <div className="font-semibold text-zinc-900">{item.activePickupSummary}</div>
                          <div className="text-[10px] text-zinc-500">{item.activeCoilsSummary}</div>
                        </td>
                        <td className="py-2 px-2.5 border-r border-zinc-200 text-[11px]">
                          {item.result.phaseRelationship === 'out-of-phase' ? (
                            <span className="text-rose-600 font-bold">Out-of-Phase</span>
                          ) : item.result.wiringConfiguration === 'series' ? (
                            <span className="text-purple-600 font-bold">Series</span>
                          ) : (
                            <span className="capitalize text-zinc-700">{item.result.wiringConfiguration}</span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 border-r border-zinc-200 text-[11px]">
                          {item.result.isHumCancelling ? (
                            <span className="text-emerald-700 font-semibold">Hum-Cancelled</span>
                          ) : (
                            <span className="text-amber-800">60Hz Hum</span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 border-r border-zinc-200 text-[11px]">
                          <div className="font-bold text-zinc-900">{item.result.estimatedTotalResistanceK} kΩ</div>
                          <div className="text-[10px] text-zinc-500">{item.result.estimatedTotalInductanceH} H</div>
                        </td>
                        <td className="py-2 px-2.5 text-[11px]">
                          <div className="font-bold text-amber-700">{item.result.resonantFrequencyHz} Hz</div>
                          <div className="text-[10px] text-zinc-600">{item.toneDescription}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* Standard Interactive Matrix Table with Fluid Height & Sticky Header */
          <div className="flex-1 min-h-0 p-4 flex flex-col">
          {filteredItems.length === 0 ? (
            <div className="flex-1 min-h-0 py-12 text-center text-zinc-500 font-mono text-xs flex flex-col items-center justify-center gap-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/30">
              <Sliders className="w-8 h-8 text-zinc-400 dark:text-zinc-600" />
              <span>No combinations match the selected filter or search term.</span>
            </div>
          ) : (
            <div className="flex-1 min-h-0 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-auto shadow-xs bg-white dark:bg-zinc-900 report-table-scroll print:overflow-visible print:h-auto print:max-h-none print:border print:border-zinc-300 print:shadow-none">
              <table className="w-full text-left text-xs font-mono min-w-[900px] border-separate border-spacing-0 report-table print:min-w-full print:border-collapse">
                <thead className="sticky top-0 z-20 bg-zinc-100 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 text-[11px] font-semibold">
                  <tr>
                    <th className="sticky top-0 z-20 py-2.5 px-3 w-10 text-center bg-zinc-100 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                      #
                    </th>

                    {/* Dedicated Column for Each Switch or Push/Pull Pot */}
                    {report.controls.length > 0 ? (
                      report.controls.map((ctrl) => (
                        <th
                          key={ctrl.id}
                          className="sticky top-0 z-20 py-2.5 px-3 whitespace-nowrap bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 border-r border-zinc-200/60 dark:border-zinc-800/60"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-zinc-950 dark:text-zinc-100">
                              {ctrl.name}
                            </span>
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              {ctrl.isPushPull ? 'Push/Pull DPDT' : ctrl.type.replace('switch-', '').replace(/-/g, ' ')}
                            </span>
                          </div>
                        </th>
                      ))
                    ) : (
                      <th className="sticky top-0 z-20 py-2.5 px-3 whitespace-nowrap bg-zinc-100 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 border-r border-zinc-200/60 dark:border-zinc-800/60">
                        Wiring Configuration
                      </th>
                    )}

                    <th className="sticky top-0 z-20 py-2.5 px-3 bg-zinc-100 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                      Active Pickups & Coils
                    </th>
                    <th className="sticky top-0 z-20 py-2.5 px-3 bg-zinc-100 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                      Mode & Phase
                    </th>
                    <th className="sticky top-0 z-20 py-2.5 px-3 bg-zinc-100 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                      Hum Status
                    </th>
                    <th className="sticky top-0 z-20 py-2.5 px-3 bg-zinc-100 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                      Impedance
                    </th>
                    <th className="sticky top-0 z-20 py-2.5 px-3 bg-zinc-100 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                      Resonance & Character
                    </th>
                    <th className="sticky top-0 z-20 py-2.5 px-3 text-right bg-zinc-100 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 print:hidden">
                      Audition
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-900">
                  {filteredItems.map((item) => {
                    const isMuted = !item.result.hasOutputSignal;
                    const isHumCancelling = item.result.isHumCancelling;
                    const isOutOfPhase = item.result.phaseRelationship === 'out-of-phase';
                    const isSeries = item.result.wiringConfiguration === 'series';
                    const isCoilSplit = item.result.isCoilSplit;

                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                          item.isCurrentState
                            ? 'bg-amber-500/10 dark:bg-amber-500/10 font-medium'
                            : ''
                        }`}
                      >
                        {/* Index / Current State Indicator */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap border-b border-zinc-200/70 dark:border-zinc-800/60">
                          {item.isCurrentState ? (
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 ring-3 ring-amber-400/40"
                              title="Active configuration currently set on canvas"
                            />
                          ) : (
                            <span className="text-zinc-400 font-mono text-[11px]">
                              {item.groupIndex}
                            </span>
                          )}
                          {item.mergedCount > 1 && viewMode === 'grouped' && (
                            <span
                              className="block text-[9px] text-zinc-400 dark:text-zinc-500 font-mono"
                              title={`${item.mergedCount} combinations collapsed into this distinct tone`}
                            >
                              ({item.mergedCount}x)
                            </span>
                          )}
                        </td>

                        {/* Switch & Push/Pull Columns: One Column per Switch or Push/Pull Pot */}
                        {report.controls.length > 0 ? (
                          report.controls.map((ctrl) => {
                            const cv = item.controlValues.find((c) => c.controlId === ctrl.id);
                            const isWildcard = !cv || cv.isWildcard;

                            return (
                              <td
                                key={ctrl.id}
                                className="py-2.5 px-3 whitespace-nowrap border-r border-zinc-200/60 dark:border-zinc-800/60 border-b border-zinc-200/70 dark:border-zinc-800/60"
                              >
                                {isWildcard ? (
                                  <div
                                    className="inline-flex items-center gap-1.5"
                                    title={`No effect on tone in this state: ${ctrl.name} can be in any position without altering the result.`}
                                  >
                                    <span className="inline-flex items-center justify-center min-w-[26px] h-5 px-1 rounded font-mono font-black text-sm bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/40 shadow-2xs">
                                      *
                                    </span>
                                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal">
                                      (Any)
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center">
                                    <span className="inline-block px-2 py-0.5 rounded-md text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700/80">
                                      {cv.label}
                                    </span>
                                  </div>
                                )}
                              </td>
                            );
                          })
                        ) : (
                          <td className="py-2.5 px-3 whitespace-nowrap border-r border-zinc-200/60 dark:border-zinc-800/60 border-b border-zinc-200/70 dark:border-zinc-800/60">
                            <span className="text-zinc-500 text-xs italic">
                              Direct Output (Always Engaged)
                            </span>
                          </td>
                        )}

                        {/* Active Pickups & Coils */}
                        <td className="py-2.5 px-3 border-b border-zinc-200/70 dark:border-zinc-800/60">
                          <div className="flex flex-col gap-0.5 max-w-[200px]">
                            <span className="font-semibold text-zinc-900 dark:text-zinc-200 truncate">
                              {item.activePickupSummary}
                            </span>
                            <span className="text-[10px] text-zinc-500 truncate" title={item.activeCoilsSummary}>
                              {item.activeCoilsSummary}
                            </span>
                          </div>
                        </td>

                        {/* Mode & Phase */}
                        <td className="py-2.5 px-3 whitespace-nowrap border-b border-zinc-200/70 dark:border-zinc-800/60">
                          <div className="flex flex-wrap items-center gap-1">
                            {isOutOfPhase && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
                                Out-of-Phase
                              </span>
                            )}
                            {isSeries && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30">
                                Series
                              </span>
                            )}
                            {isCoilSplit && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">
                                Coil-Split
                              </span>
                            )}
                            {!isOutOfPhase && !isSeries && !isCoilSplit && !isMuted && (
                              <span className="text-[11px] text-zinc-600 dark:text-zinc-400 capitalize">
                                {item.result.wiringConfiguration} · In-Phase
                              </span>
                            )}
                            {isMuted && (
                              <span className="text-[10px] text-zinc-400 italic">Muted</span>
                            )}
                          </div>
                        </td>

                        {/* Hum Status */}
                        <td className="py-2.5 px-3 whitespace-nowrap border-b border-zinc-200/70 dark:border-zinc-800/60">
                          {isMuted ? (
                            <span className="text-zinc-400">Silent</span>
                          ) : isHumCancelling ? (
                            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                              <span>Hum-Cancelled</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400 text-[11px]">
                              <Radio className="w-3.5 h-3.5 shrink-0" />
                              <span>60Hz Hum</span>
                            </div>
                          )}
                        </td>

                        {/* Impedance */}
                        <td className="py-2.5 px-3 whitespace-nowrap border-b border-zinc-200/70 dark:border-zinc-800/60">
                          {isMuted ? (
                            <span className="text-zinc-400">—</span>
                          ) : (
                            <div className="flex flex-col text-[11px]">
                              <span className="text-zinc-950 dark:text-zinc-100 font-bold">
                                {item.result.estimatedTotalResistanceK} kΩ
                              </span>
                              <span className="text-[10px] text-zinc-500">
                                {item.result.estimatedTotalInductanceH} H
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Resonance & Character */}
                        <td className="py-2.5 px-3 border-b border-zinc-200/70 dark:border-zinc-800/60">
                          {isMuted ? (
                            <span className="text-zinc-400 italic text-[11px]">No Output</span>
                          ) : (
                            <div className="flex flex-col gap-0.5 max-w-[240px]">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-amber-700 dark:text-amber-400 text-[11px]">
                                  {item.result.resonantFrequencyHz} Hz
                                </span>
                                <span className="text-[10px] text-zinc-500">
                                  (Q={item.result.qFactor})
                                </span>
                              </div>
                              <span className="text-[10px] text-zinc-600 dark:text-zinc-300 leading-tight">
                                {item.toneDescription}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Audition Button */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap border-b border-zinc-200/70 dark:border-zinc-800/60 print:hidden">
                          <button
                            type="button"
                            onClick={() => handleAuditionItem(item)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold transition-all inline-flex items-center gap-1 cursor-pointer ${
                              item.isCurrentState
                                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/40 ring-1 ring-amber-500/30'
                                : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700'
                            }`}
                            title="Set canvas switches and pots to this combination"
                          >
                            <span>{item.isCurrentState ? 'Active' : 'Audition'}</span>
                            {!item.isCurrentState && <ArrowRight className="w-3 h-3" />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}

        {/* Modal Footer */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/60 flex items-center justify-between text-xs font-mono shrink-0 print:hidden">
          <div className="flex items-center gap-2 text-zinc-500">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
            <span>Click &ldquo;Audition&rdquo; to instantly set canvas controls to any tonal profile.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-mono font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
