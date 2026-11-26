import { CircuitComponent, CircuitState, ComponentType, PotTaper } from '../types/guitar';

export const AMP_INPUT_RESISTANCE_OHMS = 1_000_000;
export const CABLE_CAPACITANCE_PF = 450;
export const STRAY_CAPACITANCE_PF = 40;
export const TOTAL_EXTERNAL_CAP_F = (CABLE_CAPACITANCE_PF + STRAY_CAPACITANCE_PF) * 1e-12;

/**
 * Minimum resistance below which a resistor is treated as a dead-short jumper
 * for direct short-circuit detection between Jack Tip and Jack Sleeve.
 */
export const SHORT_RESISTOR_THRESHOLD_OHMS = 100;

const R_MIN_POT_OHMS = 1.0;
const G_MIN_SIEMENS = 1e-12; // Standard SPICE GMIN to keep floating nets non-singular

export interface CoilModel {
  id: string;
  pickupId: string;
  pickupName: string;
  pickupType: ComponentType;
  pickupPosition?: 'neck' | 'middle' | 'bridge';
  bobbin: 'single' | 'north' | 'south';
  posTerm: string;
  negTerm: string;
  dcResistanceK: number;
  inductanceH: number;
  capacitancePf: number;
  eddyResistanceOhms: number; // Infinity for no cover/baseplate loss
  baseEmf: number; // Relative open-circuit string EMF
  magneticPolarity: 'North' | 'South';
  /** Electrical phase when posTerm is positive relative to negTerm */
  normalElectricalPhase: 'In-Phase' | 'Reverse-Phase';
  /** String vibration sign (+1 or -1) when posTerm is positive relative to negTerm */
  normalStringSign: 1 | -1;
}

export interface ComplexVal {
  re: number;
  im: number;
}

export interface MNASolveOptions {
  /** Override all standard/pushpull/stacked pot values (0..1) */
  potValueOverride?: number;
  /** Override specific pot IDs to custom values */
  potValueOverrides?: Map<string, number>;
  /** Exclude specific coil IDs (open-circuit them) for series/parallel coupling tests */
  openCoilIds?: Set<string>;
  /** Exclude all pickup coils (used when measuring external load admittance) */
  excludeAllCoils?: boolean;
  /** Include 1M amp input & 490pF cable+stray capacitance at jack (default: true) */
  includeExternalLoad?: boolean;
  /** Exclude cable/stray capacitance (default: false) */
  excludeCableCap?: boolean;
  /**
   * Strip passive shunt/track networks for topology probing:
   * removes pot resistive tracks, resistors (>= SHORT_RESISTOR_THRESHOLD_OHMS),
   * and capacitors while keeping wires, closed switch contacts, and pot
   * wiper-to-end-lug pass-through contacts (independent of live knob positions).
   */
  stripPassiveNetworks?: boolean;
  /**
   * Strip pot resistive tracks (keeping wiper-to-end-lug pass-through contacts)
   * while retaining resistors and capacitors (fallback when a series cap or
   * series resistor is required in the signal path).
   */
  stripPotTracks?: boolean;
}

export interface MNASweepResult {
  isDirectShort: boolean;
  coils: CoilModel[];
  freqs: number[];
  /**
   * Complex voltage transfer H_k(f) = V_tip(f) / E_k for unit EMF on coil k.
   * Indexed as transfers[coilIndex][freqIndex].
   */
  transfers: ComplexVal[][];
  /** Node-to-net root mapping for the ideal-wire netlist */
  jackTipTerm: string;
  jackSleeveTerm: string;
}

class UnionFind {
  private parent = new Map<string, string>();

  find(x: string): string {
    let root = x;
    while (this.parent.has(root) && this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    let curr = x;
    while (curr !== root) {
      const next = this.parent.get(curr)!;
      this.parent.set(curr, root);
      curr = next;
    }
    if (!this.parent.has(root)) {
      this.parent.set(root, root);
    }
    return root;
  }

  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) {
      this.parent.set(ra, rb);
    }
  }
}

/**
 * Maps knob rotation [0..1] to normalized wiper position [0..1] along the resistive track.
 */
export function getPotTaperFraction(val: number, taper: PotTaper | string = 'audio'): number {
  const v = Math.max(0, Math.min(1, val));
  if (taper === 'audio') {
    return Math.pow(v, 2.5);
  }
  if (taper === 'reverse-audio') {
    return 1 - Math.pow(1 - v, 2.5);
  }
  return v;
}

/**
 * Adds ideal 0-ohm closed switch / ground-lug internal connections.
 * Never merges across potentiometers, capacitors, or normal resistors.
 */
