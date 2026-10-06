import { WiringPreset } from '../types/guitar';

export const WIRING_PRESETS: WiringPreset[] = [
  {
    id: 'strat-modern-sss',
    name: 'Fender Stratocaster (Modern SSS)',
    category: 'Fender',
    description: 'Classic 5-way Stratocaster with RWRP middle pickup for hum-cancelling in positions 2 & 4. Master Volume, Neck Tone, and Middle Tone.',
    tags: ['Single Coil', '5-Way Blade', 'RWRP Hum Cancelling', 'Quack Tone'],
    components: [
      {
        id: 'pu-neck',
        type: 'pickup-singlecoil',
        name: 'Neck Single Coil',
        x: 60,
        y: 60,
        properties: { pickupPosition: 'neck', dcResistanceK: 5.9, inductanceH: 2.4, rwrp: false },
      },
      {
        id: 'pu-mid',
        type: 'pickup-singlecoil',
        name: 'Middle Single Coil (RWRP)',
        x: 60,
        y: 160,
        properties: { pickupPosition: 'middle', dcResistanceK: 6.2, inductanceH: 2.6, rwrp: true },
      },
      {
        id: 'pu-bridge',
        type: 'pickup-singlecoil',
        name: 'Bridge Single Coil',
        x: 60,
        y: 260,
        properties: { pickupPosition: 'bridge', dcResistanceK: 6.8, inductanceH: 3.1, rwrp: false },
      },
      {
        id: 'sw-5way',
        type: 'switch-5way-blade',
        name: 'Oak Grigsby 5-Way Switch',
        x: 290,
        y: 150,
        properties: { switchPosition: 0, numPositions: 5 },
      },
      {
        id: 'pot-vol',
        type: 'pot-standard',
        name: 'Master Volume (250k Audio)',
        x: 520,
        y: 70,
        properties: { resistanceK: 250, taper: 'audio', currentValue: 1.0 },
      },
      {
        id: 'pot-tone1',
        type: 'pot-standard',
        name: 'Neck Tone (250k Audio)',
        x: 520,
        y: 220,
        properties: { resistanceK: 250, taper: 'audio', currentValue: 1.0 },
      },
      {
        id: 'pot-tone2',
        type: 'pot-standard',
        name: 'Middle Tone (250k Audio)',
        x: 520,
        y: 370,
        properties: { resistanceK: 250, taper: 'audio', currentValue: 1.0 },
      },
      {
        id: 'cap-tone',
        type: 'capacitor',
        name: 'Tone Cap (0.022µF Orange Drop)',
        x: 690,
        y: 260,
        properties: { capacitanceUf: 0.022, capType: 'orange-drop' },
      },
      {
        id: 'jack-out',
        type: 'output-jack',
        name: 'Switchcraft 1/4" Output Jack',
        x: 740,
        y: 90,
        properties: { jackType: 'mono' },
      },
      {
        id: 'gnd-bus',
        type: 'ground-lug',
        name: 'Cavity Shield / Bridge Ground',
        x: 320,
        y: 380,
        properties: {},
      },
    ],
    wires: [
      // Pickups to 5-Way switch
      { id: 'w-neck-hot', fromComponentId: 'pu-neck', fromTerminalId: 'hot', toComponentId: 'sw-5way', toTerminalId: 'p1-1', color: '#f8fafc' },
      { id: 'w-mid-hot', fromComponentId: 'pu-mid', fromTerminalId: 'hot', toComponentId: 'sw-5way', toTerminalId: 'p1-2', color: '#eab308' },
      { id: 'w-bridge-hot', fromComponentId: 'pu-bridge', fromTerminalId: 'hot', toComponentId: 'sw-5way', toTerminalId: 'p1-3', color: '#ef4444' },

      // Switch Common to Volume Lug 3
      { id: 'w-sw-to-vol', fromComponentId: 'sw-5way', fromTerminalId: 'p1-c', toComponentId: 'pot-vol', toTerminalId: 'lug-3', color: '#18181b' },

      // Tone connections from Switch Pole 2
      { id: 'w-sw-tone-link', fromComponentId: 'sw-5way', fromTerminalId: 'p1-c', toComponentId: 'sw-5way', toTerminalId: 'p2-c', color: '#eab308' },
      { id: 'w-sw-to-tone1', fromComponentId: 'sw-5way', fromTerminalId: 'p2-1', toComponentId: 'pot-tone1', toTerminalId: 'lug-3', color: '#3b82f6' },
      { id: 'w-sw-to-tone2', fromComponentId: 'sw-5way', fromTerminalId: 'p2-2', toComponentId: 'pot-tone2', toTerminalId: 'lug-3', color: '#22c55e' },

      // Tone pot wipers to Tone Capacitor
      { id: 'w-tone1-to-cap', fromComponentId: 'pot-tone1', fromTerminalId: 'lug-2', toComponentId: 'cap-tone', toTerminalId: 'lead-1', color: '#eab308' },
      { id: 'w-tone2-to-cap', fromComponentId: 'pot-tone2', fromTerminalId: 'lug-2', toComponentId: 'cap-tone', toTerminalId: 'lead-1', color: '#eab308' },
      { id: 'w-cap-to-gnd', fromComponentId: 'cap-tone', fromTerminalId: 'lead-2', toComponentId: 'pot-tone1', toTerminalId: 'case-ground', color: '#18181b' },

      // Volume Lug 2 (Wiper) to Jack Tip
      { id: 'w-vol-to-jack', fromComponentId: 'pot-vol', fromTerminalId: 'lug-2', toComponentId: 'jack-out', toTerminalId: 'tip', color: '#ef4444' },

      // Volume Lug 1 bent back and soldered to pot casing (Ground)
      { id: 'w-vol-lug1-gnd', fromComponentId: 'pot-vol', fromTerminalId: 'lug-1', toComponentId: 'pot-vol', toTerminalId: 'case-ground', color: '#18181b' },

      // Pickup grounds
      { id: 'w-neck-gnd', fromComponentId: 'pu-neck', fromTerminalId: 'ground', toComponentId: 'pot-vol', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-mid-gnd', fromComponentId: 'pu-mid', fromTerminalId: 'ground', toComponentId: 'pot-vol', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-bridge-gnd', fromComponentId: 'pu-bridge', fromTerminalId: 'ground', toComponentId: 'pot-vol', toTerminalId: 'case-ground', color: '#18181b' },

      // Ground bus daisy chain
      { id: 'w-vol-to-t1-gnd', fromComponentId: 'pot-vol', fromTerminalId: 'case-ground', toComponentId: 'pot-tone1', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-t1-to-t2-gnd', fromComponentId: 'pot-tone1', fromTerminalId: 'case-ground', toComponentId: 'pot-tone2', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-gnd-to-jack', fromComponentId: 'pot-vol', fromTerminalId: 'case-ground', toComponentId: 'jack-out', toTerminalId: 'sleeve', color: '#18181b' },
      { id: 'w-gnd-to-bridge', fromComponentId: 'pot-vol', fromTerminalId: 'case-ground', toComponentId: 'gnd-bus', toTerminalId: 'gnd-bridge', color: '#18181b' },
    ],
    instructions: [
      'Mount all 3 single coils into pickguard (ensure RWRP middle pickup is in center).',
      'Solder white lead of Neck pickup to Switch Pole 1, Lug 1.',
      'Solder yellow lead of Middle pickup to Switch Pole 1, Lug 2.',
      'Solder red/white lead of Bridge pickup to Switch Pole 1, Lug 3.',
      'Bend Lug 1 of Volume pot against the pot casing and solder securely.',
      'Run a jumper wire between Pole 1 Common and Pole 2 Common on the 5-way switch.',
      'Connect Pole 1 Common to Volume Pot Lug 3.',
      'Connect Tone 1 (Neck) Lug 3 to Switch Pole 2 Lug 1; Tone 2 (Mid) Lug 3 to Switch Pole 2 Lug 2.',
      'Solder 0.022µF capacitor between Tone wipers and ground on pot casing.',
      'Connect Volume Wiper (Lug 2) to Output Jack Tip; connect all grounds to Jack Sleeve and bridge wire.',
    ],
    billOfMaterials: [
      { item: 'Single Coil Pickups (Set of 3, RWRP Middle)', qty: 1, specs: 'Alnico V, ~6.0kΩ' },
      { item: 'CTS 250k Audio Taper Potentiometers', qty: 3, specs: 'Split shaft, 24mm' },
      { item: 'Oak Grigsby 5-Way Blade Switch', qty: 1, specs: 'Standard Strat 8-lug' },
      { item: 'Sprague Orange Drop 0.022µF Capacitor', qty: 1, specs: '100V 223J Polyester/Polypropylene' },
      { item: 'Switchcraft 1/4" Mono Phone Jack', qty: 1, specs: 'Model #11' },
      { item: '22 AWG Vintage Cloth Push-Back Wire', qty: 3, specs: 'Black, White, Yellow (ft)' },
    ],
  },
  {
    id: 'les-paul-50s-hh',
    name: 'Gibson Les Paul (1950s Vintage Wiring)',
    category: 'Gibson',
    description: 'Legendary 1950s Les Paul circuit with independent Volume and Tone for each pickup. Tone caps connect directly to Volume wipers, maintaining clarity when rolling down volume.',
    tags: ['Humbuckers', '3-Way Toggle', '50s Wiring', 'Warm / Punchy'],
    components: [
      {
        id: 'pu-neck',
        type: 'pickup-humbucker',
        name: 'Neck PAF Humbucker',
        x: 60,
        y: 80,
        properties: { pickupPosition: 'neck', dcResistanceK: 7.8, inductanceH: 4.1, magnetType: 'Alnico II', magnetFlipped: false },
      },
      {
        id: 'pu-bridge',
        type: 'pickup-humbucker',
        name: 'Bridge PAF Humbucker',
        x: 60,
        y: 260,
        properties: { pickupPosition: 'bridge', dcResistanceK: 8.6, inductanceH: 4.8, magnetType: 'Alnico II', magnetFlipped: false },
      },
      {
        id: 'pot-neck-vol',
        type: 'pot-standard',
        name: 'Neck Volume (500k Audio)',
        x: 310,
        y: 70,
        properties: { resistanceK: 500, taper: 'audio', currentValue: 1.0 },
      },
      {
        id: 'pot-neck-tone',
        type: 'pot-standard',
        name: 'Neck Tone (500k Audio)',
        x: 310,
        y: 220,
        properties: { resistanceK: 500, taper: 'audio', currentValue: 1.0 },
      },
      {
        id: 'pot-bridge-vol',
        type: 'pot-standard',
        name: 'Bridge Volume (500k Audio)',
        x: 480,
        y: 70,
        properties: { resistanceK: 500, taper: 'audio', currentValue: 1.0 },
      },
      {
        id: 'pot-bridge-tone',
        type: 'pot-standard',
        name: 'Bridge Tone (500k Audio)',
        x: 480,
        y: 220,
        properties: { resistanceK: 500, taper: 'audio', currentValue: 1.0 },
      },
      {
        id: 'cap-neck',
        type: 'capacitor',
        name: 'Neck 0.022µF Bumblebee Cap',
        x: 310,
        y: 350,
        properties: { capacitanceUf: 0.022, capType: 'paper-in-oil' },
      },
      {
        id: 'cap-bridge',
        type: 'capacitor',
        name: 'Bridge 0.022µF Bumblebee Cap',
        x: 480,
        y: 350,
        properties: { capacitanceUf: 0.022, capType: 'paper-in-oil' },
      },
      {
        id: 'sw-toggle',
        type: 'switch-3way-toggle',
        name: 'Switchcraft 3-Way Toggle',
        x: 650,
        y: 120,
        properties: { switchPosition: 1 },
      },
      {
        id: 'jack-out',
        type: 'output-jack',
        name: '1/4" Mono Output Jack',
        x: 800,
        y: 120,
        properties: { jackType: 'mono' },
      },
      {
        id: 'gnd-bus',
        type: 'ground-lug',
        name: 'Bridge Ground Post',
        x: 660,
        y: 340,
        properties: {},
      },
    ],
    wires: [
      // Neck Humbucker internal series link
      { id: 'w-n-series', fromComponentId: 'pu-neck', fromTerminalId: 'north-finish', toComponentId: 'pu-neck', toTerminalId: 'south-finish', color: '#ef4444' },
      // Neck Hot to Neck Vol Lug 3
      { id: 'w-n-hot', fromComponentId: 'pu-neck', fromTerminalId: 'north-start', toComponentId: 'pot-neck-vol', toTerminalId: 'lug-3', color: '#18181b' },
      // Neck Ground to Neck Vol casing
      { id: 'w-n-gnd', fromComponentId: 'pu-neck', fromTerminalId: 'south-start', toComponentId: 'pot-neck-vol', toTerminalId: 'case-ground', color: '#22c55e' },
      { id: 'w-n-shield', fromComponentId: 'pu-neck', fromTerminalId: 'bare-shield', toComponentId: 'pot-neck-vol', toTerminalId: 'case-ground', color: '#94a3b8' },

      // Bridge Humbucker internal series link
      { id: 'w-b-series', fromComponentId: 'pu-bridge', fromTerminalId: 'north-finish', toComponentId: 'pu-bridge', toTerminalId: 'south-finish', color: '#ef4444' },
      // Bridge Hot to Bridge Vol Lug 3
      { id: 'w-b-hot', fromComponentId: 'pu-bridge', fromTerminalId: 'north-start', toComponentId: 'pot-bridge-vol', toTerminalId: 'lug-3', color: '#18181b' },
      // Bridge Ground to Bridge Vol casing
      { id: 'w-b-gnd', fromComponentId: 'pu-bridge', fromTerminalId: 'south-start', toComponentId: 'pot-bridge-vol', toTerminalId: 'case-ground', color: '#22c55e' },
      { id: 'w-b-shield', fromComponentId: 'pu-bridge', fromTerminalId: 'bare-shield', toComponentId: 'pot-bridge-vol', toTerminalId: 'case-ground', color: '#94a3b8' },

      // Volume Lug 1 to Casing (Ground)
      { id: 'w-nv-l1-gnd', fromComponentId: 'pot-neck-vol', fromTerminalId: 'lug-1', toComponentId: 'pot-neck-vol', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-bv-l1-gnd', fromComponentId: 'pot-bridge-vol', fromTerminalId: 'lug-1', toComponentId: 'pot-bridge-vol', toTerminalId: 'case-ground', color: '#18181b' },

      // 50s Wiring: Caps connect from Volume Wiper (Lug 2) to Tone Pot Lug 2
      { id: 'w-n-cap-1', fromComponentId: 'pot-neck-vol', fromTerminalId: 'lug-2', toComponentId: 'cap-neck', toTerminalId: 'lead-1', color: '#eab308' },
      { id: 'w-n-cap-2', fromComponentId: 'cap-neck', fromTerminalId: 'lead-2', toComponentId: 'pot-neck-tone', toTerminalId: 'lug-2', color: '#eab308' },
      { id: 'w-nt-l3-gnd', fromComponentId: 'pot-neck-tone', fromTerminalId: 'lug-3', toComponentId: 'pot-neck-tone', toTerminalId: 'case-ground', color: '#18181b' },

      { id: 'w-b-cap-1', fromComponentId: 'pot-bridge-vol', fromTerminalId: 'lug-2', toComponentId: 'cap-bridge', toTerminalId: 'lead-1', color: '#eab308' },
      { id: 'w-b-cap-2', fromComponentId: 'cap-bridge', fromTerminalId: 'lead-2', toComponentId: 'pot-bridge-tone', toTerminalId: 'lug-2', color: '#eab308' },
      { id: 'w-bt-l3-gnd', fromComponentId: 'pot-bridge-tone', fromTerminalId: 'lug-3', toComponentId: 'pot-bridge-tone', toTerminalId: 'case-ground', color: '#18181b' },

      // Volume wipers to 3-Way Toggle Switch
      { id: 'w-nv-to-toggle', fromComponentId: 'pot-neck-vol', fromTerminalId: 'lug-2', toComponentId: 'sw-toggle', toTerminalId: 'sw-neck', color: '#3b82f6' },
      { id: 'w-bv-to-toggle', fromComponentId: 'pot-bridge-vol', fromTerminalId: 'lug-2', toComponentId: 'sw-toggle', toTerminalId: 'sw-bridge', color: '#ef4444' },

      // Toggle Switch Output to Jack Tip
      { id: 'w-toggle-out', fromComponentId: 'sw-toggle', fromTerminalId: 'sw-output', toComponentId: 'jack-out', toTerminalId: 'tip', color: '#18181b' },

      // Ground bus daisy chain
      { id: 'w-gnd-loop1', fromComponentId: 'pot-neck-vol', fromTerminalId: 'case-ground', toComponentId: 'pot-neck-tone', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-gnd-loop2', fromComponentId: 'pot-neck-tone', fromTerminalId: 'case-ground', toComponentId: 'pot-bridge-tone', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-gnd-loop3', fromComponentId: 'pot-bridge-tone', fromTerminalId: 'case-ground', toComponentId: 'pot-bridge-vol', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-gnd-to-toggle', fromComponentId: 'pot-bridge-vol', fromTerminalId: 'case-ground', toComponentId: 'sw-toggle', toTerminalId: 'sw-ground', color: '#18181b' },
      { id: 'w-toggle-to-jack', fromComponentId: 'sw-toggle', fromTerminalId: 'sw-ground', toComponentId: 'jack-out', toTerminalId: 'sleeve', color: '#18181b' },
      { id: 'w-gnd-to-bridge', fromComponentId: 'pot-neck-tone', fromTerminalId: 'case-ground', toComponentId: 'gnd-bus', toTerminalId: 'gnd-bridge', color: '#18181b' },
    ],
    instructions: [
      'Solder Humbucker red and white wires together and tape off or leave isolated (standard series link).',
      'Solder black (hot) wire to Lug 3 of each corresponding Volume pot.',
      'Solder green (ground) and bare shield to the back of the Volume pot casing.',
      'Bend Lug 1 of each volume pot to the casing and solder to ground.',
      'KEY 50s DIFFERENCE: Connect one leg of the 0.022µF capacitor to Lug 2 (Wiper) of the Volume pot, and the other leg to Lug 2 (Wiper) of the Tone pot.',
      'Solder Lug 3 of each Tone pot to the back of the Tone pot casing.',
      'Run braided 2-conductor shielded wire from each volume pot wiper to the 3-Way toggle switch.',
      'Run switch output to 1/4" jack tip, and switch ground to jack sleeve.',
    ],
    billOfMaterials: [
      { item: 'PAF Humbucker Pickups (Neck & Bridge Set)', qty: 1, specs: 'Alnico II, 7.8k Neck / 8.6k Bridge' },
      { item: 'CTS 500k Audio Taper Long-Shaft Pots', qty: 4, specs: 'Solid brass shaft, 10% tolerance' },
      { item: 'Paper-in-Oil / Bumblebee 0.022µF Tone Capacitors', qty: 2, specs: '400V vintage spec' },
      { item: 'Switchcraft Long Straight 3-Way Toggle Switch', qty: 1, specs: 'Pre-tinned lugs' },
      { item: 'Switchcraft 1/4" Mono Output Jack', qty: 1, specs: 'Heavy duty 11A' },
      { item: 'Vintage Braided Shield Wire (ft)', qty: 4, specs: '22 AWG tinned copper' },
    ],
  },
  {
    id: 'peter-green-greeny',
    name: 'Peter Green "Greeny" Les Paul (Flipped Magnet)',
    category: 'Gibson',
    description: 'Iconic mod of the 1959 Les Paul made famous by Peter Green (Fleetwood Mac) and Gary Moore. The neck pickup magnet is reversed, producing a glorious nasal, hollow, out-of-phase bite in the middle toggle position while retaining full hum cancellation!',
    tags: ['Peter Green', 'Flipped Magnet', 'Out of Phase', 'Blues Tone'],
    components: [
      {
        id: 'pu-neck',
        type: 'pickup-humbucker',
        name: 'Neck PAF (Magnet FLIPPED)',
        x: 60,
        y: 80,
        properties: { pickupPosition: 'neck', dcResistanceK: 7.7, inductanceH: 4.0, magnetFlipped: true, magnetType: 'Alnico II' },
      },
      {
        id: 'pu-bridge',
        type: 'pickup-humbucker',
        name: 'Bridge PAF (Normal Polarity)',
        x: 60,
        y: 260,
        properties: { pickupPosition: 'bridge', dcResistanceK: 8.4, inductanceH: 4.6, magnetFlipped: false, magnetType: 'Alnico II' },
      },
      {
        id: 'pot-neck-vol',
        type: 'pot-standard',
        name: 'Neck Volume (500k)',
        x: 310,
        y: 70,
        properties: { resistanceK: 500, taper: 'audio', currentValue: 1.0 },
      },
      {
        id: 'pot-neck-tone',
        type: 'pot-standard',
        name: 'Neck Tone (500k)',
        x: 310,
        y: 220,
        properties: { resistanceK: 500, taper: 'audio', currentValue: 1.0 },
      },
      {
        id: 'pot-bridge-vol',
        type: 'pot-standard',
        name: 'Bridge Volume (500k)',
        x: 480,
        y: 70,
        properties: { resistanceK: 500, taper: 'audio', currentValue: 1.0 },
      },
      {
        id: 'pot-bridge-tone',
        type: 'pot-standard',
        name: 'Bridge Tone (500k)',
        x: 480,
        y: 220,
        properties: { resistanceK: 500, taper: 'audio', currentValue: 1.0 },
      },
      {
        id: 'cap-neck',
        type: 'capacitor',
        name: '0.022µF Tone Cap',
        x: 310,
        y: 350,
        properties: { capacitanceUf: 0.022, capType: 'orange-drop' },
      },
      {
        id: 'cap-bridge',
        type: 'capacitor',
        name: '0.022µF Tone Cap',
        x: 480,
        y: 350,
        properties: { capacitanceUf: 0.022, capType: 'orange-drop' },
      },
      {
        id: 'sw-toggle',
        type: 'switch-3way-toggle',
        name: '3-Way Toggle Switch',
        x: 650,
        y: 120,
        properties: { switchPosition: 1 }, // middle position active
      },
      {
        id: 'jack-out',
        type: 'output-jack',
        name: '1/4" Mono Output Jack',
        x: 800,
        y: 120,
        properties: { jackType: 'mono' },
      },
      {
        id: 'gnd-bus',
        type: 'ground-lug',
        name: 'Bridge Ground Post',
        x: 660,
        y: 340,
        properties: {},
      },
    ],
    wires: [
      { id: 'w-n-series', fromComponentId: 'pu-neck', fromTerminalId: 'north-finish', toComponentId: 'pu-neck', toTerminalId: 'south-finish', color: '#ef4444' },
      { id: 'w-n-hot', fromComponentId: 'pu-neck', fromTerminalId: 'north-start', toComponentId: 'pot-neck-vol', toTerminalId: 'lug-3', color: '#18181b' },
      { id: 'w-n-gnd', fromComponentId: 'pu-neck', fromTerminalId: 'south-start', toComponentId: 'pot-neck-vol', toTerminalId: 'case-ground', color: '#22c55e' },
      { id: 'w-n-shield', fromComponentId: 'pu-neck', fromTerminalId: 'bare-shield', toComponentId: 'pot-neck-vol', toTerminalId: 'case-ground', color: '#94a3b8' },

      { id: 'w-b-series', fromComponentId: 'pu-bridge', fromTerminalId: 'north-finish', toComponentId: 'pu-bridge', toTerminalId: 'south-finish', color: '#ef4444' },
      { id: 'w-b-hot', fromComponentId: 'pu-bridge', fromTerminalId: 'north-start', toComponentId: 'pot-bridge-vol', toTerminalId: 'lug-3', color: '#18181b' },
      { id: 'w-b-gnd', fromComponentId: 'pu-bridge', fromTerminalId: 'south-start', toComponentId: 'pot-bridge-vol', toTerminalId: 'case-ground', color: '#22c55e' },
      { id: 'w-b-shield', fromComponentId: 'pu-bridge', fromTerminalId: 'bare-shield', toComponentId: 'pot-bridge-vol', toTerminalId: 'case-ground', color: '#94a3b8' },

      { id: 'w-nv-l1-gnd', fromComponentId: 'pot-neck-vol', fromTerminalId: 'lug-1', toComponentId: 'pot-neck-vol', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-bv-l1-gnd', fromComponentId: 'pot-bridge-vol', fromTerminalId: 'lug-1', toComponentId: 'pot-bridge-vol', toTerminalId: 'case-ground', color: '#18181b' },

      { id: 'w-n-cap-1', fromComponentId: 'pot-neck-vol', fromTerminalId: 'lug-2', toComponentId: 'cap-neck', toTerminalId: 'lead-1', color: '#eab308' },
      { id: 'w-n-cap-2', fromComponentId: 'cap-neck', fromTerminalId: 'lead-2', toComponentId: 'pot-neck-tone', toTerminalId: 'lug-2', color: '#eab308' },
      { id: 'w-nt-l3-gnd', fromComponentId: 'pot-neck-tone', fromTerminalId: 'lug-3', toComponentId: 'pot-neck-tone', toTerminalId: 'case-ground', color: '#18181b' },

      { id: 'w-b-cap-1', fromComponentId: 'pot-bridge-vol', fromTerminalId: 'lug-2', toComponentId: 'cap-bridge', toTerminalId: 'lead-1', color: '#eab308' },
      { id: 'w-b-cap-2', fromComponentId: 'cap-bridge', fromTerminalId: 'lead-2', toComponentId: 'pot-bridge-tone', toTerminalId: 'lug-2', color: '#eab308' },
      { id: 'w-bt-l3-gnd', fromComponentId: 'pot-bridge-tone', fromTerminalId: 'lug-3', toComponentId: 'pot-bridge-tone', toTerminalId: 'case-ground', color: '#18181b' },

      { id: 'w-nv-to-toggle', fromComponentId: 'pot-neck-vol', fromTerminalId: 'lug-2', toComponentId: 'sw-toggle', toTerminalId: 'sw-neck', color: '#3b82f6' },
      { id: 'w-bv-to-toggle', fromComponentId: 'pot-bridge-vol', fromTerminalId: 'lug-2', toComponentId: 'sw-toggle', toTerminalId: 'sw-bridge', color: '#ef4444' },

      { id: 'w-toggle-out', fromComponentId: 'sw-toggle', fromTerminalId: 'sw-output', toComponentId: 'jack-out', toTerminalId: 'tip', color: '#18181b' },

      { id: 'w-gnd-loop1', fromComponentId: 'pot-neck-vol', fromTerminalId: 'case-ground', toComponentId: 'pot-neck-tone', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-gnd-loop2', fromComponentId: 'pot-neck-tone', fromTerminalId: 'case-ground', toComponentId: 'pot-bridge-tone', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-gnd-loop3', fromComponentId: 'pot-bridge-tone', fromTerminalId: 'case-ground', toComponentId: 'pot-bridge-vol', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-gnd-to-toggle', fromComponentId: 'pot-bridge-vol', fromTerminalId: 'case-ground', toComponentId: 'sw-toggle', toTerminalId: 'sw-ground', color: '#18181b' },
      { id: 'w-toggle-to-jack', fromComponentId: 'sw-toggle', fromTerminalId: 'sw-ground', toComponentId: 'jack-out', toTerminalId: 'sleeve', color: '#18181b' },
      { id: 'w-gnd-to-bridge', fromComponentId: 'pot-neck-tone', fromTerminalId: 'case-ground', toComponentId: 'gnd-bus', toTerminalId: 'gnd-bridge', color: '#18181b' },
    ],
    instructions: [
      'To recreate the Peter Green mod physically: Carefully remove the chrome cover of the neck PAF humbucker.',
      'Loosen the 4 baseplate brass screws halfway to relieve pressure on the internal Alnico bar magnet.',
      'Slide the bar magnet out, flip it over 180° along its long axis (so the North pole face points toward the screw bobbin instead of the slug bobbin), and re-insert.',
      'Tighten screws and reinstall cover.',
      'Solder standard 50s Les Paul circuit.',
      'Set the 3-Way toggle switch to the middle position: listen to the vocal-like hollow bite on audio playback!',
    ],
    billOfMaterials: [
      { item: 'Vintage PAF Humbuckers (Flipped Alnico II Magnet in Neck)', qty: 1, specs: '7.7k Neck, 8.4k Bridge' },
      { item: 'CTS 500k Audio Taper Pots', qty: 4, specs: '24mm Solid Brass' },
      { item: 'Orange Drop 0.022µF Capacitors', qty: 2, specs: 'Polypropylene 200V' },
      { item: 'Switchcraft 3-Way Toggle Switch', qty: 1, specs: 'Heavy duty nickel' },
      { item: 'Switchcraft 1/4" Mono Jack', qty: 1, specs: '#11 Mono' },
    ],
  },
  {
    id: 'jimmy-page-4pp',
    name: 'Jimmy Page "Number One" (4 Push-Pull Mod)',
    category: 'Custom / Mods',
    description: 'The ultimate Les Paul modification with 4 push-pull pots offering 21 unique tonal combinations: Individual coil-splits for neck and bridge, Phase reversal (Peter Green sound on demand), and Series/Parallel humbucker switching for monstrous output.',
    tags: ['Push-Pull DPDT', 'Coil Split', 'Phase Reverse', 'Series / Parallel', 'Jimmy Page'],
    components: [
      {
        id: 'pu-neck',
        type: 'pickup-humbucker',
        name: 'Neck 4-Conductor PAF',
        x: 60,
        y: 80,
        properties: { pickupPosition: 'neck', dcResistanceK: 7.9, inductanceH: 4.2 },
      },
      {
        id: 'pu-bridge',
        type: 'pickup-humbucker',
        name: 'Bridge 4-Conductor PAF',
        x: 60,
        y: 300,
        properties: { pickupPosition: 'bridge', dcResistanceK: 8.8, inductanceH: 4.9 },
      },
      {
        id: 'pot-neck-vol',
        type: 'pot-pushpull',
        name: 'Neck Vol (Pull: Split)',
        x: 320,
        y: 60,
        properties: { resistanceK: 500, taper: 'audio', currentValue: 1.0, pulledUp: false },
      },
      {
        id: 'pot-bridge-vol',
        type: 'pot-pushpull',
        name: 'Bridge Vol (Pull: Split)',
        x: 520,
        y: 60,
        properties: { resistanceK: 500, taper: 'audio', currentValue: 1.0, pulledUp: false },
      },
      {
        id: 'pot-neck-tone',
        type: 'pot-pushpull',
        name: 'Neck Tone (Pull: Phase Rev)',
        x: 320,
        y: 290,
        properties: { resistanceK: 500, taper: 'audio', currentValue: 1.0, pulledUp: false },
      },
      {
        id: 'pot-bridge-tone',
        type: 'pot-pushpull',
        name: 'Bridge Tone (Pull: Series)',
        x: 520,
        y: 290,
        properties: { resistanceK: 500, taper: 'audio', currentValue: 1.0, pulledUp: false },
      },
      {
        id: 'cap-neck',
        type: 'capacitor',
        name: 'Neck 0.022µF Tone Cap',
        x: 320,
        y: 520,
        properties: { capacitanceUf: 0.022, capType: 'orange-drop' },
      },
      {
        id: 'cap-bridge',
        type: 'capacitor',
        name: 'Bridge 0.022µF Tone Cap',
        x: 520,
        y: 520,
        properties: { capacitanceUf: 0.022, capType: 'orange-drop' },
      },
      {
        id: 'sw-toggle',
        type: 'switch-3way-toggle',
        name: '3-Way Toggle Switch',
        x: 720,
        y: 120,
        properties: { switchPosition: 1 },
      },
      {
        id: 'jack-out',
        type: 'output-jack',
        name: '1/4" Mono Output Jack',
        x: 880,
        y: 120,
        properties: { jackType: 'mono' },
      },
      {
        id: 'gnd-bus',
        type: 'ground-lug',
        name: 'Bridge Ground Post',
        x: 720,
        y: 350,
        properties: {},
      },
    ],
    wires: [
      // 1. Neck Coil Split (on Neck Volume DPDT): Red & White finish wires to C1, lug 2 to neck return
      { id: 'w-nv-split-w', fromComponentId: 'pu-neck', fromTerminalId: 'north-finish', toComponentId: 'pot-neck-vol', toTerminalId: 'sw-c1', color: '#f8fafc' },
      { id: 'w-nv-split-r', fromComponentId: 'pu-neck', fromTerminalId: 'south-finish', toComponentId: 'pot-neck-vol', toTerminalId: 'sw-c1', color: '#ef4444' },
      { id: 'w-nv-split-gnd', fromComponentId: 'pot-neck-vol', fromTerminalId: 'sw-2', toComponentId: 'pot-neck-tone', toTerminalId: 'sw-3', color: '#18181b' },
      { id: 'w-nv-l1-gnd', fromComponentId: 'pot-neck-vol', fromTerminalId: 'lug-1', toComponentId: 'pot-neck-vol', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-n-bare', fromComponentId: 'pu-neck', fromTerminalId: 'bare-shield', toComponentId: 'pot-neck-vol', toTerminalId: 'case-ground', color: '#94a3b8' },

      // 2. Neck Phase Inversion (on Neck Tone DPDT):
      // Neck coil leads feed into commons C1 & C2
      { id: 'w-nt-phase-in-hot', fromComponentId: 'pu-neck', fromTerminalId: 'north-start', toComponentId: 'pot-neck-tone', toTerminalId: 'sw-c1', color: '#18181b' },
      { id: 'w-nt-phase-in-gnd', fromComponentId: 'pu-neck', fromTerminalId: 'south-start', toComponentId: 'pot-neck-tone', toTerminalId: 'sw-c2', color: '#22c55e' },
      // Phase DPDT cross-wiring
      { id: 'w-nt-phase-x1', fromComponentId: 'pot-neck-tone', fromTerminalId: 'sw-2', toComponentId: 'pot-neck-tone', toTerminalId: 'sw-3', color: '#eab308' },
      { id: 'w-nt-phase-x2', fromComponentId: 'pot-neck-tone', fromTerminalId: 'sw-4', toComponentId: 'pot-neck-tone', toTerminalId: 'sw-1', color: '#eab308' },
      // Phase outputs: Hot to Neck Vol Lug 3, Ground return to Bridge Tone Series/Parallel switch
      { id: 'w-nt-phase-out-hot', fromComponentId: 'pot-neck-tone', fromTerminalId: 'sw-1', toComponentId: 'pot-neck-vol', toTerminalId: 'lug-3', color: '#18181b' },
      { id: 'w-nt-phase-out-gnd', fromComponentId: 'pot-neck-tone', fromTerminalId: 'sw-3', toComponentId: 'pot-bridge-tone', toTerminalId: 'sw-c1', color: '#22c55e' },

      // 3. Neck Volume wiper to 3-Way toggle
      { id: 'w-nv-to-toggle', fromComponentId: 'pot-neck-vol', fromTerminalId: 'lug-2', toComponentId: 'sw-toggle', toTerminalId: 'sw-neck', color: '#3b82f6' },

      // 4. Neck Tone Pot and Capacitor
      { id: 'w-nt-feed', fromComponentId: 'pot-neck-vol', fromTerminalId: 'lug-3', toComponentId: 'pot-neck-tone', toTerminalId: 'lug-3', color: '#eab308' },
      { id: 'w-nt-wiper-cap', fromComponentId: 'pot-neck-tone', fromTerminalId: 'lug-2', toComponentId: 'cap-neck', toTerminalId: 'lead-1', color: '#eab308' },
      { id: 'w-n-cap-gnd', fromComponentId: 'cap-neck', fromTerminalId: 'lead-2', toComponentId: 'pot-neck-tone', toTerminalId: 'case-ground', color: '#18181b' },

      // 5. Bridge Coil Split (on Bridge Volume DPDT): Red & White finish wires to C1, lug 2 to ground
      { id: 'w-bv-split-w', fromComponentId: 'pu-bridge', fromTerminalId: 'north-finish', toComponentId: 'pot-bridge-vol', toTerminalId: 'sw-c1', color: '#f8fafc' },
      { id: 'w-bv-split-r', fromComponentId: 'pu-bridge', fromTerminalId: 'south-finish', toComponentId: 'pot-bridge-vol', toTerminalId: 'sw-c1', color: '#ef4444' },
      { id: 'w-bv-split-gnd', fromComponentId: 'pot-bridge-vol', fromTerminalId: 'sw-2', toComponentId: 'pot-bridge-vol', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-bv-l1-gnd', fromComponentId: 'pot-bridge-vol', fromTerminalId: 'lug-1', toComponentId: 'pot-bridge-vol', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-b-bare', fromComponentId: 'pu-bridge', fromTerminalId: 'bare-shield', toComponentId: 'pot-bridge-vol', toTerminalId: 'case-ground', color: '#94a3b8' },

      // 6. Bridge Volume Pot
      { id: 'w-b-hot', fromComponentId: 'pu-bridge', fromTerminalId: 'north-start', toComponentId: 'pot-bridge-vol', toTerminalId: 'lug-3', color: '#18181b' },
      { id: 'w-b-gnd', fromComponentId: 'pu-bridge', fromTerminalId: 'south-start', toComponentId: 'pot-bridge-vol', toTerminalId: 'case-ground', color: '#22c55e' },
      { id: 'w-bv-to-toggle', fromComponentId: 'pot-bridge-vol', fromTerminalId: 'lug-2', toComponentId: 'sw-toggle', toTerminalId: 'sw-bridge', color: '#ef4444' },

      // 7. Bridge Tone Pot and Capacitor
      { id: 'w-bt-feed', fromComponentId: 'pot-bridge-vol', fromTerminalId: 'lug-3', toComponentId: 'pot-bridge-tone', toTerminalId: 'lug-3', color: '#eab308' },
      { id: 'w-bt-wiper-cap', fromComponentId: 'pot-bridge-tone', fromTerminalId: 'lug-2', toComponentId: 'cap-bridge', toTerminalId: 'lead-1', color: '#eab308' },
      { id: 'w-b-cap-gnd', fromComponentId: 'cap-bridge', fromTerminalId: 'lead-2', toComponentId: 'pot-bridge-tone', toTerminalId: 'case-ground', color: '#18181b' },

      // 8. Bridge Tone Series / Parallel Switch:
      // In Parallel (Down / sw-1): Neck ground return routes to Ground
      // In Series (Up / sw-2): Neck ground return routes to Bridge Hot
      { id: 'w-bt-ser-par-gnd', fromComponentId: 'pot-bridge-tone', fromTerminalId: 'sw-1', toComponentId: 'pot-bridge-tone', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-bt-ser-to-bridge', fromComponentId: 'pot-bridge-tone', fromTerminalId: 'sw-2', toComponentId: 'pot-bridge-vol', toTerminalId: 'lug-3', color: '#ef4444' },

      // 9. 3-Way Toggle Switch to 1/4" Jack
      { id: 'w-toggle-out', fromComponentId: 'sw-toggle', fromTerminalId: 'sw-output', toComponentId: 'jack-out', toTerminalId: 'tip', color: '#18181b' },
      { id: 'w-toggle-gnd', fromComponentId: 'sw-toggle', fromTerminalId: 'sw-ground', toComponentId: 'jack-out', toTerminalId: 'sleeve', color: '#18181b' },

      // 10. Ground Bus Daisy Chain & Shielding
      { id: 'w-gnd-nv-bv', fromComponentId: 'pot-neck-vol', fromTerminalId: 'case-ground', toComponentId: 'pot-bridge-vol', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-gnd-nv-nt', fromComponentId: 'pot-neck-vol', fromTerminalId: 'case-ground', toComponentId: 'pot-neck-tone', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-gnd-bv-bt', fromComponentId: 'pot-bridge-vol', fromTerminalId: 'case-ground', toComponentId: 'pot-bridge-tone', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-gnd-nt-bt', fromComponentId: 'pot-neck-tone', fromTerminalId: 'case-ground', toComponentId: 'pot-bridge-tone', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-gnd-bv-jack', fromComponentId: 'pot-bridge-vol', fromTerminalId: 'case-ground', toComponentId: 'jack-out', toTerminalId: 'sleeve', color: '#18181b' },
      { id: 'w-gnd-bt-bridge', fromComponentId: 'pot-bridge-tone', fromTerminalId: 'case-ground', toComponentId: 'gnd-bus', toTerminalId: 'gnd-bridge', color: '#18181b' },
    ],
    instructions: [
      'Install four CTS 500k push-pull potentiometers in the control cavity.',
      'Neck Volume Push-Pull: Pulling UP grounds the Red & White coil tap wire, isolating the North slug coil.',
      'Bridge Volume Push-Pull: Pulling UP grounds the bridge Red & White wire, isolating the Bridge coil.',
      'Neck Tone Push-Pull: Wired as a phase inverter switch on the neck pickup hot/ground leads.',
      'Bridge Tone Push-Pull: Re-routes ground and hot leads between pickups to put both pickups in SERIES instead of parallel.',
    ],
    billOfMaterials: [
      { item: '4-Conductor Humbucker Pickups', qty: 2, specs: 'Seymour Duncan / Gibson 4-conductor' },
      { item: 'CTS 500k DPDT Push-Pull Potentiometers', qty: 4, specs: 'Audio taper, split knurled shaft' },
      { item: 'Orange Drop 0.022µF Tone Capacitors', qty: 2, specs: '100V / 200V Polyester' },
      { item: 'Switchcraft 3-Way Long Toggle Switch', qty: 1, specs: 'Standard Gibson' },
      { item: 'Switchcraft 1/4" Mono Output Jack', qty: 1, specs: '#11' },
      { item: '22 AWG Multi-color Cloth Wire (ft)', qty: 6, specs: 'Black, Green, Red, White' },
    ],
  },
  {
    id: 'tele-4way-mod',
    name: 'Fender Telecaster (4-Way Switch Series Mod)',
    category: 'Fender',
    description: 'The definitive upgrade for any Telecaster! Position 4 combines Bridge and Neck pickups in SERIES for a humbucker-like high-output roar with punchy low-mids.',
    tags: ['Telecaster', '4-Way Switch', 'Series Punch', 'Twang + Roar'],
    components: [
      {
        id: 'pu-neck',
        type: 'pickup-tele-neck',
        name: 'Tele Neck (Cover Isolated)',
        x: 60,
        y: 80,
        properties: { pickupPosition: 'neck', dcResistanceK: 7.2, inductanceH: 2.5 },
      },
      {
        id: 'pu-bridge',
        type: 'pickup-tele-bridge',
        name: 'Tele Bridge Pickup',
        x: 60,
        y: 220,
        properties: { pickupPosition: 'bridge', dcResistanceK: 7.6, inductanceH: 3.4 },
      },
      {
        id: 'sw-4way',
        type: 'switch-4way-blade',
        name: 'Oak Grigsby 4-Way Switch',
        x: 270,
        y: 120,
        properties: { switchPosition: 3 }, // Pos 4 active (Series)
      },
      {
        id: 'pot-vol',
        type: 'pot-standard',
        name: 'Master Volume (250k)',
        x: 480,
        y: 80,
        properties: { resistanceK: 250, taper: 'audio', currentValue: 1.0 },
      },
      {
        id: 'pot-tone',
        type: 'pot-standard',
        name: 'Master Tone (250k)',
        x: 480,
        y: 240,
        properties: { resistanceK: 250, taper: 'audio', currentValue: 1.0 },
      },
      {
        id: 'cap-tone',
        type: 'capacitor',
        name: '0.047µF Tone Cap',
        x: 640,
        y: 240,
        properties: { capacitanceUf: 0.047, capType: 'orange-drop' },
      },
      {
        id: 'jack-out',
        type: 'output-jack',
        name: '1/4" Mono Output Jack',
        x: 680,
        y: 80,
        properties: { jackType: 'mono' },
      },
    ],
    wires: [
      // 4-Way Blade Switch Wiring:
      // Position 1 (Throw 1): Bridge Solo
      // Position 2 (Throw 2): Bridge & Neck in Parallel
      // Position 3 (Throw 3): Neck Solo
      // Position 4 (Throw 4): Bridge & Neck in SERIES

      // Bridge Pickup: Ground to pot case, Hot to Pole 1 Common
      { id: 'w-br-gnd', fromComponentId: 'pu-bridge', fromTerminalId: 'ground', toComponentId: 'pot-vol', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-br-hot-sw', fromComponentId: 'pu-bridge', fromTerminalId: 'hot', toComponentId: 'sw-4way', toTerminalId: 'p1-c', color: '#eab308' },

      // Pole 1: Throws 1 & 2 go to Vol Lug 3 (Bridge Hot to Output in Pos 1 & Pos 2)
      { id: 'w-p1-1-vol', fromComponentId: 'sw-4way', fromTerminalId: 'p1-1', toComponentId: 'pot-vol', toTerminalId: 'lug-3', color: '#eab308' },
      { id: 'w-p1-2-vol', fromComponentId: 'sw-4way', fromTerminalId: 'p1-2', toComponentId: 'pot-vol', toTerminalId: 'lug-3', color: '#eab308' },
      // Pole 1: Throw 4 connects Bridge Hot to Neck Ground (Series Link in Pos 4)
      { id: 'w-p1-4-nk-gnd', fromComponentId: 'sw-4way', fromTerminalId: 'p1-4', toComponentId: 'pu-neck', toTerminalId: 'ground', color: '#ef4444' },

      // Neck Pickup: Hot connects to Vol Lug 3 (Output), isolated cover ground straight to pot case
      { id: 'w-nk-hot-vol', fromComponentId: 'pu-neck', fromTerminalId: 'hot', toComponentId: 'pot-vol', toTerminalId: 'lug-3', color: '#f8fafc' },
      { id: 'w-cover-gnd', fromComponentId: 'pu-neck', fromTerminalId: 'cover-ground', toComponentId: 'pot-vol', toTerminalId: 'case-ground', color: '#94a3b8' },

      // Pole 2: Common is Neck Ground
      { id: 'w-nk-gnd-sw', fromComponentId: 'pu-neck', fromTerminalId: 'ground', toComponentId: 'sw-4way', toTerminalId: 'p2-c', color: '#18181b' },
      // Pole 2: Throws 2 & 3 go to Ground (Neck Grounded in Parallel Pos 2 & Neck Solo Pos 3)
      { id: 'w-p2-2-gnd', fromComponentId: 'sw-4way', fromTerminalId: 'p2-2', toComponentId: 'pot-vol', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-p2-3-gnd', fromComponentId: 'sw-4way', fromTerminalId: 'p2-3', toComponentId: 'pot-vol', toTerminalId: 'case-ground', color: '#18181b' },

      // Master Volume & Jack
      { id: 'w-vol-l1-gnd', fromComponentId: 'pot-vol', fromTerminalId: 'lug-1', toComponentId: 'pot-vol', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-vol-l2-jack', fromComponentId: 'pot-vol', fromTerminalId: 'lug-2', toComponentId: 'jack-out', toTerminalId: 'tip', color: '#ef4444' },
      { id: 'w-gnd-to-jack', fromComponentId: 'pot-vol', fromTerminalId: 'case-ground', toComponentId: 'jack-out', toTerminalId: 'sleeve', color: '#18181b' },

      // Tone pot connection
      { id: 'w-vol-to-tone', fromComponentId: 'pot-vol', fromTerminalId: 'lug-3', toComponentId: 'pot-tone', toTerminalId: 'lug-3', color: '#eab308' },
      { id: 'w-tone-wiper-cap', fromComponentId: 'pot-tone', fromTerminalId: 'lug-2', toComponentId: 'cap-tone', toTerminalId: 'lead-1', color: '#eab308' },
      { id: 'w-cap-gnd', fromComponentId: 'cap-tone', fromTerminalId: 'lead-2', toComponentId: 'pot-tone', toTerminalId: 'case-ground', color: '#18181b' },

      // Grounding
      { id: 'w-vol-tone-gnd', fromComponentId: 'pot-vol', fromTerminalId: 'case-ground', toComponentId: 'pot-tone', toTerminalId: 'case-ground', color: '#18181b' },
    ],
    instructions: [
      'CRITICAL FIRST STEP: Snip the small metal jumper wire connecting the Tele neck pickup chrome cover to its black coil ground eyelet.',
      'Solder a new 3rd wire (shield wire) directly to the chrome cover tab and run it straight to ground.',
      'Mount the Oak Grigsby 4-Way switch on the control plate.',
      'Position 1: Bridge pickup solo',
      'Position 2: Bridge & Neck in Parallel (Classic Tele tone)',
      'Position 3: Neck pickup solo',
      'Position 4: Bridge & Neck in SERIES (Massive output boost and thick overdrive tone).',
    ],
    billOfMaterials: [
      { item: 'Vintage Telecaster Pickups (Neck with 3-wire mod & Bridge)', qty: 1, specs: 'Alnico III/V' },
      { item: 'Oak Grigsby 4-Way Blade Switch', qty: 1, specs: 'Mod specification' },
      { item: 'CTS 250k Audio Taper Solid Shaft Pots', qty: 2, specs: 'Tele spec 3/8" bushing' },
      { item: 'Orange Drop 0.047µF Capacitor', qty: 1, specs: '473J 100V' },
      { item: 'Switchcraft 1/4" Mono Output Jack', qty: 1, specs: '#11' },
    ],
  },
  {
    id: 'blend-pot-dual-pickup',
    name: 'Dual Pickup with Blend / Balance Pot (Bass & Guitar)',
    category: 'Bass',
    description: 'Master Volume, Center-Detent Blend Pot (M/N taper), and Master Tone. Allows precise panning between two pickups without volume loss at the center detent.',
    tags: ['Blend Pot', 'Jazz Bass', 'Balance Control', 'P/J Bass'],
    components: [
      {
        id: 'pu-neck',
        type: 'pickup-singlecoil',
        name: 'Neck Pickup',
        x: 60,
        y: 80,
        properties: { pickupPosition: 'neck', dcResistanceK: 7.4, inductanceH: 3.2 },
      },
      {
        id: 'pu-bridge',
        type: 'pickup-singlecoil',
        name: 'Bridge Pickup (RWRP)',
        x: 60,
        y: 220,
        properties: { pickupPosition: 'bridge', dcResistanceK: 7.8, inductanceH: 3.5, rwrp: true },
      },
      {
        id: 'pot-blend',
        type: 'pot-blend',
        name: 'Blend Pot (250k M/N Taper)',
        x: 280,
        y: 110,
        properties: { resistanceK: 250, blendValue: 0.5 }, // 50% = both 100%
      },
      {
        id: 'pot-vol',
        type: 'pot-standard',
        name: 'Master Volume (250k)',
        x: 480,
        y: 80,
        properties: { resistanceK: 250, taper: 'audio', currentValue: 1.0 },
      },
      {
        id: 'pot-tone',
        type: 'pot-standard',
        name: 'Master Tone (250k)',
        x: 480,
        y: 240,
        properties: { resistanceK: 250, taper: 'audio', currentValue: 1.0 },
      },
      {
        id: 'cap-tone',
        type: 'capacitor',
        name: '0.047µF Tone Cap',
        x: 640,
        y: 240,
        properties: { capacitanceUf: 0.047, capType: 'orange-drop' },
      },
      {
        id: 'jack-out',
        type: 'output-jack',
        name: '1/4" Mono Output Jack',
        x: 680,
        y: 80,
        properties: { jackType: 'mono' },
      },
    ],
    wires: [
      // Pickup hot to Blend inputs
      { id: 'w-n-hot', fromComponentId: 'pu-neck', fromTerminalId: 'hot', toComponentId: 'pot-blend', toTerminalId: 'a-in', color: '#f8fafc' },
      { id: 'w-b-hot', fromComponentId: 'pu-bridge', fromTerminalId: 'hot', toComponentId: 'pot-blend', toTerminalId: 'b-in', color: '#ef4444' },

      // Blend wipers tied together to Master Volume Lug 3
      { id: 'w-blend-a-out', fromComponentId: 'pot-blend', fromTerminalId: 'a-wiper', toComponentId: 'pot-vol', toTerminalId: 'lug-3', color: '#18181b' },
      { id: 'w-blend-b-out', fromComponentId: 'pot-blend', fromTerminalId: 'b-wiper', toComponentId: 'pot-vol', toTerminalId: 'lug-3', color: '#18181b' },

      // Blend ground lugs
      { id: 'w-blend-a-gnd', fromComponentId: 'pot-blend', fromTerminalId: 'a-ground', toComponentId: 'pot-blend', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-blend-b-gnd', fromComponentId: 'pot-blend', fromTerminalId: 'b-ground', toComponentId: 'pot-blend', toTerminalId: 'case-ground', color: '#18181b' },

      // Pickup grounds
      { id: 'w-n-gnd', fromComponentId: 'pu-neck', fromTerminalId: 'ground', toComponentId: 'pot-blend', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-b-gnd', fromComponentId: 'pu-bridge', fromTerminalId: 'ground', toComponentId: 'pot-blend', toTerminalId: 'case-ground', color: '#18181b' },

      // Volume & Tone
      { id: 'w-vol-wiper-jack', fromComponentId: 'pot-vol', fromTerminalId: 'lug-2', toComponentId: 'jack-out', toTerminalId: 'tip', color: '#ef4444' },
      { id: 'w-vol-l1-gnd', fromComponentId: 'pot-vol', fromTerminalId: 'lug-1', toComponentId: 'pot-vol', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-vol-to-tone', fromComponentId: 'pot-vol', fromTerminalId: 'lug-3', toComponentId: 'pot-tone', toTerminalId: 'lug-3', color: '#eab308' },
      { id: 'w-tone-wiper-cap', fromComponentId: 'pot-tone', fromTerminalId: 'lug-2', toComponentId: 'cap-tone', toTerminalId: 'lead-1', color: '#eab308' },
      { id: 'w-cap-gnd', fromComponentId: 'cap-tone', fromTerminalId: 'lead-2', toComponentId: 'pot-tone', toTerminalId: 'case-ground', color: '#18181b' },

      // Ground bus
      { id: 'w-blend-to-vol-gnd', fromComponentId: 'pot-blend', fromTerminalId: 'case-ground', toComponentId: 'pot-vol', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-vol-to-tone-gnd', fromComponentId: 'pot-vol', fromTerminalId: 'case-ground', toComponentId: 'pot-tone', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-vol-to-jack-gnd', fromComponentId: 'pot-vol', fromTerminalId: 'case-ground', toComponentId: 'jack-out', toTerminalId: 'sleeve', color: '#18181b' },
    ],
    instructions: [
      'Use a specialized M/N balance/blend pot with a center click detent.',
      'At center (50%), both wipers are at full 0Ω resistance (100% output on both pickups without insertion loss).',
      'Turning clockwise attenuates the Neck pickup while keeping Bridge at 100%.',
      'Turning counter-clockwise attenuates the Bridge pickup while keeping Neck at 100%.',
    ],
    billOfMaterials: [
      { item: 'Bourns / CTS 250k M/N Blend / Balance Potentiometer', qty: 1, specs: 'Center click detent' },
      { item: 'CTS 250k Audio Taper Potentiometers', qty: 2, specs: 'Master Vol & Tone' },
      { item: '0.047µF Tone Capacitor', qty: 1, specs: 'Orange Drop 715P' },
      { item: 'Switchcraft 1/4" Mono Phone Jack', qty: 1, specs: '#11' },
    ],
  },
  {
    id: 'treble-bleed-mod',
    name: 'Treble Bleed Mod (Kinman / Duncan Volume Circuit)',
    category: 'Custom / Mods',
    description: 'Prevents the loss of high-end sparkle when rolling down the guitar volume knob. Adds a parallel 1000pF capacitor and 150kΩ resistor across Volume Lugs 2 & 3.',
    tags: ['Treble Bleed', 'Kinman Mod', 'Clarity', 'Volume Taper'],
    components: [
      {
        id: 'pu-bridge',
        type: 'pickup-singlecoil',
        name: 'Single Coil Pickup',
        x: 60,
        y: 120,
        properties: { pickupPosition: 'bridge', dcResistanceK: 6.5, inductanceH: 2.8 },
      },
      {
        id: 'pot-vol',
        type: 'pot-standard',
        name: 'Volume Pot (250k)',
        x: 280,
        y: 100,
        properties: { resistanceK: 250, taper: 'audio', currentValue: 0.65 },
      },
      {
        id: 'cap-bleed',
        type: 'capacitor',
        name: '1000pF Silver Mica Cap',
        x: 280,
        y: 250,
        properties: { capacitanceUf: 0.001, capType: 'ceramic-disc' },
      },
      {
        id: 'res-bleed',
        type: 'resistor',
        name: '150kΩ 1/4W Metal Film Resistor',
        x: 280,
        y: 330,
        properties: { resistanceOhms: 150000 },
      },
      {
        id: 'jack-out',
        type: 'output-jack',
        name: '1/4" Mono Output Jack',
        x: 520,
        y: 100,
        properties: { jackType: 'mono' },
      },
    ],
    wires: [
      { id: 'w-pu-hot', fromComponentId: 'pu-bridge', fromTerminalId: 'hot', toComponentId: 'pot-vol', toTerminalId: 'lug-3', color: '#eab308' },
      { id: 'w-pu-gnd', fromComponentId: 'pu-bridge', fromTerminalId: 'ground', toComponentId: 'pot-vol', toTerminalId: 'case-ground', color: '#18181b' },
      { id: 'w-vol-l1-gnd', fromComponentId: 'pot-vol', fromTerminalId: 'lug-1', toComponentId: 'pot-vol', toTerminalId: 'case-ground', color: '#18181b' },

      // Treble bleed network in parallel across Volume Lug 2 & 3
      { id: 'w-cap-l3', fromComponentId: 'pot-vol', fromTerminalId: 'lug-3', toComponentId: 'cap-bleed', toTerminalId: 'lead-1', color: '#3b82f6' },
      { id: 'w-cap-l2', fromComponentId: 'pot-vol', fromTerminalId: 'lug-2', toComponentId: 'cap-bleed', toTerminalId: 'lead-2', color: '#3b82f6' },
      { id: 'w-res-l3', fromComponentId: 'pot-vol', fromTerminalId: 'lug-3', toComponentId: 'res-bleed', toTerminalId: 'lead-1', color: '#22c55e' },
      { id: 'w-res-l2', fromComponentId: 'pot-vol', fromTerminalId: 'lug-2', toComponentId: 'res-bleed', toTerminalId: 'lead-2', color: '#22c55e' },

      // Volume wiper to Jack
      { id: 'w-vol-wiper-jack', fromComponentId: 'pot-vol', fromTerminalId: 'lug-2', toComponentId: 'jack-out', toTerminalId: 'tip', color: '#ef4444' },
      { id: 'w-vol-gnd-jack', fromComponentId: 'pot-vol', fromTerminalId: 'case-ground', toComponentId: 'jack-out', toTerminalId: 'sleeve', color: '#18181b' },
    ],
    instructions: [
      'Solder 1000pF capacitor and 150kΩ resistor in parallel.',
      'Solder one end of the parallel combo to Volume Lug 3 (input).',
      'Solder the other end to Volume Lug 2 (wiper).',
      'Test by dialing volume knob to 6 or 7: notice that clean chimes and sparkle remain crisp rather than becoming muffled!',
    ],
    billOfMaterials: [
      { item: '1000pF (1nF) Ceramic or Silver Mica Capacitor', qty: 1, specs: '500V' },
      { item: '150kΩ 1/4 Watt Metal Film Resistor (1% tolerance)', qty: 1, specs: 'Low noise' },
      { item: 'CTS 250k or 500k Audio Taper Pot', qty: 1, specs: 'Standard guitar pot' },
    ],
  },
];
