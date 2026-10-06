import { CircuitComponent, ComponentType, Terminal } from '../types/guitar';

export interface ComponentMetadata {
  type: ComponentType;
  name: string;
  category: 'pickup' | 'pot' | 'switch' | 'passive' | 'output';
  defaultWidth: number;
  defaultHeight: number;
  description: string;
  getTerminals: (comp: CircuitComponent) => Terminal[];
}

export const COMPONENT_METADATA: Record<ComponentType, ComponentMetadata> = {
  'pickup-humbucker': {
    type: 'pickup-humbucker',
    name: 'Humbucker (4-Conductor)',
    category: 'pickup',
    defaultWidth: 200,
    defaultHeight: 110,
    description: 'Dual-coil hum-cancelling pickup with individual coil leads and flippable magnet bar.',
    getTerminals: () => [
      { id: 'north-start', label: 'N-Start (Black)', x: 190, y: 16, type: 'coil' },
      { id: 'north-finish', label: 'N-Finish (White)', x: 190, y: 35, type: 'coil' },
      { id: 'south-finish', label: 'S-Finish (Red)', x: 190, y: 55, type: 'coil' },
      { id: 'south-start', label: 'S-Start (Green)', x: 190, y: 74, type: 'coil' },
      { id: 'bare-shield', label: 'Bare Shield', x: 190, y: 94, type: 'ground' },
    ],
  },
  'pickup-singlecoil': {
    type: 'pickup-singlecoil',
    name: 'Strat Single Coil',
    category: 'pickup',
    defaultWidth: 165,
    defaultHeight: 70,
    description: 'Traditional Stratocaster single coil with Alnico pole pieces (available as RWRP).',
    getTerminals: () => [
      { id: 'hot', label: 'Hot Lead (White)', x: 152, y: 22, type: 'coil' },
      { id: 'ground', label: 'Ground (Black)', x: 152, y: 48, type: 'ground' },
    ],
  },
  'pickup-p90': {
    type: 'pickup-p90',
    name: 'P-90 Soapbar',
    category: 'pickup',
    defaultWidth: 175,
    defaultHeight: 80,
    description: 'Wide-bobbin vintage single coil with dual bar magnets and raw gritty mid-range punch.',
    getTerminals: () => [
      { id: 'hot', label: 'Hot Lead (White)', x: 160, y: 27, type: 'coil' },
      { id: 'ground', label: 'Braided Shield', x: 160, y: 53, type: 'ground' },
    ],
  },
  'pickup-tele-neck': {
    type: 'pickup-tele-neck',
    name: 'Tele Neck (Cover Isolated)',
    category: 'pickup',
    defaultWidth: 155,
    defaultHeight: 65,
    description: 'Warm Tele neck pickup with separate chrome cover ground wire for series/4-way mod.',
    getTerminals: () => [
      { id: 'hot', label: 'Hot (Yellow)', x: 142, y: 16, type: 'coil' },
      { id: 'ground', label: 'Ground (Black)', x: 142, y: 32, type: 'ground' },
      { id: 'cover-ground', label: 'Cover Shield', x: 142, y: 49, type: 'ground' },
    ],
  },
  'pickup-tele-bridge': {
    type: 'pickup-tele-bridge',
    name: 'Tele Bridge Pickup',
    category: 'pickup',
    defaultWidth: 165,
    defaultHeight: 90,
    description: 'High-output twang pickup mounted with copper baseplate grounded to black lead.',
    getTerminals: () => [
      { id: 'hot', label: 'Hot Lead (White)', x: 152, y: 28, type: 'coil' },
      { id: 'ground', label: 'Baseplate Ground', x: 152, y: 62, type: 'ground' },
    ],
  },
  'pot-standard': {
    type: 'pot-standard',
    name: 'CTS Potentiometer',
    category: 'pot',
    defaultWidth: 115,
    defaultHeight: 140,
    description: 'Standard 24mm CTS-style guitar potentiometer (Audio or Linear taper) in soldering view.',
    getTerminals: () => [
      { id: 'lug-1', label: 'Lug 1 (CCW)', x: 24, y: 82, type: 'signal' },
      { id: 'lug-2', label: 'Lug 2 (Wiper)', x: 57, y: 90, type: 'signal' },
      { id: 'lug-3', label: 'Lug 3 (CW)', x: 91, y: 82, type: 'signal' },
      { id: 'case-ground', label: 'Case Solder Ground', x: 99, y: 40, type: 'ground' },
    ],
  },
  'pot-pushpull': {
    type: 'pot-pushpull',
    name: 'Push-Pull DPDT Pot',
    category: 'pot',
    defaultWidth: 125,
    defaultHeight: 222,
    description: 'Potentiometer with integrated pull-up DPDT switch for coil split, phase, or series mod.',
    getTerminals: () => [
      // DPDT Switch terminals (top box containing 6 connectors)
      { id: 'sw-1', label: 'Switch 1 (Down)', x: 42, y: 14, type: 'switch-throw' },
      { id: 'sw-c1', label: 'Switch Common 1', x: 42, y: 30, type: 'switch-common' },
      { id: 'sw-2', label: 'Switch 2 (Up)', x: 42, y: 46, type: 'switch-throw' },
      { id: 'sw-3', label: 'Switch 3 (Down)', x: 83, y: 14, type: 'switch-throw' },
      { id: 'sw-c2', label: 'Switch Common 2', x: 83, y: 30, type: 'switch-common' },
      { id: 'sw-4', label: 'Switch 4 (Up)', x: 83, y: 46, type: 'switch-throw' },
      // Pot terminals (middle section: 3 lugs below label/taper circle)
      { id: 'lug-1', label: 'Pot Lug 1', x: 26, y: 148, type: 'signal' },
      { id: 'lug-2', label: 'Pot Wiper', x: 62, y: 156, type: 'signal' },
      { id: 'lug-3', label: 'Pot Lug 3', x: 99, y: 148, type: 'signal' },
      { id: 'case-ground', label: 'Pot Body Ground', x: 114, y: 108, type: 'ground' },
    ],
  },
  'pot-stacked': {
    type: 'pot-stacked',
    name: 'Stacked Concentric Pot',
    category: 'pot',
    defaultWidth: 130,
    defaultHeight: 235,
    description: 'Dual concentric dual-gang potentiometer for independent Volume and Tone in one hole.',
    getTerminals: () => [
      // Upper gang (inner knob) - below circle
      { id: 'a-lug-1', label: 'A (Inner) Lug 1', x: 25, y: 84, type: 'signal' },
      { id: 'a-lug-2', label: 'A (Inner) Wiper', x: 65, y: 92, type: 'signal' },
      { id: 'a-lug-3', label: 'A (Inner) Lug 3', x: 105, y: 84, type: 'signal' },
      // Lower gang (outer knob) - below circle
      { id: 'b-lug-1', label: 'B (Outer) Lug 1', x: 25, y: 132, type: 'signal' },
      { id: 'b-lug-2', label: 'B (Outer) Wiper', x: 65, y: 140, type: 'signal' },
      { id: 'b-lug-3', label: 'B (Outer) Lug 3', x: 105, y: 132, type: 'signal' },
      { id: 'case-ground', label: 'Casing Ground', x: 114, y: 42, type: 'ground' },
    ],
  },
  'pot-blend': {
    type: 'pot-blend',
    name: 'Blend / Balance Pot (M/N)',
    category: 'pot',
    defaultWidth: 130,
    defaultHeight: 235,
    description: 'Center-detent dual-gang pot for smoothly blending between two pickups without volume drop.',
    getTerminals: () => [
      { id: 'a-in', label: 'Pickup A Hot In', x: 25, y: 84, type: 'signal' },
      { id: 'a-wiper', label: 'Wiper A Out', x: 65, y: 92, type: 'signal' },
      { id: 'a-ground', label: 'Lug A Ground', x: 105, y: 84, type: 'ground' },
      { id: 'b-in', label: 'Pickup B Hot In', x: 25, y: 132, type: 'signal' },
      { id: 'b-wiper', label: 'Wiper B Out', x: 65, y: 140, type: 'signal' },
      { id: 'b-ground', label: 'Lug B Ground', x: 105, y: 132, type: 'ground' },
      { id: 'case-ground', label: 'Casing Ground', x: 114, y: 42, type: 'ground' },
    ],
  },
  'switch-3way-toggle': {
    type: 'switch-3way-toggle',
    name: '3-Way Toggle Switch (LP Style)',
    category: 'switch',
    defaultWidth: 120,
    defaultHeight: 135,
    description: 'Switchcraft style leaf toggle switch in upside-down cavity soldering view.',
    getTerminals: () => [
      { id: 'sw-ground', label: 'Chassis Ground', x: 60, y: 16, type: 'ground' },
      { id: 'sw-bridge', label: 'Bridge Lug', x: 28, y: 46, type: 'switch-throw' },
      { id: 'sw-output', label: 'Output (Center Blade)', x: 60, y: 58, type: 'switch-common' },
      { id: 'sw-neck', label: 'Neck Lug', x: 92, y: 46, type: 'switch-throw' },
    ],
  },
  'switch-5way-blade': {
    type: 'switch-5way-blade',
    name: '5-Way Blade Switch (Strat)',
    category: 'switch',
    defaultWidth: 170,
    defaultHeight: 125,
    description: 'Oak Grigsby / CRL style 8-lug 2-pole 5-way selector switch with Strat blade lever at bottom.',
    getTerminals: () => [
      // Pole 1
      { id: 'p1-c', label: 'Pole 1 Common', x: 25, y: 22, type: 'switch-common' },
      { id: 'p1-1', label: 'P1 Throw 1 (Neck)', x: 42, y: 38, type: 'switch-throw' },
      { id: 'p1-2', label: 'P1 Throw 2 (Mid)', x: 60, y: 22, type: 'switch-throw' },
      { id: 'p1-3', label: 'P1 Throw 3 (Bridge)', x: 78, y: 38, type: 'switch-throw' },
      // Pole 2
      { id: 'p2-1', label: 'P2 Throw 1', x: 98, y: 22, type: 'switch-throw' },
      { id: 'p2-2', label: 'P2 Throw 2', x: 116, y: 38, type: 'switch-throw' },
      { id: 'p2-3', label: 'P2 Throw 3', x: 134, y: 22, type: 'switch-throw' },
      { id: 'p2-c', label: 'Pole 2 Common', x: 152, y: 38, type: 'switch-common' },
    ],
  },
  'switch-3way-blade': {
    type: 'switch-3way-blade',
    name: '3-Way Blade Switch (Tele)',
    category: 'switch',
    defaultWidth: 160,
    defaultHeight: 125,
    description: 'Traditional 3-way Telecaster blade switch with 2 poles and lever at bottom.',
    getTerminals: () => [
      { id: 'p1-c', label: 'Pole 1 Common', x: 25, y: 22, type: 'switch-common' },
      { id: 'p1-1', label: 'P1 Throw 1 (Neck)', x: 42, y: 38, type: 'switch-throw' },
      { id: 'p1-2', label: 'P1 Throw 2 (Both)', x: 60, y: 22, type: 'switch-throw' },
      { id: 'p1-3', label: 'P1 Throw 3 (Bridge)', x: 78, y: 38, type: 'switch-throw' },
      { id: 'p2-1', label: 'P2 Throw 1', x: 96, y: 22, type: 'switch-throw' },
      { id: 'p2-2', label: 'P2 Throw 2', x: 114, y: 38, type: 'switch-throw' },
      { id: 'p2-3', label: 'P2 Throw 3', x: 132, y: 22, type: 'switch-throw' },
      { id: 'p2-c', label: 'Pole 2 Common', x: 148, y: 38, type: 'switch-common' },
    ],
  },
  'switch-4way-blade': {
    type: 'switch-4way-blade',
    name: '4-Way Mod Blade Switch',
    category: 'switch',
    defaultWidth: 170,
    defaultHeight: 125,
    description: 'Oak Grigsby 4-way switch for Telecaster: Bridge, Bridge+Neck Parallel, Neck, Bridge+Neck Series.',
    getTerminals: () => [
      { id: 'p1-c', label: 'Pole 1 Common', x: 24, y: 22, type: 'switch-common' },
      { id: 'p1-1', label: 'P1 Throw 1', x: 40, y: 38, type: 'switch-throw' },
      { id: 'p1-2', label: 'P1 Throw 2', x: 58, y: 22, type: 'switch-throw' },
      { id: 'p1-3', label: 'P1 Throw 3', x: 76, y: 38, type: 'switch-throw' },
      { id: 'p1-4', label: 'P1 Throw 4', x: 94, y: 22, type: 'switch-throw' },
      { id: 'p2-c', label: 'Pole 2 Common', x: 112, y: 38, type: 'switch-common' },
      { id: 'p2-1', label: 'P2 Throw 1', x: 126, y: 22, type: 'switch-throw' },
      { id: 'p2-2', label: 'P2 Throw 2', x: 140, y: 38, type: 'switch-throw' },
      { id: 'p2-3', label: 'P2 Throw 3', x: 154, y: 22, type: 'switch-throw' },
      { id: 'p2-4', label: 'P2 Throw 4', x: 162, y: 38, type: 'switch-throw' },
    ],
  },
  'switch-superswitch': {
    type: 'switch-superswitch',
    name: 'Oak 4-Pole 5-Way Super Switch',
    category: 'switch',
    defaultWidth: 230,
    defaultHeight: 140,
    description: 'Ultra-custom 24-terminal switch with 4 completely independent isolated poles.',
    getTerminals: () => [
      // Pole A
      { id: 'pa-c', label: 'A Common', x: 20, y: 22, type: 'switch-common' },
      { id: 'pa-1', label: 'A1', x: 35, y: 36, type: 'switch-throw' },
      { id: 'pa-2', label: 'A2', x: 48, y: 22, type: 'switch-throw' },
      { id: 'pa-3', label: 'A3', x: 61, y: 36, type: 'switch-throw' },
      { id: 'pa-4', label: 'A4', x: 74, y: 22, type: 'switch-throw' },
      { id: 'pa-5', label: 'A5', x: 87, y: 36, type: 'switch-throw' },
      // Pole B
      { id: 'pb-c', label: 'B Common', x: 105, y: 22, type: 'switch-common' },
      { id: 'pb-1', label: 'B1', x: 118, y: 36, type: 'switch-throw' },
      { id: 'pb-2', label: 'B2', x: 131, y: 22, type: 'switch-throw' },
      { id: 'pb-3', label: 'B3', x: 144, y: 36, type: 'switch-throw' },
      { id: 'pb-4', label: 'B4', x: 157, y: 22, type: 'switch-throw' },
      { id: 'pb-5', label: 'B5', x: 170, y: 36, type: 'switch-throw' },
      // Pole C
      { id: 'pc-c', label: 'C Common', x: 20, y: 55, type: 'switch-common' },
      { id: 'pc-1', label: 'C1', x: 35, y: 68, type: 'switch-throw' },
      { id: 'pc-2', label: 'C2', x: 48, y: 55, type: 'switch-throw' },
      { id: 'pc-3', label: 'C3', x: 61, y: 68, type: 'switch-throw' },
      { id: 'pc-4', label: 'C4', x: 74, y: 55, type: 'switch-throw' },
      { id: 'pc-5', label: 'C5', x: 87, y: 68, type: 'switch-throw' },
      // Pole D
      { id: 'pd-c', label: 'D Common', x: 105, y: 55, type: 'switch-common' },
      { id: 'pd-1', label: 'D1', x: 118, y: 68, type: 'switch-throw' },
      { id: 'pd-2', label: 'D2', x: 131, y: 55, type: 'switch-throw' },
      { id: 'pd-3', label: 'D3', x: 144, y: 68, type: 'switch-throw' },
      { id: 'pd-4', label: 'D4', x: 157, y: 55, type: 'switch-throw' },
      { id: 'pd-5', label: 'D5', x: 170, y: 68, type: 'switch-throw' },
    ],
  },
  'switch-dpdt-minitoggle': {
    type: 'switch-dpdt-minitoggle',
    name: 'Mini Toggle (DPDT)',
    category: 'switch',
    defaultWidth: 90,
    defaultHeight: 125,
    description: 'Sub-miniature DPDT toggle switch with bat toggle lever at bottom.',
    getTerminals: () => [
      { id: 'sw-1', label: 'Lug 1 (Up)', x: 28, y: 20, type: 'switch-throw' },
      { id: 'sw-c1', label: 'Common 1', x: 28, y: 44, type: 'switch-common' },
      { id: 'sw-2', label: 'Lug 2 (Down)', x: 28, y: 68, type: 'switch-throw' },
      { id: 'sw-3', label: 'Lug 3 (Up)', x: 62, y: 20, type: 'switch-throw' },
      { id: 'sw-c2', label: 'Common 2', x: 62, y: 44, type: 'switch-common' },
      { id: 'sw-4', label: 'Lug 4 (Down)', x: 62, y: 68, type: 'switch-throw' },
    ],
  },
  'capacitor': {
    type: 'capacitor',
    name: 'Tone Capacitor',
    category: 'passive',
    defaultWidth: 100,
    defaultHeight: 50,
    description: 'Tone roll-off capacitor (e.g. 0.022µF Orange Drop or 0.047µF vintage).',
    getTerminals: () => [
      { id: 'lead-1', label: 'Lead 1', x: 15, y: 25, type: 'signal' },
      { id: 'lead-2', label: 'Lead 2', x: 85, y: 25, type: 'signal' },
    ],
  },
  'resistor': {
    type: 'resistor',
    name: 'Resistor (Treble Bleed / Load)',
    category: 'passive',
    defaultWidth: 90,
    defaultHeight: 40,
    description: 'Resistor for treble bleed circuit (e.g. 150kΩ) or fixed pickup load.',
    getTerminals: () => [
      { id: 'lead-1', label: 'Lead 1', x: 12, y: 20, type: 'signal' },
      { id: 'lead-2', label: 'Lead 2', x: 78, y: 20, type: 'signal' },
    ],
  },
  'output-jack': {
    type: 'output-jack',
    name: '1/4" Mono Output Jack',
    category: 'output',
    defaultWidth: 95,
    defaultHeight: 85,
    description: 'Switchcraft 1/4" mono guitar output jack with tip spring and sleeve ground lug.',
    getTerminals: () => [
      { id: 'tip', label: 'Tip (Hot Signal)', x: 28, y: 22, type: 'signal' },
      { id: 'sleeve', label: 'Sleeve (Ground)', x: 68, y: 22, type: 'ground' },
    ],
  },
  'ground-lug': {
    type: 'ground-lug',
    name: 'Star Ground / Bridge Ground',
    category: 'passive',
    defaultWidth: 80,
    defaultHeight: 70,
    description: 'Star grounding solder point and bridge grounding wire connection.',
    getTerminals: () => [
      { id: 'gnd-1', label: 'Ground Lug 1', x: 22, y: 24, type: 'ground' },
      { id: 'gnd-2', label: 'Ground Lug 2', x: 58, y: 24, type: 'ground' },
      { id: 'gnd-3', label: 'Ground Lug 3', x: 22, y: 48, type: 'ground' },
      { id: 'gnd-bridge', label: 'Bridge Wire Post', x: 58, y: 48, type: 'ground' },
    ],
  },
};

export function getComponentTerminals(comp: CircuitComponent): Terminal[] {
  const meta = COMPONENT_METADATA[comp.type];
  if (!meta) return [];
  return meta.getTerminals(comp);
}