export function addSwitchAndGroundEdges(
  comp: CircuitComponent,
  addEdge: (a: string, b: string) => void
) {
  const cid = comp.id;

  switch (comp.type) {
    case 'ground-lug': {
      addEdge(`${cid}:gnd-1`, `${cid}:gnd-2`);
      addEdge(`${cid}:gnd-2`, `${cid}:gnd-3`);
      addEdge(`${cid}:gnd-3`, `${cid}:gnd-bridge`);
      break;
    }

    case 'pot-pushpull': {
      const isPulled = !!comp.properties.pulledUp;
      if (isPulled) {
        addEdge(`${cid}:sw-c1`, `${cid}:sw-2`);
        addEdge(`${cid}:sw-c2`, `${cid}:sw-4`);
      } else {
        addEdge(`${cid}:sw-c1`, `${cid}:sw-1`);
        addEdge(`${cid}:sw-c2`, `${cid}:sw-3`);
      }
      break;
    }

    case 'switch-3way-toggle': {
      const pos = comp.properties.switchPosition ?? 1; // 0=Bridge, 1=Both, 2=Neck
      if (pos === 0 || pos === 1) addEdge(`${cid}:sw-bridge`, `${cid}:sw-output`);
      if (pos === 2 || pos === 1) addEdge(`${cid}:sw-neck`, `${cid}:sw-output`);
      break;
    }

    case 'switch-5way-blade': {
      const pos = comp.properties.switchPosition ?? 0;
      if (pos === 0) {
        addEdge(`${cid}:p1-c`, `${cid}:p1-1`);
        addEdge(`${cid}:p2-c`, `${cid}:p2-1`);
      } else if (pos === 1) {
        addEdge(`${cid}:p1-c`, `${cid}:p1-1`);
        addEdge(`${cid}:p1-c`, `${cid}:p1-2`);
        addEdge(`${cid}:p2-c`, `${cid}:p2-1`);
        addEdge(`${cid}:p2-c`, `${cid}:p2-2`);
      } else if (pos === 2) {
        addEdge(`${cid}:p1-c`, `${cid}:p1-2`);
        addEdge(`${cid}:p2-c`, `${cid}:p2-2`);
      } else if (pos === 3) {
        addEdge(`${cid}:p1-c`, `${cid}:p1-2`);
        addEdge(`${cid}:p1-c`, `${cid}:p1-3`);
        addEdge(`${cid}:p2-c`, `${cid}:p2-2`);
        addEdge(`${cid}:p2-c`, `${cid}:p2-3`);
      } else if (pos === 4) {
        addEdge(`${cid}:p1-c`, `${cid}:p1-3`);
        addEdge(`${cid}:p2-c`, `${cid}:p2-3`);
      }
      break;
    }

    case 'switch-3way-blade': {
      const pos = comp.properties.switchPosition ?? 0;
      if (pos === 0) {
        addEdge(`${cid}:p1-c`, `${cid}:p1-1`);
        addEdge(`${cid}:p2-c`, `${cid}:p2-1`);
      } else if (pos === 1) {
        addEdge(`${cid}:p1-c`, `${cid}:p1-1`);
        addEdge(`${cid}:p1-c`, `${cid}:p1-3`);
        addEdge(`${cid}:p2-c`, `${cid}:p2-1`);
        addEdge(`${cid}:p2-c`, `${cid}:p2-3`);
      } else if (pos === 2) {
        addEdge(`${cid}:p1-c`, `${cid}:p1-3`);
        addEdge(`${cid}:p2-c`, `${cid}:p2-3`);
      }
      break;
    }

    case 'switch-4way-blade': {
      const pos = comp.properties.switchPosition ?? 0;
      addEdge(`${cid}:p1-c`, `${cid}:p1-${pos + 1}`);
      addEdge(`${cid}:p2-c`, `${cid}:p2-${pos + 1}`);
      break;
    }

    case 'switch-superswitch': {
      const pos = comp.properties.switchPosition ?? 0;
      const throwNum = pos + 1;
      addEdge(`${cid}:pa-c`, `${cid}:pa-${throwNum}`);
      addEdge(`${cid}:pb-c`, `${cid}:pb-${throwNum}`);
      addEdge(`${cid}:pc-c`, `${cid}:pc-${throwNum}`);
      addEdge(`${cid}:pd-c`, `${cid}:pd-${throwNum}`);
      break;
    }

    case 'switch-dpdt-minitoggle': {
      const pos = comp.properties.switchPosition ?? 0;
      if (pos === 0) {
        addEdge(`${cid}:sw-c1`, `${cid}:sw-2`);
        addEdge(`${cid}:sw-c2`, `${cid}:sw-4`);
      } else {
        addEdge(`${cid}:sw-c1`, `${cid}:sw-1`);
        addEdge(`${cid}:sw-c2`, `${cid}:sw-3`);
      }
      break;
    }
  }
}

/**
 * Extracts individual electrical coil models from all pickups in the circuit.
 */
