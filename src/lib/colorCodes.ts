import { PickupBrandStandard } from '../types/guitar';

export interface WireColorMapping {
  northStart: string;
  northFinish: string;
  southFinish: string;
  southStart: string;
  shield: string;
  seriesLink: string;
}

export const PICKUP_COLOR_CODES: Record<PickupBrandStandard, {
  brand: string;
  description: string;
  hotLead: string;
  groundLead: string;
  seriesLink: string;
  mapping: WireColorMapping;
}> = {
  'seymour-duncan': {
    brand: 'Seymour Duncan',
    description: 'Industry standard for aftermarket pickups. Black is hot, Green is ground, Red & White soldered together for standard series.',
    hotLead: 'Black (North Start)',
    groundLead: 'Green (South Start) + Bare Shield',
    seriesLink: 'Red + White',
    mapping: {
      northStart: '#18181b', // Black
      northFinish: '#f8fafc', // White
      southFinish: '#ef4444', // Red
      southStart: '#22c55e', // Green
      shield: '#94a3b8',     // Silver / Bare
      seriesLink: 'Red + White',
    },
  },
  'gibson': {
    brand: 'Gibson (4-Conductor)',
    description: 'Gibson factory 4-conductor. Red is hot, Black & Bare to ground, White & Green soldered together for series.',
    hotLead: 'Red (North Start)',
    groundLead: 'Black (South Start) + Bare Shield',
    seriesLink: 'White + Green',
    mapping: {
      northStart: '#ef4444', // Red
      northFinish: '#f8fafc', // White
      southFinish: '#22c55e', // Green
      southStart: '#18181b', // Black
      shield: '#94a3b8',
      seriesLink: 'White + Green',
    },
  },
  'fender': {
    brand: 'Fender Modern (4-Conductor)',
    description: 'Fender humbuckers (Enforcer, Shawbucker, Atomic). Green is hot, Black & Bare to ground, Red & White soldered together.',
    hotLead: 'Green (North Start)',
    groundLead: 'Black (South Start) + Bare Shield',
    seriesLink: 'Red + White',
    mapping: {
      northStart: '#22c55e', // Green
      northFinish: '#ef4444', // Red
      southFinish: '#f8fafc', // White
      southStart: '#18181b', // Black
      shield: '#94a3b8',
      seriesLink: 'Red + White',
    },
  },
  'dimarzio': {
    brand: 'DiMarzio',
    description: 'DiMarzio standard. Red is hot, Green & Bare to ground, Black & White soldered together for standard series.',
    hotLead: 'Red (North Start)',
    groundLead: 'Green (South Start) + Bare Shield',
    seriesLink: 'Black + White',
    mapping: {
      northStart: '#ef4444', // Red
      northFinish: '#18181b', // Black
      southFinish: '#f8fafc', // White
      southStart: '#22c55e', // Green
      shield: '#94a3b8',
      seriesLink: 'Black + White',
    },
  },
};

export interface WireColorOption {
  color: string;
  label: string;
  name: string;
  description: string;
  isDark?: boolean;
}

export const WIRE_COLOR_OPTIONS: WireColorOption[] = [
  { color: '#eab308', label: 'Vintage Cloth Yellow', name: 'Cloth Yellow', description: 'Classic push-back vintage signal wire' },
  { color: '#18181b', label: 'Ground Black', name: 'Ground Black', description: 'Chassis ground, pot casing, bridge ground', isDark: true },
  { color: '#ef4444', label: 'Signal Hot Red', name: 'Hot Red', description: 'Hot signal lead, output jack tip' },
  { color: '#22c55e', label: 'Green / Coil Tap', name: 'Green Coil', description: 'Coil tap, pickup start/finish, series link' },
  { color: '#f8fafc', label: 'White / Neutral', name: 'White', description: 'Pickup coil neutral, switch link' },
  { color: '#3b82f6', label: 'Blue / Series Link', name: 'Blue Series', description: 'Phase reverse, push-pull series bypass' },
  { color: '#94a3b8', label: 'Braided Shield Silver', name: 'Braided Shield', description: 'Braided metal shielding ground' },
  { color: '#ec4899', label: 'Pink / Violet Mod', name: 'Pink / Mod', description: 'Custom mods, coil splitting, blower switch' },
  { color: '#f97316', label: 'Amber Orange', name: 'Orange Drop', description: 'Tone capacitor lead, treble bleed network' },
  { color: '#a855f7', label: 'Purple Mod', name: 'Purple Mod', description: 'Custom onboard boost or selector routing' },
];

export function getWireColorLabel(color: string): string {
  const match = WIRE_COLOR_OPTIONS.find((c) => c.color.toLowerCase() === color.toLowerCase());
  return match ? match.label : `Custom (${color})`;
}
