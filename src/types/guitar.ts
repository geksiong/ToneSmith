export type ComponentType =
  | 'pickup-humbucker'
  | 'pickup-singlecoil'
  | 'pickup-p90'
  | 'pickup-tele-neck'
  | 'pickup-tele-bridge'
  | 'pot-standard'
  | 'pot-pushpull'
  | 'pot-stacked'
  | 'pot-blend'
  | 'switch-3way-toggle'
  | 'switch-5way-blade'
  | 'switch-3way-blade'
  | 'switch-4way-blade'
  | 'switch-superswitch'
  | 'switch-dpdt-minitoggle'
  | 'capacitor'
  | 'resistor'
  | 'output-jack'
  | 'ground-lug';

export type WireColor =
  | '#eab308' // Vintage Yellow / Cloth
  | '#18181b' // Black / Ground
  | '#ef4444' // Red / Hot
  | '#22c55e' // Green
  | '#f8fafc' // White
  | '#3b82f6' // Blue
  | '#94a3b8' // Braided / Silver Shield
  | '#ec4899' // Pink / Violet
  | '#f97316' // Orange / Amber
  | '#a855f7' // Purple
  | string;

export type PotTaper = 'audio' | 'linear' | 'reverse-audio';

export type PickupBrandStandard = 'seymour-duncan' | 'gibson' | 'fender' | 'dimarzio';

export interface Terminal {
  id: string; // e.g. "lug-1", "wiper", "sw-c1"
  label: string;
  x: number; // offset relative to component position
  y: number;
  type: 'signal' | 'ground' | 'switch-common' | 'switch-throw' | 'coil';
}

export interface CircuitComponent {
  id: string;
  type: ComponentType;
  name: string;
  x: number;
  y: number;
  rotation?: number; // 0, 90, 180, 270 degrees
  
  // Specific attributes depending on type
  properties: {
    // Pickups
    pickupPosition?: 'neck' | 'middle' | 'bridge';
    dcResistanceK?: number; // e.g. 8.4 kOhm
    inductanceH?: number; // e.g. 4.2 H
    capacitancePf?: number; // e.g. 110 pF
    magnetType?: 'Alnico II' | 'Alnico V' | 'Ceramic';
    magnetFlipped?: boolean; // Flip magnet bar (Peter Green out of phase)
    rwrp?: boolean; // Reverse wound, reverse polarity (for single coils)
    wireStandard?: PickupBrandStandard; // for 4-conductor humbuckers
    coilTapMode?: 'full' | 'north-only' | 'south-only'; // for display or analysis
    
    // Potentiometers
    resistanceK?: number; // 250, 500, 1000, 25
    taper?: PotTaper;
    currentValue?: number; // 0.0 to 1.0 (0% to 100%)
    
    // Push-pull specifics
    pulledUp?: boolean; // true = pulled (contacts C-2 connected), false = pushed (contacts C-1 connected)
    
    // Stacked pot specifics (dual concentric)
    innerValue?: number; // 0.0 to 1.0
    outerValue?: number; // 0.0 to 1.0
    innerResistanceK?: number;
    outerResistanceK?: number;
    
    // Blend pot specifics
    blendValue?: number; // 0.0 (100% A, 0% B) to 0.5 (100% both) to 1.0 (0% A, 100% B)
    
    // Switches
    switchPosition?: number; // 0-indexed position (e.g. 0=Bridge, 1=Bridge+Mid, etc.)
    numPositions?: number;
    
    // Capacitors & Resistors
    capacitanceUf?: number; // e.g. 0.022, 0.047
    capType?: 'orange-drop' | 'paper-in-oil' | 'ceramic-disc';
    resistanceOhms?: number; // for treble bleed resistor (e.g. 150000)
    
    // Jack
    jackType?: 'mono' | 'stereo';
  };
}

export interface Wire {
  id: string;
  fromComponentId: string;
  fromTerminalId: string;
  toComponentId: string;
  toTerminalId: string;
  color: WireColor;
  label?: string;
  bendPoints?: { x: number; y: number }[];
}

export interface CircuitState {
  components: CircuitComponent[];
  wires: Wire[];
  technicianNotes?: string;
}