export function extractCoilModels(components: CircuitComponent[]): CoilModel[] {
  const coils: CoilModel[] = [];

  for (const comp of components) {
    const cid = comp.id;

    if (comp.type === 'pickup-humbucker') {
      const isFlipped = !!comp.properties.magnetFlipped;
      const rK = comp.properties.dcResistanceK ?? 8.4;
      const indH = comp.properties.inductanceH ?? 4.2;
      const baseCapPf = comp.properties.capacitancePf ?? 145;
      // Per-bobbin self-capacitance (yields ~145pF effective in series/parallel with cavity stray)
      const bobbinCapPf = Math.max(40, baseCapPf * 0.65);

      const northMag: 'North' | 'South' = isFlipped ? 'South' : 'North';
      const southMag: 'North' | 'South' = isFlipped ? 'North' : 'South';

      // North Slug Coil: pos = north-start, neg = north-finish
      // Standard winding: In-Phase when north-start is positive; string sign = (+1 if North else -1) * (+1)
      coils.push({
        id: `${cid}:north`,
        pickupId: cid,
        pickupName: comp.name,
        pickupType: comp.type,
        pickupPosition: comp.properties.pickupPosition,
        bobbin: 'north',
        posTerm: `${cid}:north-start`,
        negTerm: `${cid}:north-finish`,
        dcResistanceK: rK / 2,
        inductanceH: indH / 2,
        capacitancePf: bobbinCapPf,
        eddyResistanceOhms: 600_000, // ~15% humbucker cover/baseplate eddy damping
        baseEmf: 0.79, // 2 series bobbins = 1.58 (+4.0 dB), 1 split bobbin = 0.79 (-2.0 dB)
        magneticPolarity: northMag,
        normalElectricalPhase: 'In-Phase',
        normalStringSign: northMag === 'North' ? 1 : -1,
      });

      // South Screw Coil: pos = south-finish, neg = south-start
      // Reverse-wound relative to North, opposite magnet -> additive string signal in series!
      coils.push({
        id: `${cid}:south`,
        pickupId: cid,
        pickupName: comp.name,
        pickupType: comp.type,
        pickupPosition: comp.properties.pickupPosition,
        bobbin: 'south',
        posTerm: `${cid}:south-finish`,
        negTerm: `${cid}:south-start`,
        dcResistanceK: rK / 2,
        inductanceH: indH / 2,
        capacitancePf: bobbinCapPf,
        eddyResistanceOhms: 600_000,
        baseEmf: 0.79,
        magneticPolarity: southMag,
        normalElectricalPhase: 'Reverse-Phase',
        normalStringSign: southMag === 'South' ? 1 : -1,
      });
    } else if (
      comp.type === 'pickup-singlecoil' ||
      comp.type === 'pickup-p90' ||
      comp.type === 'pickup-tele-bridge' ||
      comp.type === 'pickup-tele-neck'
    ) {
      const isRwrp = comp.type === 'pickup-tele-neck' ? false : !!comp.properties.rwrp;
      const defaultR = comp.type === 'pickup-tele-neck' ? 7.4 : 6.2;
      const defaultL = comp.type === 'pickup-tele-neck' ? 2.6 : 2.8;
      const defaultCap =
        comp.type === 'pickup-singlecoil'
          ? 95
          : comp.type === 'pickup-tele-neck'
          ? 120
          : comp.type === 'pickup-tele-bridge'
          ? 105
          : 130;

      const eddyOhms =
        comp.type === 'pickup-singlecoil'
          ? Infinity
          : comp.type === 'pickup-tele-neck'
          ? 180_000 // Chrome-plated brass cover eddy current damping
          : comp.type === 'pickup-tele-bridge'
          ? 650_000 // Steel/copper baseplate damping
          : 800_000; // P-90

      const mag: 'North' | 'South' = isRwrp ? 'South' : 'North';
      const normalElec: 'In-Phase' | 'Reverse-Phase' = isRwrp ? 'Reverse-Phase' : 'In-Phase';
      // Both normal (N, In-Phase) and RWRP (S, Reverse-Phase) produce +1 string signal when hot->tip, gnd->sleeve
      coils.push({
        id: `${cid}:single`,
        pickupId: cid,
        pickupName: comp.name,
        pickupType: comp.type,
        pickupPosition: comp.properties.pickupPosition,
        bobbin: 'single',
        posTerm: `${cid}:hot`,
        negTerm: `${cid}:ground`,
        dcResistanceK: comp.properties.dcResistanceK ?? defaultR,
        inductanceH: comp.properties.inductanceH ?? defaultL,
        capacitancePf: comp.properties.capacitancePf ?? defaultCap,
        eddyResistanceOhms: eddyOhms,
        baseEmf: 1.0,
        magneticPolarity: mag,
        normalElectricalPhase: normalElec,
        normalStringSign: 1,
      });
    }
  }

  return coils;
}

/**
 * Checks whether Jack Tip and Jack Sleeve have a true galvanic short circuit
 * (wires, closed switches, ground-lugs, or near-zero resistors < 100 Ohm).
 * Potentiometers (even at 0) and capacitors are NOT treated as wiring shorts.
 */
export function checkDirectShortCircuit(state: CircuitState): boolean {
  const jack = state.components.find((c) => c.type === 'output-jack');
  if (!jack) return false;

  const uf = new UnionFind();
  for (const w of state.wires) {
    uf.union(`${w.fromComponentId}:${w.fromTerminalId}`, `${w.toComponentId}:${w.toTerminalId}`);
  }
  for (const comp of state.components) {
    addSwitchAndGroundEdges(comp, (a, b) => uf.union(a, b));
    if (comp.type === 'resistor') {
      const rOhms = comp.properties.resistanceOhms ?? 150000;
      if (rOhms < SHORT_RESISTOR_THRESHOLD_OHMS) {
        uf.union(`${comp.id}:lead-1`, `${comp.id}:lead-2`);
      }
    }
  }

  return uf.find(`${jack.id}:tip`) === uf.find(`${jack.id}:sleeve`);
}

interface BuiltNetlist {
  isDirectShort: boolean;
  jackTipTerm: string;
  jackSleeveTerm: string;
  tipNodeIdx: number; // -1 if grounded
  numNodes: number; // number of non-ground nodes
  coils: CoilModel[];
  /** Maps terminal key -> node index (-1 for ground, 0..numNodes-1 for non-ground) */
  getNodeIdx: (termKey: string) => number;
  /** Pre-extracted passive branches to stamp quickly at each frequency */
  resistorBranches: { n1: number; n2: number; g: number }[];
  capBranches: { n1: number; n2: number; c: number }[];
  coilBranches: {
    coilIdx: number;
    nPos: number;
    nNeg: number;
    rOhms: number;
    indH: number;
    capF: number;
    gEddy: number;
  }[];
}

/**
 * Builds the reduced electrical netlist for MNA solving.
 * Ideal wires, closed switch contacts, and ground lugs are collapsed into single nets.
 */
function buildNetlist(state: CircuitState, options: MNASolveOptions = {}): BuiltNetlist | null {
  const { components, wires } = state;
  const jack = components.find((c) => c.type === 'output-jack');
  if (!jack) return null;

  const jackTipTerm = `${jack.id}:tip`;
  const jackSleeveTerm = `${jack.id}:sleeve`;

  const isDirectShort = checkDirectShortCircuit(state);

  // Track which terminals actually have external wires connected
  const wiredTerms = new Set<string>();
  const uf = new UnionFind();
  for (const w of wires) {
    const k1 = `${w.fromComponentId}:${w.fromTerminalId}`;
    const k2 = `${w.toComponentId}:${w.toTerminalId}`;
    wiredTerms.add(k1);
    wiredTerms.add(k2);
    uf.union(k1, k2);
  }

  for (const comp of components) {
    addSwitchAndGroundEdges(comp, (a, b) => uf.union(a, b));
  }

  const gndRoot = uf.find(jackSleeveTerm);

  // Collect nets connected to capacitor leads to identify 2-lug tone rheostats accurately
  const capConnectedRoots = new Set<string>();
  for (const comp of components) {
    if (comp.type === 'capacitor') {
      capConnectedRoots.add(uf.find(`${comp.id}:lead-1`));
      capConnectedRoots.add(uf.find(`${comp.id}:lead-2`));
    }
  }

  // Assign integer node indices dynamically on demand
  const rootToIdx = new Map<string, number>();
  rootToIdx.set(gndRoot, -1);
  let nextIdx = 0;

  const getNodeIdx = (termKey: string): number => {
    const root = uf.find(termKey);
    const existing = rootToIdx.get(root);
    if (existing !== undefined) return existing;
    const idx = nextIdx++;
    rootToIdx.set(root, idx);
    return idx;
  };

  const tipNodeIdx = getNodeIdx(jackTipTerm);

  const resistorBranches: { n1: number; n2: number; g: number }[] = [];
  const capBranches: { n1: number; n2: number; c: number }[] = [];
  const coilBranches: BuiltNetlist['coilBranches'] = [];

  const addRes = (termA: string, termB: string, rOhms: number) => {
    const n1 = getNodeIdx(termA);
    const n2 = getNodeIdx(termB);
    if (n1 === n2) return;
    resistorBranches.push({ n1, n2, g: 1 / Math.max(0.5, rOhms) });
  };

  const addCap = (termA: string, termB: string, capF: number) => {
    const n1 = getNodeIdx(termA);
    const n2 = getNodeIdx(termB);
    if (n1 === n2 || capF <= 0) return;
    capBranches.push({ n1, n2, c: capF });
  };

  // External amp input resistance & cable+stray capacitance at output jack
  if (options.includeExternalLoad !== false) {
    addRes(jackTipTerm, jackSleeveTerm, AMP_INPUT_RESISTANCE_OHMS);
    if (!options.excludeCableCap) {
      addCap(jackTipTerm, jackSleeveTerm, TOTAL_EXTERNAL_CAP_F);
    }
  }

  const stripPassive = !!options.stripPassiveNetworks;
  const stripTracks = stripPassive || !!options.stripPotTracks;

  // Helper to stamp a standard 3-lug potentiometer gang
  const stampPotGang = (
    comp: CircuitComponent,
    lug1: string,
    lug2: string,
    lug3: string,
    rK: number,
    rawVal: number,
    taper: PotTaper | string
  ) => {
    const rPot = Math.max(100, rK * 1000);
    const l1Wired = wiredTerms.has(lug1);
    const l2Wired = wiredTerms.has(lug2);
    const l3Wired = wiredTerms.has(lug3);
    if (!l2Wired && !(l1Wired && l3Wired)) return;

    if (stripTracks) {
      // For topology probing: keep only the wiper-to-end-lug pass-through contact
      // and remove resistive tracks so pot tracks across a coil cannot mask series wiring
      // and knob positions do not affect topology classification.
      if (l1Wired && l2Wired && l3Wired) {
        const r1 = uf.find(lug1);
        const r3 = uf.find(lug3);
        if (r3 === gndRoot && r1 !== gndRoot) {
          addRes(lug1, lug2, R_MIN_POT_OHMS);
        } else {
          addRes(lug2, lug3, R_MIN_POT_OHMS);
        }
        return;
      }

      if (!l1Wired && l2Wired && l3Wired) {
        const r2 = uf.find(lug2);
        const r3 = uf.find(lug3);
        const isShuntOrTone =
          r2 === gndRoot ||
          r3 === gndRoot ||
          capConnectedRoots.has(r2) ||
          capConnectedRoots.has(r3);
        if (!isShuntOrTone) {
          addRes(lug2, lug3, R_MIN_POT_OHMS);
        }
        return;
      }

      // 2-lug shunt/tone rheostat on lugs 1 & 2, or fixed track on lugs 1 & 3: omit
      return;
    }

    const effVal =
      options.potValueOverrides?.has(comp.id)
        ? options.potValueOverrides.get(comp.id)!
        : options.potValueOverride !== undefined
        ? options.potValueOverride
        : rawVal;

    const alpha = getPotTaperFraction(effVal, taper);

    // Detect 2-lug shunt/tone rheostat wired on lugs 2 & 3 (with lug-1 unwired),
    // which is the convention used by ToneSmith's Strat, Les Paul 50s, Jimmy Page, and Tele presets:
    // at currentValue = 1.0 (Tone 10), resistance is max (bright/open); at 0.0 (Tone 0), resistance is min (dark/shunted).
    if (!l1Wired && l2Wired && l3Wired) {
      const r2 = uf.find(lug2);
      const r3 = uf.find(lug3);
      const isShuntOrTone =
        r2 === gndRoot ||
        r3 === gndRoot ||
        capConnectedRoots.has(r2) ||
        capConnectedRoots.has(r3);

      const r23 = isShuntOrTone
        ? Math.max(R_MIN_POT_OHMS, alpha * rPot)
        : Math.max(R_MIN_POT_OHMS, (1 - alpha) * rPot);
      addRes(lug2, lug3, r23);
      return;
    }

    // Standard 3-lug pot (or 2-lug on lugs 1 & 2):
    // CCW (val=0) => wiper at lug-1 (R12 ~ 1 Ohm, R23 ~ Rpot)
    // CW  (val=1) => wiper at lug-3 (R12 ~ Rpot, R23 ~ 1 Ohm)
    const r12 = Math.max(R_MIN_POT_OHMS, alpha * rPot);
    const r23 = Math.max(R_MIN_POT_OHMS, (1 - alpha) * rPot);

    if (l1Wired && l2Wired) {
      addRes(lug1, lug2, r12);
    }
    if (l2Wired && l3Wired) {
      addRes(lug2, lug3, r23);
    }
    if (l1Wired && l3Wired && !l2Wired) {
      addRes(lug1, lug3, rPot);
    }
  };

  // Stamp passive components
  for (const comp of components) {
    const cid = comp.id;

    switch (comp.type) {
      case 'resistor': {
        const rOhms = comp.properties.resistanceOhms ?? 150000;
        if (stripPassive) {
          if (rOhms < SHORT_RESISTOR_THRESHOLD_OHMS) {
            addRes(`${cid}:lead-1`, `${cid}:lead-2`, Math.max(1, rOhms));
          }
          break;
        }
        addRes(`${cid}:lead-1`, `${cid}:lead-2`, Math.max(1, rOhms));
        break;
      }

      case 'capacitor': {
        if (stripPassive) {
          break;
        }
        const capUf = comp.properties.capacitanceUf ?? 0.022;
        addCap(`${cid}:lead-1`, `${cid}:lead-2`, Math.max(1e-9, capUf) * 1e-6);
        break;
      }

      case 'pot-standard':
      case 'pot-pushpull': {
        stampPotGang(
          comp,
          `${cid}:lug-1`,
          `${cid}:lug-2`,
          `${cid}:lug-3`,
          comp.properties.resistanceK ?? 500,
          comp.properties.currentValue ?? 1.0,
          comp.properties.taper ?? 'audio'
        );
        break;
      }

      case 'pot-stacked': {
        stampPotGang(
          comp,
          `${cid}:a-lug-1`,
          `${cid}:a-lug-2`,
          `${cid}:a-lug-3`,
          comp.properties.innerResistanceK ?? comp.properties.resistanceK ?? 500,
          comp.properties.innerValue ?? comp.properties.currentValue ?? 1.0,
          comp.properties.taper ?? 'audio'
        );
        stampPotGang(
          comp,
          `${cid}:b-lug-1`,
          `${cid}:b-lug-2`,
          `${cid}:b-lug-3`,
          comp.properties.outerResistanceK ?? comp.properties.resistanceK ?? 500,
          comp.properties.outerValue ?? comp.properties.currentValue ?? 1.0,
          comp.properties.taper ?? 'audio'
        );
        break;
      }

      case 'pot-blend': {
        if (stripTracks) {
          if (wiredTerms.has(`${cid}:a-in`) && wiredTerms.has(`${cid}:a-wiper`)) {
            addRes(`${cid}:a-in`, `${cid}:a-wiper`, R_MIN_POT_OHMS);
          }
          if (wiredTerms.has(`${cid}:b-in`) && wiredTerms.has(`${cid}:b-wiper`)) {
            addRes(`${cid}:b-in`, `${cid}:b-wiper`, R_MIN_POT_OHMS);
          }
          break;
        }

        const rPot = Math.max(100, (comp.properties.resistanceK ?? 250) * 1000);
        const blendVal =
          options.potValueOverrides?.has(comp.id)
            ? options.potValueOverrides.get(comp.id)!
            : comp.properties.blendValue ?? 0.5;
        const clamped = Math.max(0, Math.min(1, blendVal));

        // M/N center-detent blend pot:
        // At 0.5 (center): both A and B at 100% pass-through (0 Ohm series, Rpot shunt)
        // Turning < 0.5 attenuates B; turning > 0.5 attenuates A.
        // Shunting input-to-ground (while series R isolates wiper) prevents a muted gang
        // from shorting the shared wiper output bus!
        const valA = clamped <= 0.5 ? 1.0 : Math.max(0, 1 - (clamped - 0.5) * 2);
        const valB = clamped >= 0.5 ? 1.0 : Math.max(0, clamped * 2);
        const alphaA = Math.pow(valA, 2.0);
        const alphaB = Math.pow(valB, 2.0);

        const aGnd = wiredTerms.has(`${cid}:a-ground`) ? `${cid}:a-ground` : `${cid}:a-gnd`;
        const bGnd = wiredTerms.has(`${cid}:b-ground`) ? `${cid}:b-ground` : `${cid}:b-gnd`;

        if (wiredTerms.has(`${cid}:a-in`) && wiredTerms.has(`${cid}:a-wiper`)) {
          addRes(`${cid}:a-in`, `${cid}:a-wiper`, Math.max(R_MIN_POT_OHMS, (1 - alphaA) * rPot));
        }
        if (wiredTerms.has(`${cid}:a-in`) && wiredTerms.has(aGnd)) {
          addRes(`${cid}:a-in`, aGnd, Math.max(R_MIN_POT_OHMS, alphaA * rPot));
        }

        if (wiredTerms.has(`${cid}:b-in`) && wiredTerms.has(`${cid}:b-wiper`)) {
          addRes(`${cid}:b-in`, `${cid}:b-wiper`, Math.max(R_MIN_POT_OHMS, (1 - alphaB) * rPot));
        }
        if (wiredTerms.has(`${cid}:b-in`) && wiredTerms.has(bGnd)) {
          addRes(`${cid}:b-in`, bGnd, Math.max(R_MIN_POT_OHMS, alphaB * rPot));
        }
        break;
      }
    }
  }

  // Extract & register pickup coils
  const coils = extractCoilModels(components);
  if (!options.excludeAllCoils) {
    for (let i = 0; i < coils.length; i++) {
      const coil = coils[i];
      if (options.openCoilIds?.has(coil.id)) continue;
      const nPos = getNodeIdx(coil.posTerm);
      const nNeg = getNodeIdx(coil.negTerm);
      if (nPos === nNeg) continue;
      coilBranches.push({
        coilIdx: i,
        nPos,
        nNeg,
        rOhms: Math.max(10, coil.dcResistanceK * 1000),
        indH: Math.max(0.01, coil.inductanceH),
        capF: Math.max(0, coil.capacitancePf) * 1e-12,
        gEddy: isFinite(coil.eddyResistanceOhms) ? 1 / coil.eddyResistanceOhms : 0,
      });
    }
  }

  return {
    isDirectShort,
    jackTipTerm,
    jackSleeveTerm,
    tipNodeIdx,
    numNodes: nextIdx,
    coils,
    getNodeIdx,
    resistorBranches,
    capBranches,
    coilBranches,
  };
}