export interface ActiveCoilInfo {
  pickupId: string;
  pickupName: string;
  coilName: string; // 'North Coil', 'South Coil', 'Single Bobbin'
  magneticPolarity: 'North' | 'South';
  electricalPhase: 'In-Phase' | 'Reverse-Phase';
  dcResistanceK: number;
  inductanceH: number;
}

export interface SignalPathInfo {
  activeComponentIds: Set<string>;
  activeWireIds: Set<string>;
  activeTerminalKeys: Set<string>;
  activePickupIds: string[];
  hasSignalPath: boolean;
  activeHumbuckerCoils?: Record<string, { north: boolean; south: boolean }>;
}

export interface CircuitAnalysisResult {
  hasOutputSignal: boolean;
  activePickups: {
    id: string;
    name: string;
    position?: string;
    type: ComponentType;
  }[];
  activeCoils: ActiveCoilInfo[];
  wiringConfiguration: 'solo' | 'parallel' | 'series' | 'complex' | 'none';
  phaseRelationship: 'in-phase' | 'out-of-phase' | 'solo' | 'silent';
  isHumCancelling: boolean;
  humCancellingReason: string;
  estimatedTotalResistanceK: number;
  estimatedTotalInductanceH: number;
  resonantFrequencyHz: number;
  peakBoostDb: number;
  qFactor: number;
  effectiveVolumeLevel: number; // 0.0 to 1.0
  effectiveToneCutoffHz: number; // 300Hz to 20000Hz
  activeVolumePotIds?: string[];
  activeTonePotIds?: string[];
  circuitIssues: string[]; // e.g. "Jack tip is grounded", "Floating pickup hot lead"
  loadResistanceK?: number;
  totalCapacitancePf?: number;
  isCoilSplit?: boolean;
  gainOffsetDb?: number;
}

export interface WiringPreset {
  id: string;
  name: string;
  category: 'Fender' | 'Gibson' | 'Custom / Mods' | 'Bass';
  description: string;
  tags: string[];
  components: CircuitComponent[];
  wires: Wire[];
  instructions: string[];
  billOfMaterials: {
    item: string;
    qty: number;
    specs: string;
  }[];
}

export interface SwitchingControlOption {
  value: number | boolean;
  label: string;
}

export interface SwitchingControlDef {
  id: string;
  name: string;
  type: string;
  isPushPull: boolean;
  options: SwitchingControlOption[];
}

export interface GroupedControlValue {
  controlId: string;
  controlName: string;
  isWildcard: boolean;
  label: string;
  value?: number | boolean;
}

export interface GroupedSwitchingCombinationItem {
  id: string;
  groupIndex: number;
  controlValues: GroupedControlValue[];
  mergedCount: number;
  rawItems: SwitchingCombinationReportItem[];
  representativeItem: SwitchingCombinationReportItem;
  isCurrentState: boolean;
  result: CircuitAnalysisResult;
  toneDescription: string;
  activePickupSummary: string;
  activeCoilsSummary: string;
}

export interface SwitchingCombinationReportItem {
  id: string;
  combinationIndex: number;
  combinationLabel: string;
  switchSettings: {
    compId: string;
    compName: string;
    position: number;
    label: string;
  }[];
  pushPullSettings: {
    compId: string;
    compName: string;
    pulledUp: boolean;
    label: string;
  }[];
  isCurrentState: boolean;
  result: CircuitAnalysisResult;
  toneDescription: string;
  activePickupSummary: string;
  activeCoilsSummary: string;
}

export interface SwitchingAnalysisReport {
  totalCombinations: number;
  distinctTonesCount: number;
  switchesCount: number;
  pushPullsCount: number;
  humCancellingCount: number;
  splitCoilCount: number;
  outOfPhaseCount: number;
  seriesCount: number;
  parallelCount: number;
  soloCount: number;
  mutedCount: number;
  resistanceRange: { min: number; max: number };
  resonantFreqRange: { min: number; max: number };
  controls: SwitchingControlDef[];
  items: SwitchingCombinationReportItem[];
  groupedItems: GroupedSwitchingCombinationItem[];
}