/**
 * Solves A * X = B for complex dense matrix A (N x N) and complex multi-RHS B (N x M)
 * using Gaussian elimination with partial pivoting. Solution is written in-place into B.
 */
function solveComplexLinearSystem(
  n: number,
  m: number,
  aRe: Float64Array,
  aIm: Float64Array,
  bRe: Float64Array,
  bIm: Float64Array
): boolean {
  for (let col = 0; col < n; col++) {
    // Partial pivoting: find row >= col with max |A[row, col]|^2
    let pivotRow = col;
    let maxMagSq = 0;
    for (let row = col; row < n; row++) {
      const idx = row * n + col;
      const re = aRe[idx];
      const im = aIm[idx];
      const magSq = re * re + im * im;
      if (magSq > maxMagSq) {
        maxMagSq = magSq;
        pivotRow = row;
      }
    }

    if (maxMagSq < 1e-36) {
      return false;
    }

    // Swap pivot row into position
    if (pivotRow !== col) {
      for (let k = col; k < n; k++) {
        const i1 = col * n + k;
        const i2 = pivotRow * n + k;
        let tmp = aRe[i1];
        aRe[i1] = aRe[i2];
        aRe[i2] = tmp;
        tmp = aIm[i1];
        aIm[i1] = aIm[i2];
        aIm[i2] = tmp;
      }
      for (let k = 0; k < m; k++) {
        const i1 = col * m + k;
        const i2 = pivotRow * m + k;
        let tmp = bRe[i1];
        bRe[i1] = bRe[i2];
        bRe[i2] = tmp;
        tmp = bIm[i1];
        bIm[i1] = bIm[i2];
        bIm[i2] = tmp;
      }
    }

    const pIdx = col * n + col;
    const pRe = aRe[pIdx];
    const pIm = aIm[pIdx];
    const pMagSq = pRe * pRe + pIm * pIm;
    const invPRe = pRe / pMagSq;
    const invPIm = -pIm / pMagSq;

    // Eliminate rows below pivot
    for (let row = col + 1; row < n; row++) {
      const rIdx = row * n + col;
      const cRe = aRe[rIdx];
      const cIm = aIm[rIdx];
      if (cRe === 0 && cIm === 0) continue;

      // factor = A[row, col] / A[col, col]
      const fRe = cRe * invPRe - cIm * invPIm;
      const fIm = cRe * invPIm + cIm * invPRe;

      aRe[rIdx] = 0;
      aIm[rIdx] = 0;

      for (let k = col + 1; k < n; k++) {
        const uIdx = col * n + k;
        const tIdx = row * n + k;
        const uRe = aRe[uIdx];
        const uIm = aIm[uIdx];
        aRe[tIdx] -= fRe * uRe - fIm * uIm;
        aIm[tIdx] -= fRe * uIm + fIm * uRe;
      }

      for (let k = 0; k < m; k++) {
        const uIdx = col * m + k;
        const tIdx = row * m + k;
        const uRe = bRe[uIdx];
        const uIm = bIm[uIdx];
        bRe[tIdx] -= fRe * uRe - fIm * uIm;
        bIm[tIdx] -= fRe * uIm + fIm * uRe;
      }
    }
  }

  // Back-substitution
  for (let row = n - 1; row >= 0; row--) {
    const pIdx = row * n + row;
    const pRe = aRe[pIdx];
    const pIm = aIm[pIdx];
    const pMagSq = pRe * pRe + pIm * pIm;
    const invPRe = pRe / pMagSq;
    const invPIm = -pIm / pMagSq;

    for (let rhs = 0; rhs < m; rhs++) {
      let sRe = bRe[row * m + rhs];
      let sIm = bIm[row * m + rhs];

      for (let k = row + 1; k < n; k++) {
        const aIdx = row * n + k;
        const xIdx = k * m + rhs;
        const ar = aRe[aIdx];
        const ai = aIm[aIdx];
        const xr = bRe[xIdx];
        const xi = bIm[xIdx];
        sRe -= ar * xr - ai * xi;
        sIm -= ar * xi + ai * xr;
      }

      bRe[row * m + rhs] = sRe * invPRe - sIm * invPIm;
      bIm[row * m + rhs] = sRe * invPIm + sIm * invPRe;
    }
  }

  return true;
}

/**
 * Stamps admittance (g + j*b) between nodes n1 and n2 (where -1 = reference ground).
 */
function stampAdmittance(
  n: number,
  yRe: Float64Array,
  yIm: Float64Array,
  n1: number,
  n2: number,
  g: number,
  b: number
) {
  if (n1 >= 0) {
    const ii = n1 * n + n1;
    yRe[ii] += g;
    yIm[ii] += b;
  }
  if (n2 >= 0) {
    const jj = n2 * n + n2;
    yRe[jj] += g;
    yIm[jj] += b;
  }
  if (n1 >= 0 && n2 >= 0) {
    const ij = n1 * n + n2;
    const ji = n2 * n + n1;
    yRe[ij] -= g;
    yIm[ij] -= b;
    yRe[ji] -= g;
    yIm[ji] -= b;
  }
}

/**
 * Runs AC Modified Nodal Analysis across a list of frequencies.
 * Computes the exact complex transfer function H_k(f) = V_tip(f) / E_k for EVERY pickup coil simultaneously.
 */
export function solveCircuitMNA(
  state: CircuitState,
  freqs: number[],
  options: MNASolveOptions = {}
): MNASweepResult | null {
  const net = buildNetlist(state, options);
  if (!net) return null;

  const numCoils = net.coils.length;
  const numFreqs = freqs.length;
  const transfers: ComplexVal[][] = Array.from({ length: numCoils }, () =>
    Array.from({ length: numFreqs }, () => ({ re: 0, im: 0 }))
  );

  if (net.isDirectShort || net.tipNodeIdx < 0 || net.numNodes === 0 || numCoils === 0) {
    return {
      isDirectShort: net.isDirectShort,
      coils: net.coils,
      freqs,
      transfers,
      jackTipTerm: net.jackTipTerm,
      jackSleeveTerm: net.jackSleeveTerm,
    };
  }

  const n = net.numNodes;
  const m = numCoils;
  const yRe = new Float64Array(n * n);
  const yIm = new Float64Array(n * n);
  const bRe = new Float64Array(n * m);
  const bIm = new Float64Array(n * m);

  for (let fi = 0; fi < numFreqs; fi++) {
    const omega = 2 * Math.PI * freqs[fi];
    yRe.fill(0);
    yIm.fill(0);
    bRe.fill(0);
    bIm.fill(0);

    // GMIN stabilization on diagonal
    for (let i = 0; i < n; i++) {
      yRe[i * n + i] = G_MIN_SIEMENS;
    }

    // Stamp resistors
    for (let i = 0; i < net.resistorBranches.length; i++) {
      const br = net.resistorBranches[i];
      stampAdmittance(n, yRe, yIm, br.n1, br.n2, br.g, 0);
    }

    // Stamp capacitors
    for (let i = 0; i < net.capBranches.length; i++) {
      const br = net.capBranches[i];
      stampAdmittance(n, yRe, yIm, br.n1, br.n2, 0, omega * br.c);
    }

    // Stamp pickup coils & Norton current sources
    for (let i = 0; i < net.coilBranches.length; i++) {
      const br = net.coilBranches[i];
      const wL = omega * br.indH;
      const denom = br.rOhms * br.rOhms + wL * wL;
      const gs = br.rOhms / denom;
      const bs = -wL / denom;

      // Total coil admittance = 1/(R + jwL) + 1/Reddy + jwCcoil
      stampAdmittance(n, yRe, yIm, br.nPos, br.nNeg, gs + br.gEddy, bs + omega * br.capF);

      // Unit EMF Norton source: +Ys into posTerm, -Ys into negTerm for column br.coilIdx
      const col = br.coilIdx;
      if (br.nPos >= 0) {
        bRe[br.nPos * m + col] += gs;
        bIm[br.nPos * m + col] += bs;
      }
      if (br.nNeg >= 0) {
        bRe[br.nNeg * m + col] -= gs;
        bIm[br.nNeg * m + col] -= bs;
      }
    }

    const ok = solveComplexLinearSystem(n, m, yRe, yIm, bRe, bIm);
    if (ok) {
      const tipOffset = net.tipNodeIdx * m;
      for (let ci = 0; ci < m; ci++) {
        transfers[ci][fi] = {
          re: bRe[tipOffset + ci],
          im: bIm[tipOffset + ci],
        };
      }
    }
  }

  return {
    isDirectShort: net.isDirectShort,
    coils: net.coils,
    freqs,
    transfers,
    jackTipTerm: net.jackTipTerm,
    jackSleeveTerm: net.jackSleeveTerm,
  };
}

/**
 * Measures the exact effective parallel resistive AC load (in kOhm) seen by the active
 * pickup network at the given probe frequency (e.g. resonant frequency f0).
 * Removes all pickup coils and injects a 1A test current across the active pickup terminals
 * into the passive network (pots, load resistors, tone networks, series caps, 1M amp input).
 */
export function measureEffectiveLoadResistanceK(
  state: CircuitState,
  activeCoils: CoilModel[],
  probeFreqHz: number
): number {
  if (activeCoils.length === 0) return 1000;

  const net = buildNetlist(state, {
    excludeAllCoils: true,
    includeExternalLoad: true,
    excludeCableCap: true,
    potValueOverride: 1.0, // Measure nominal pot/resistor loading at open controls
  });
  if (!net || net.isDirectShort || net.numNodes === 0) return 1000;

  // Find the active hot terminal (the pickup terminal closest to the output / highest AC load visibility)
  // For a single coil or parallel coils, probe across the first active coil's hot terminal to ground
  // (or across the extreme terminals of a series chain).
  const n = net.numNodes;
  const omega = 2 * Math.PI * Math.max(100, probeFreqHz);

  const yRe = new Float64Array(n * n);
  const yIm = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    yRe[i * n + i] = G_MIN_SIEMENS;
  }
  for (const br of net.resistorBranches) {
    stampAdmittance(n, yRe, yIm, br.n1, br.n2, br.g, 0);
  }
  for (const br of net.capBranches) {
    stampAdmittance(n, yRe, yIm, br.n1, br.n2, 0, omega * br.c);
  }

  // Pick a non-ground terminal among the active coils (preferring one connected to the signal path)
  // Collect unique non-ground coil terminals
  const probeNodes: number[] = [];
  const seen = new Set<number>();
  for (const c of activeCoils) {
    const np = net.getNodeIdx(c.posTerm);
    const nn = net.getNodeIdx(c.negTerm);
    if (np >= 0 && !seen.has(np)) {
      seen.add(np);
      probeNodes.push(np);
    }
    if (nn >= 0 && !seen.has(nn)) {
      seen.add(nn);
      probeNodes.push(nn);
    }
  }
  if (probeNodes.length === 0) return 1000;

  const m = probeNodes.length;
  const bRe = new Float64Array(n * m);
  const bIm = new Float64Array(n * m);
  for (let k = 0; k < m; k++) {
    bRe[probeNodes[k] * m + k] = 1.0; // Inject 1A into probe node k
  }

  const ok = solveComplexLinearSystem(n, m, yRe, yIm, bRe, bIm);
  if (!ok) return 1000;

  // For each probed coil terminal, V_k = Z_in(k) = R_s + j*X_s.
  // Its equivalent parallel conductance is G_p = Re(1 / Z_in) = Re(Z) / |Z|^2.
  // Only consider terminals coupled to the jack tip (|V_tip| / |V_k| > 0.1) so shunted
  // internal coil-split junctions are not mistaken for the main pickup load bus.
  let bestLoadK = 1000;
  let maxConductance = 0;
  const tipIdx = net.tipNodeIdx;

  for (let k = 0; k < m; k++) {
    const nodeIdx = probeNodes[k];
    const zRe = bRe[nodeIdx * m + k];
    const zIm = bIm[nodeIdx * m + k];
    const magSq = zRe * zRe + zIm * zIm;
    if (magSq <= 1e-12) continue;

    if (tipIdx >= 0) {
      const tRe = bRe[tipIdx * m + k];
      const tIm = bIm[tipIdx * m + k];
      const tipMagSq = tRe * tRe + tIm * tIm;
      if (tipMagSq / magSq < 0.01) continue; // Not coupled to jack tip (e.g. coil-split junction)
    }

    const gParallel = zRe / magSq;
    if (gParallel > 1e-9 && gParallel > maxConductance) {
      maxConductance = gParallel;
      bestLoadK = 1 / (gParallel * 1000);
    }
  }

  return Math.max(0.1, Math.min(2000, bestLoadK));
}

/**
 * Generates a log-spaced array of frequencies from minFreq to maxFreq (inclusive).
 */
export function generateLogFreqGrid(minFreq: number, maxFreq: number, count: number): number[] {
  const logMin = Math.log10(minFreq);
  const logMax = Math.log10(maxFreq);
  const freqs: number[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const frac = count > 1 ? i / (count - 1) : 0;
    freqs[i] = Math.pow(10, logMin + frac * (logMax - logMin));
  }
  return freqs;
}
