import {
  ActiveCoilInfo,
  CircuitAnalysisResult,
  CircuitComponent,
  CircuitState,
  SignalPathInfo,
  SwitchingCombinationReportItem,
  SwitchingAnalysisReport,
  SwitchingControlDef,
  GroupedSwitchingCombinationItem,
  GroupedControlValue,
  SwitchingControlOption,
} from '../types/guitar';
import {
  CABLE_CAPACITANCE_PF,
  STRAY_CAPACITANCE_PF,
  SHORT_RESISTOR_THRESHOLD_OHMS,
  CoilModel,
  ComplexVal,
  MNASweepResult,
  addSwitchAndGroundEdges,
  checkDirectShortCircuit,
  generateLogFreqGrid,
  measureEffectiveLoadResistanceK,
  solveCircuitMNA,
} from './mnaSolver';

// 65 log-spaced frequencies across 40 Hz - 20 kHz for accurate Bode & peak analysis
const BODE_FREQS = generateLogFreqGrid(40, 20000, 65);
const REF_FREQS = [80, 150, 300, 600, 1200, 2500, 5000, 10000];
const TOPOLOGY_PROBE_FREQS = [150, 1200];
const POT_PROBE_FREQS = [200, 5000];
const HUM_PROBE_FREQS = [60, 180];

const COIL_ACTIVE_ABS_MIN = 0.025; // ~ -32 dB RMS across guitar band
const COIL_ACTIVE_REL_MIN = 0.18;  // 18% of loudest active coil RMS (rejects parasitic 500k pot bleed)

function cMag(v: ComplexVal): number {
  return Math.hypot(v.re, v.im);
}

/**
 * Determines whether a coil is electrically inverted (-1) or non-inverted (+1)
 * relative to its posTerm -> negTerm orientation by examining passband phase
 * well below its resonant peak.
 */
function determineCoilPolaritySign(
  transfers: ComplexVal[],
  freqs: number[]
): 1 | -1 {
  let maxMag = 0;
  let peakIdx = 0;
  for (let i = 0; i < freqs.length; i++) {
    if (freqs[i] < 60 || freqs[i] > 14000) continue;
    const m = cMag(transfers[i]);
    if (m > maxMag) {
      maxMag = m;
      peakIdx = i;
    }
  }
  if (maxMag < 1e-6) return 1;

  const fPeak = freqs[peakIdx];
  const cutoff = fPeak * 0.55;

  // Below 0.55 * fPeak, passive inductive lag is small (< 45 deg) and series-cap lead
  // is < 85 deg, so Re(H) > 0 for non-inverted and Re(H) < 0 for inverted.
  let weightedRe = 0;
  let weightSum = 0;
  for (let i = 0; i < freqs.length; i++) {
    if (freqs[i] > cutoff) break;
    const m = cMag(transfers[i]);
    if (m >= 0.2 * maxMag) {
      weightedRe += transfers[i].re * m;
      weightSum += m;
    }
  }

  if (weightSum > 0) {
    return weightedRe >= 0 ? 1 : -1;
  }

  // Fallback for very high-pass circuits whose passband sits right under fPeak
  let bestIdx = Math.max(0, peakIdx - 1);
  for (let i = 0; i < peakIdx; i++) {
    if (cMag(transfers[i]) > cMag(transfers[bestIdx])) {
      bestIdx = i;
    }
  }
  return transfers[bestIdx].re >= 0 ? 1 : -1;
}

/**
 * Computes combined electrical transfer magnitude |H_total(f)| across a frequency sweep.
 * Coils within each pickup are summed with their true signed EMFs; across distinct pickups,
 * out-of-phase pickups are aligned constructively for the electrical RLC response so that
 * acoustic pickup-spacing comb filtering can be applied cleanly on top.
 */
function combineElectricalSweep(
  sweep: MNASweepResult,
  activeCoilIndices: number[],
  coilPolaritySigns: Map<number, 1 | -1>,
  alignOutOfPhasePickups: boolean
): number[] {
  const numFreqs = sweep.freqs.length;

  // Group active coil indices by pickupId
  const pickupGroups = new Map<string, number[]>();
  for (const ci of activeCoilIndices) {
    const pid = sweep.coils[ci].pickupId;
    if (!pickupGroups.has(pid)) pickupGroups.set(pid, []);
    pickupGroups.get(pid)!.push(ci);
  }

  // Compute each pickup's acoustic polarity sign (+1 or -1)
  const pickupSignAlign = new Map<string, 1 | -1>();
  if (alignOutOfPhasePickups && pickupGroups.size >= 2) {
    for (const [pid, indices] of pickupGroups) {
      let netSign = 0;
      for (const ci of indices) {
        const c = sweep.coils[ci];
        const pol = coilPolaritySigns.get(ci) ?? 1;
        netSign += c.normalStringSign * pol;
      }
      pickupSignAlign.set(pid, netSign >= 0 ? 1 : -1);
    }
  }

  const mags = new Array<number>(numFreqs);
  for (let fi = 0; fi < numFreqs; fi++) {
    let sumRe = 0;
    let sumIm = 0;

    for (const [pid, indices] of pickupGroups) {
      let pRe = 0;
      let pIm = 0;
      for (const ci of indices) {
        const c = sweep.coils[ci];
        const h = sweep.transfers[ci][fi];
        // Excite coil with its string vibration EMF (baseEmf * normalStringSign)
        const emf = c.baseEmf * c.normalStringSign;
        pRe += emf * h.re;
        pIm += emf * h.im;
      }
      const align = pickupSignAlign.get(pid) ?? 1;
      sumRe += align * pRe;
      sumIm += align * pIm;
    }

    mags[fi] = Math.hypot(sumRe, sumIm);
  }

  return mags;
}

/**
 * Computes the RMS audio-band transfer magnitude over the core guitar harmonic range
 * (80 Hz - 2.5 kHz) for each coil in an MNA sweep.
 * Using band RMS rather than single-frequency peak prevents disconnected pickups that
 * weakly bleed treble through a 500k pot track (e.g. Jimmy Page Toggle=Bridge + Series=Up)
 * from being misclassified as active, while preserving series caps, bass-cut caps,
 * partial-split resistors, and tuned-split caps.
 */
function getCoilAudioBandPeaks(sweep: MNASweepResult): number[] {
  const scores = new Array<number>(sweep.coils.length).fill(0);
  for (let ci = 0; ci < sweep.coils.length; ci++) {
    let sumSq = 0;
    let count = 0;
    let peakHigh = 0;
    for (let fi = 0; fi < sweep.freqs.length; fi++) {
      const f = sweep.freqs[fi];
      const m = cMag(sweep.transfers[ci][fi]);
      if (f >= 75 && f <= 2600) {
        sumSq += m * m;
        count++;
      }
      if (f >= 800 && f <= 8000 && m > peakHigh) {
        peakHigh = m;
      }
    }
    const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
    // Allow extreme high-pass solo circuits (e.g. tiny 500pF series cap) to still register if mid-band is low
    scores[ci] = Math.max(rms, peakHigh * 0.25);
  }
  return scores;
}

export function analyzeCircuit(state: CircuitState): CircuitAnalysisResult {
  const { components } = state;
  const compMap = new Map<string, CircuitComponent>();
  for (const c of components) {
    compMap.set(c.id, c);
  }

  const issues: string[] = [];

  // Find output jack
  const jack = components.find((c) => c.type === 'output-jack');
  if (!jack) {
    return createSilentResult(['No 1/4" Output Jack placed on canvas.']);
  }

  // 1. Check for true galvanic short circuit (wires, closed switches, ground lugs, resistors < 100 Ohm)
  if (checkDirectShortCircuit(state)) {
    issues.push('⚠ Short circuit detected: Jack Tip is directly connected to Ground.');
    return createSilentResult(issues);
  }

  // 2. Run full-band MNA AC sweep with actual component values, plus a quick open-pot reference sweep
  const actualSweep = solveCircuitMNA(state, BODE_FREQS);
  if (!actualSweep) {
    return createSilentResult(['No 1/4" Output Jack placed on canvas.']);
  }

  const refSweep = solveCircuitMNA(state, REF_FREQS, { potValueOverride: 1.0 });
  if (!refSweep) {
    return createSilentResult(['No 1/4" Output Jack placed on canvas.']);
  }

  const actualPeaks = getCoilAudioBandPeaks(actualSweep);
  const refPeaks = getCoilAudioBandPeaks(refSweep);

  const maxActualPeak = actualPeaks.reduce((a, b) => Math.max(a, b), 0);
  const maxRefPeak = refPeaks.reduce((a, b) => Math.max(a, b), 0);

  // If no coil has output even with all volume/tone pots wide open at 10, no pickup is connected
  if (maxActualPeak < COIL_ACTIVE_ABS_MIN && maxRefPeak < COIL_ACTIVE_ABS_MIN) {
    return createSilentResult([
      'No pickups currently connected to the output path. Check selector switch position or volume pot.',
    ]);
  }

  const isMutedByPot = maxActualPeak < COIL_ACTIVE_ABS_MIN;
  const detectionSweep = isMutedByPot ? refSweep : actualSweep;
  const detectionPeaks = isMutedByPot ? refPeaks : actualPeaks;
  const maxDetPeak = isMutedByPot ? maxRefPeak : maxActualPeak;

  // 3. Identify active coils & their electrical polarity directly from MNA transfer functions
  const activeCoilIndices: number[] = [];
  const coilPolaritySigns = new Map<number, 1 | -1>();
  const activeThreshold = Math.max(COIL_ACTIVE_ABS_MIN, COIL_ACTIVE_REL_MIN * maxDetPeak);

  for (let ci = 0; ci < detectionSweep.coils.length; ci++) {
    if (detectionPeaks[ci] >= activeThreshold) {
      activeCoilIndices.push(ci);
      const pol = determineCoilPolaritySign(detectionSweep.transfers[ci], detectionSweep.freqs);
      coilPolaritySigns.set(ci, pol);
    }
  }

  if (activeCoilIndices.length === 0) {
    return createSilentResult([
      'No pickups currently connected to the output path. Check selector switch position or volume pot.',
    ]);
  }

  // Group active coil indices by pickup
  const activePickupIdsOrdered: string[] = [];
  const pickupCoilIndices = new Map<string, number[]>();
  const activePickupsMap = new Map<
    string,
    { id: string; name: string; position?: string; type: CircuitComponent['type'] }
  >();

  for (const ci of activeCoilIndices) {
    const c = detectionSweep.coils[ci];
    if (!pickupCoilIndices.has(c.pickupId)) {
      pickupCoilIndices.set(c.pickupId, []);
      activePickupIdsOrdered.push(c.pickupId);
      activePickupsMap.set(c.pickupId, {
        id: c.pickupId,
        name: c.pickupName,
        position: c.pickupPosition,
        type: c.pickupType,
      });
    }
    pickupCoilIndices.get(c.pickupId)!.push(ci);
  }

  // 4. Detect series vs parallel topology via MNA open-circuit coupling test
  const topoOptions = isMutedByPot ? { potValueOverride: 1.0 } : {};
  const topoBase = solveCircuitMNA(state, TOPOLOGY_PROBE_FREQS, topoOptions)!;
  const topoBaseMax = topoBase.coils.map((_, ci) =>
    Math.max(cMag(topoBase.transfers[ci][0]), cMag(topoBase.transfers[ci][1]))
  );

  // Check intra-humbucker series vs parallel
  const humbuckerInternalSeries = new Map<string, boolean>();
  for (const [puId, indices] of pickupCoilIndices) {
    const pu = compMap.get(puId);
    if (pu?.type === 'pickup-humbucker' && indices.length === 2) {
      const [c0, c1] = indices;
      const testOpen0 = solveCircuitMNA(state, TOPOLOGY_PROBE_FREQS, {
        ...topoOptions,
        openCoilIds: new Set([topoBase.coils[c0].id]),
      });
      const testOpen1 = solveCircuitMNA(state, TOPOLOGY_PROBE_FREQS, {
        ...topoOptions,
        openCoilIds: new Set([topoBase.coils[c1].id]),
      });
      const c1AfterOpen0 = testOpen0
        ? Math.max(cMag(testOpen0.transfers[c1][0]), cMag(testOpen0.transfers[c1][1]))
        : 0;
      const c0AfterOpen1 = testOpen1
        ? Math.max(cMag(testOpen1.transfers[c0][0]), cMag(testOpen1.transfers[c0][1]))
        : 0;

      // In series, opening one coil breaks or severely drops the other coil's path to the jack
      const drops1 = topoBaseMax[c1] > 1e-4 && c1AfterOpen0 < 0.45 * topoBaseMax[c1];
      const drops0 = topoBaseMax[c0] > 1e-4 && c0AfterOpen1 < 0.45 * topoBaseMax[c0];
      humbuckerInternalSeries.set(puId, drops0 || drops1);
    }
  }

  // Check inter-pickup series vs parallel
  let seriesLinksCount = 0;
  let totalPickupPairs = 0;
  if (activePickupIdsOrdered.length >= 2) {
    for (let i = 0; i < activePickupIdsOrdered.length; i++) {
      const puA = activePickupIdsOrdered[i];
      const coilsA = pickupCoilIndices.get(puA)!;
      const openSet = new Set(coilsA.map((ci) => topoBase.coils[ci].id));
      const testOpenA = solveCircuitMNA(state, TOPOLOGY_PROBE_FREQS, {
        ...topoOptions,
        openCoilIds: openSet,
      });

      for (let j = i + 1; j < activePickupIdsOrdered.length; j++) {
        totalPickupPairs++;
        const puB = activePickupIdsOrdered[j];
        const coilsB = pickupCoilIndices.get(puB)!;
        let bDropped = false;
        if (testOpenA) {
          for (const ciB of coilsB) {
            const afterM = Math.max(
              cMag(testOpenA.transfers[ciB][0]),
              cMag(testOpenA.transfers[ciB][1])
            );
            if (topoBaseMax[ciB] > 1e-4 && afterM < 0.45 * topoBaseMax[ciB]) {
              bDropped = true;
              break;
            }
          }
        }
        if (bDropped) {
          seriesLinksCount++;
        } else {
          // Also test opening B to see if A depends on B (e.g. half-series cap across B)
          const openSetB = new Set(coilsB.map((ci) => topoBase.coils[ci].id));
          const testOpenB = solveCircuitMNA(state, TOPOLOGY_PROBE_FREQS, {
            ...topoOptions,
            openCoilIds: openSetB,
          });
          if (testOpenB) {
            for (const ciA of coilsA) {
              const afterM = Math.max(
                cMag(testOpenB.transfers[ciA][0]),
                cMag(testOpenB.transfers[ciA][1])
              );
              if (topoBaseMax[ciA] > 1e-4 && afterM < 0.45 * topoBaseMax[ciA]) {
                seriesLinksCount++;
                break;
              }
            }
          }
        }
      }
    }
  }

  const isInterPickupSeries = totalPickupPairs > 0 && seriesLinksCount === totalPickupPairs;
  const isInterPickupComplex =
    totalPickupPairs > 0 && seriesLinksCount > 0 && seriesLinksCount < totalPickupPairs;

  // Build ActiveCoilInfo[] with accurate names, polarities, and electrical phases
  const activeCoils: ActiveCoilInfo[] = [];
  let isCoilSplit = false;

  for (const ci of activeCoilIndices) {
    const c = detectionSweep.coils[ci];
    const pol = coilPolaritySigns.get(ci) ?? 1;
    const electricalPhase: 'In-Phase' | 'Reverse-Phase' =
      pol > 0
        ? c.normalElectricalPhase
        : c.normalElectricalPhase === 'In-Phase'
        ? 'Reverse-Phase'
        : 'In-Phase';

    let coilName = 'Single Coil';
    if (c.pickupType === 'pickup-humbucker') {
      const puCoils = pickupCoilIndices.get(c.pickupId) || [];
      const isSingleActiveBobbin = puCoils.length === 1;
      const isPar = puCoils.length === 2 && !humbuckerInternalSeries.get(c.pickupId);
      if (isSingleActiveBobbin) isCoilSplit = true;

      if (c.bobbin === 'north') {
        coilName = isPar
          ? 'North Slug Coil (Parallel)'
          : isSingleActiveBobbin
          ? 'North Slug Coil (Coil-Split)'
          : 'North Slug Coil';
      } else {
        coilName = isPar
          ? 'South Screw Coil (Parallel)'
          : isSingleActiveBobbin
          ? 'South Screw Coil (Coil-Split)'
          : 'South Screw Coil';
      }
    } else if (c.pickupType === 'pickup-tele-neck') {
      coilName = pol > 0 ? 'Tele Neck (Chrome Shielded)' : 'Tele Neck (Phase Inverted)';
    } else {
      const pu = compMap.get(c.pickupId);
      const isRwrp = !!pu?.properties.rwrp;
      if (pol > 0) {
        coilName = isRwrp ? 'Single Coil (RWRP)' : 'Single Coil';
      } else {
        coilName = isRwrp ? 'Single Coil (RWRP Rev)' : 'Single Coil (Phase Inverted)';
      }
    }

    activeCoils.push({
      pickupId: c.pickupId,
      pickupName: c.pickupName,
      coilName,
      magneticPolarity: c.magneticPolarity,
      electricalPhase,
      dcResistanceK: c.dcResistanceK,
      inductanceH: c.inductanceH,
    });
  }

  // Determine overall wiringConfiguration
  let wiringConfig: 'solo' | 'parallel' | 'series' | 'complex' | 'none' = 'solo';
  if (activeCoils.length === 1) {
    wiringConfig = 'solo';
  } else if (activePickupIdsOrdered.length === 1) {
    const puId = activePickupIdsOrdered[0];
    wiringConfig = humbuckerInternalSeries.get(puId) ? 'series' : 'parallel';
  } else if (isInterPickupSeries) {
    wiringConfig = 'series';
  } else if (isInterPickupComplex) {
    wiringConfig = 'complex';
  } else {
    wiringConfig = 'parallel';
  }

  // 5. Phase Relationship Analysis (Acoustic polarity across pickups/coils)
  let phaseRelationship: 'in-phase' | 'out-of-phase' | 'solo' | 'silent' = 'in-phase';

  if (activeCoils.length === 1) {
    phaseRelationship = 'solo';
  } else if (activeCoils.length === 2) {
    const c1 = activeCoils[0];
    const c2 = activeCoils[1];

    const sign1 =
      (c1.magneticPolarity === 'North' ? 1 : -1) * (c1.electricalPhase === 'In-Phase' ? 1 : -1);
    const sign2 =
      (c2.magneticPolarity === 'North' ? 1 : -1) * (c2.electricalPhase === 'In-Phase' ? 1 : -1);

    phaseRelationship = sign1 * sign2 > 0 ? 'in-phase' : 'out-of-phase';
  } else if (activePickupIdsOrdered.length === 2) {
    const getPuSign = (puId: string) => {
      const coils = activeCoils.filter((c) => c.pickupId === puId);
      let total = 0;
      for (const c of coils) {
        const mag = c.magneticPolarity === 'North' ? 1 : -1;
        const elec = c.electricalPhase === 'In-Phase' ? 1 : -1;
        total += mag * elec;
      }
      return total >= 0 ? 1 : -1;
    };

    const sign1 = getPuSign(activePickupIdsOrdered[0]);
    const sign2 = getPuSign(activePickupIdsOrdered[1]);
    phaseRelationship = sign1 * sign2 < 0 ? 'out-of-phase' : 'in-phase';
  } else {
    phaseRelationship = 'in-phase';
  }

  // 6. Equivalent pickup RLC (DC resistance & inductance)
  const pickupEquivs: { L: number; R: number }[] = [];
  let totalPickupCapPf = 0;

  for (const [puId, indices] of pickupCoilIndices) {
    const pu = compMap.get(puId);
    const pCoils = indices.map((ci) => detectionSweep.coils[ci]);
    let pL = 0;
    let pR = 0;

    if (pCoils.length === 1) {
      pL = pCoils[0].inductanceH;
      pR = pCoils[0].dcResistanceK;
    } else if (pu?.type === 'pickup-humbucker') {
      if (humbuckerInternalSeries.get(puId)) {
        pL = pCoils.reduce((sum, c) => sum + c.inductanceH, 0);
        pR = pCoils.reduce((sum, c) => sum + c.dcResistanceK, 0);
      } else {
        const invL = pCoils.reduce((sum, c) => sum + 1 / Math.max(0.1, c.inductanceH), 0);
        pL = 1 / Math.max(0.001, invL);
        const invR = pCoils.reduce((sum, c) => sum + 1 / Math.max(0.1, c.dcResistanceK), 0);
        pR = 1 / Math.max(0.001, invR);
      }
    } else {
      pL = pCoils.reduce((sum, c) => sum + c.inductanceH, 0);
      pR = pCoils.reduce((sum, c) => sum + c.dcResistanceK, 0);
    }

    pickupEquivs.push({ L: pL, R: pR });

    if (pu?.type === 'pickup-humbucker') {
      if (pCoils.length === 1) totalPickupCapPf += 80;
      else if (!humbuckerInternalSeries.get(puId)) totalPickupCapPf += 160;
      else totalPickupCapPf += pu.properties.capacitancePf ?? 145;
    } else if (pCoils.length > 0) {
      totalPickupCapPf += pCoils[0].capacitancePf;
    }
  }

  let totalL = 0;
  let totalR = 0;
  if (pickupEquivs.length === 1) {
    totalL = pickupEquivs[0].L;
    totalR = pickupEquivs[0].R;
  } else if (wiringConfig === 'series') {
    totalL = pickupEquivs.reduce((sum, p) => sum + p.L, 0);
    totalR = pickupEquivs.reduce((sum, p) => sum + p.R, 0);
  } else {
    const invL = pickupEquivs.reduce((sum, p) => sum + 1 / Math.max(0.1, p.L), 0);
    totalL = 1 / Math.max(0.001, invL);
    const invR = pickupEquivs.reduce((sum, p) => sum + 1 / Math.max(0.1, p.R), 0);
    totalR = 1 / Math.max(0.001, invR);
  }

  // 7. Identify Active Volume Pots and Active Tone Pots via MNA sensitivity probes
  const activeVolPotIds: string[] = [];
  const activeTonePotIds: string[] = [];
  const pots = components.filter(
    (c) =>
      c.type === 'pot-standard' ||
      c.type === 'pot-pushpull' ||
      c.type === 'pot-stacked' ||
      c.type === 'pot-blend'
  );

  const isOutOfPhase = phaseRelationship === 'out-of-phase';
  const potBaseSweep = solveCircuitMNA(state, POT_PROBE_FREQS, { potValueOverride: 1.0 });
  const potBaseMags = potBaseSweep
    ? combineElectricalSweep(potBaseSweep, activeCoilIndices, coilPolaritySigns, isOutOfPhase)
    : [0, 0];

  for (const pot of pots) {
    if (pot.type === 'pot-blend') {
      const b0 = solveCircuitMNA(state, [400], {
        potValueOverride: 1.0,
        potValueOverrides: new Map([[pot.id, 0.0]]),
      });
      const b1 = solveCircuitMNA(state, [400], {
        potValueOverride: 1.0,
        potValueOverrides: new Map([[pot.id, 1.0]]),
      });
      if (b0 && b1) {
        let changed = false;
        for (const ci of activeCoilIndices) {
          const m0 = cMag(b0.transfers[ci][0]);
          const m1 = cMag(b1.transfers[ci][0]);
          if (Math.abs(m0 - m1) > 0.1 * Math.max(m0, m1, 0.01)) {
            changed = true;
            break;
          }
        }
        if (changed) activeVolPotIds.push(pot.id);
      }
      continue;
    }

    const overrides = new Map<string, number>([[pot.id, 0.0]]);
    const probeSweep = solveCircuitMNA(state, POT_PROBE_FREQS, {
      potValueOverride: 1.0,
      potValueOverrides: overrides,
    });
    if (!probeSweep) continue;
    const probeMags = combineElectricalSweep(
      probeSweep,
      activeCoilIndices,
      coilPolaritySigns,
      isOutOfPhase
    );

    const r200 = potBaseMags[0] > 1e-5 ? probeMags[0] / potBaseMags[0] : 1;
    const r5000 = potBaseMags[1] > 1e-5 ? probeMags[1] / potBaseMags[1] : 1;

    if (r200 < 0.15) {
      activeVolPotIds.push(pot.id);
    } else if (r5000 < 0.72 || r200 < 0.72) {
      activeTonePotIds.push(pot.id);
    }
  }

  // 8. Compute combined MNA frequency response (actual + tone-open reference)
  const actualCurveMags = combineElectricalSweep(
    actualSweep,
    activeCoilIndices,
    coilPolaritySigns,
    isOutOfPhase
  );

  // Check if any active tone pot is rolled down below 1.0
  const hasRolledTonePot = activeTonePotIds.some((id) => {
    const p = compMap.get(id);
    if (!p) return false;
    if (p.type === 'pot-stacked') {
      return (p.properties.innerValue ?? 1.0) < 0.99 || (p.properties.outerValue ?? 1.0) < 0.99;
    }
    return (p.properties.currentValue ?? 1.0) < 0.99;
  });

  // Reference curve with tone pots wide open (used to isolate pickup resonant f0/Q and tone cutoff)
  let openToneCurveMags = actualCurveMags;
  if (hasRolledTonePot && !isMutedByPot) {
    const toneOpenOverrides = new Map<string, number>();
    for (const tid of activeTonePotIds) {
      toneOpenOverrides.set(tid, 1.0);
    }
    const openToneSweep = solveCircuitMNA(state, BODE_FREQS, {
      potValueOverrides: toneOpenOverrides,
    });
    if (openToneSweep) {
      openToneCurveMags = combineElectricalSweep(
        openToneSweep,
        activeCoilIndices,
        coilPolaritySigns,
        isOutOfPhase
      );
    }
  } else if (isMutedByPot) {
    // When muted by volume pot at 0, compute open-pot Bode curve to keep resonant f0/Q meaningful
    const openAllSweep = solveCircuitMNA(state, BODE_FREQS, { potValueOverride: 1.0 });
    if (openAllSweep) {
      openToneCurveMags = combineElectricalSweep(
        openAllSweep,
        activeCoilIndices,
        coilPolaritySigns,
        isOutOfPhase
      );
    }
  }

  // 9. Compute effectiveVolumeLevel directly from MNA ratio vs full-volume reference
  let effectiveVolumeLevel = 0;
  if (!isMutedByPot) {
    const refCurveMags = combineElectricalSweep(
      refSweep,
      activeCoilIndices,
      coilPolaritySigns,
      isOutOfPhase
    );
    const refMax = refCurveMags.reduce((a, b) => Math.max(a, b), 0);

    // Pick lowest passband frequency in [150, 300, 600, 1200] Hz (avoids tone-pot rolloff & resonant peak)
    let volRefFreq = 300;
    let volRefMag = refCurveMags[2]; // 300 Hz index in REF_FREQS
    for (let idx = 1; idx <= 4; idx++) {
      if (refCurveMags[idx] >= 0.45 * refMax) {
        volRefFreq = REF_FREQS[idx];
        volRefMag = refCurveMags[idx];
        break;
      }
    }

    // Find closest bin in BODE_FREQS to volRefFreq
    let closestBin = 0;
    let bestDist = Infinity;
    for (let i = 0; i < BODE_FREQS.length; i++) {
      const d = Math.abs(BODE_FREQS[i] - volRefFreq);
      if (d < bestDist) {
        bestDist = d;
        closestBin = i;
      }
    }

    const actualAtRef = openToneCurveMags[closestBin];
    const ratio = volRefMag > 1e-6 ? actualAtRef / volRefMag : 1.0;
    if (ratio >= 0.985) {
      effectiveVolumeLevel = 1.0;
    } else if (ratio <= 0.01) {
      effectiveVolumeLevel = 0;
    } else {
      effectiveVolumeLevel = Math.round(ratio * 1000) / 1000;
    }
  }

  const hasOutputSignal = !isMutedByPot && effectiveVolumeLevel > 0.01;

  // 9b. Exact AC MNA Hum-Cancellation Analysis (60 Hz fundamental + 180 Hz 3rd harmonic)
  // Ambient mains EMI depends strictly on each coil's winding sense & electrical lead orientation
  // (independent of permanent magnet polarity) and sums through the full passive impedance network.
  const humSweep = solveCircuitMNA(state, HUM_PROBE_FREQS, topoOptions);
  let isHumCancelling = false;
  let humStatus: 'cancelling' | 'reduced' | 'present' | 'none' = 'present';
  let residualHumDb = 0;
  let humReason = '';

  if (humSweep && activeCoilIndices.length > 0) {
    let activeESum = 0;
    for (const ci of activeCoilIndices) {
      activeESum += Math.sqrt(Math.max(0.1, humSweep.coils[ci].inductanceH));
    }
    const avgActiveE = activeESum / activeCoilIndices.length;
    const volScale = isMutedByPot ? 1.0 : Math.max(0.01, effectiveVolumeLevel);
    const singleCoilRef = Math.max(1e-6, avgActiveE * volScale);

    const evalHumAtBin = (fi: number) => {
      let sumRe = 0;
      let sumIm = 0;
      let incoherentSum = 0;
      for (let ci = 0; ci < humSweep.coils.length; ci++) {
        const c = humSweep.coils[ci];
        const w = c.normalElectricalPhase === 'In-Phase' ? 1 : -1;
        const e = Math.sqrt(Math.max(0.1, c.inductanceH));
        const h = humSweep.transfers[ci][fi];
        sumRe += w * e * h.re;
        sumIm += w * e * h.im;
        incoherentSum += e * Math.hypot(h.re, h.im);
      }
      const coherentMag = Math.hypot(sumRe, sumIm);
      const cancelFactor = incoherentSum > 1e-9 ? coherentMag / incoherentSum : 1.0;
      const ratio = coherentMag / singleCoilRef;
      return { ratio, cancelFactor };
    };

    const h60 = evalHumAtBin(0);
    const h180 = evalHumAtBin(1);

    // Weighted mains hum spectrum (75% power at 60 Hz fundamental, 25% at 180 Hz 3rd harmonic) for display
    const combinedRatio = Math.sqrt(0.75 * h60.ratio * h60.ratio + 0.25 * h180.ratio * h180.ratio);
    const minCancelFactor = Math.min(h60.cancelFactor, h180.cancelFactor);

    // Require genuine opposing-coil cancellation (not merely a single coil behind a high-pass filter)
    const hasOpposingCancellation = minCancelFactor < 0.85;
    const rawHumDb = 20 * Math.log10(Math.max(1e-6, combinedRatio));
    residualHumDb = Math.max(-120, Math.round(rawHumDb * 10) / 10);

    // Classify status on the worse of the two probe frequencies (60 Hz & 180 Hz) so a deep
    // 60 Hz null cannot mask weaker 180 Hz harmonic cancellation (which is more audible)
    const worstDb = 20 * Math.log10(Math.max(1e-6, Math.max(h60.ratio, h180.ratio)));
    const worstDbRounded = Math.max(-120, Math.round(worstDb * 10) / 10);
    const worstFreqHz = h180.ratio >= h60.ratio ? 180 : 60;

    const inPhaseCount = activeCoils.filter((c) => c.electricalPhase === 'In-Phase').length;
    const revPhaseCount = activeCoils.filter((c) => c.electricalPhase === 'Reverse-Phase').length;

    if (hasOpposingCancellation && worstDb <= -20) {
      isHumCancelling = true;
      humStatus = 'cancelling';
      if (residualHumDb > -45) {
        humReason = `Hum-cancelling active! Opposing coil windings cancel 60Hz EMI (residual hum: ${residualHumDb} dB).`;
      } else {
        humReason = 'Hum-cancelling active! Reverse-wound / opposite electrical polarity cancels 60Hz EMI.';
      }
    } else if (hasOpposingCancellation && residualHumDb <= -6) {
      isHumCancelling = false;
      humStatus = 'reduced';
      if (Math.abs(worstDbRounded - residualHumDb) >= 2) {
        humReason = `Partial hum reduction (${residualHumDb} dB weighted, ${worstDbRounded} dB at ${worstFreqHz}Hz vs. single coil) — opposing windings reduce EMI, but residual hum remains.`;
      } else {
        humReason = `Partial hum reduction (${residualHumDb} dB vs. single coil) — opposing windings reduce 60Hz EMI, but residual hum remains.`;
      }
    } else {
      isHumCancelling = false;
      humStatus = 'present';
      if (activeCoils.length === 1) {
        humReason = 'Single coil active — susceptible to 60Hz ambient electromagnetic interference.';
      } else if (inPhaseCount === 0 || revPhaseCount === 0) {
        humReason = 'Active coils share matching electrical polarity — 60Hz hum is additive (not cancelled).';
      } else if (activeCoils.length >= 3) {
        humReason = `Unbalanced multi-coil combination (${inPhaseCount} In-Phase / ${revPhaseCount} Reverse-Phase, ${residualHumDb} dB vs. single coil) — residual 60Hz hum present.`;
      } else {
        humReason = `Unbalanced coil impedance (${residualHumDb} dB vs. single coil) — 60Hz hum is not cancelled.`;
      }
    }

    if (phaseRelationship === 'out-of-phase') {
      humReason += ' ⚡ Notice: Pickups are OUT OF PHASE (Peter Green hollow nasal acoustic cancellation).';
    }
  }

  // 10. Extract resonantFrequencyHz, peakBoostDb, qFactor directly from MNA open-tone sweep
  // Prefer the primary pickup LC resonance in [1100, 14000] Hz (so dual-resonance tuned-split
  // circuits report the true upper single-coil peak rather than the ~600Hz series-cap bump).
  let peakBin = 0;
  let peakMag = 0;
  let foundTrebleLocalMax = false;
  for (let i = 1; i < BODE_FREQS.length - 1; i++) {
    if (BODE_FREQS[i] < 1100 || BODE_FREQS[i] > 14000) continue;
    const m = openToneCurveMags[i];
    if (m >= openToneCurveMags[i - 1] && m >= openToneCurveMags[i + 1] && m > peakMag) {
      peakMag = m;
      peakBin = i;
      foundTrebleLocalMax = true;
    }
  }
  if (!foundTrebleLocalMax) {
    for (let i = 0; i < BODE_FREQS.length; i++) {
      if (BODE_FREQS[i] < 450 || BODE_FREQS[i] > 14000) continue;
      if (openToneCurveMags[i] > peakMag) {
        peakMag = openToneCurveMags[i];
        peakBin = i;
      }
    }
  }

  // Parabolic interpolation in log-frequency around peakBin for precise f0
  let resonantFrequencyHz = Math.round(BODE_FREQS[peakBin] || 3500);
  if (peakBin > 0 && peakBin < BODE_FREQS.length - 1) {
    const yL = openToneCurveMags[peakBin - 1];
    const yC = openToneCurveMags[peakBin];
    const yR = openToneCurveMags[peakBin + 1];
    const denom = yL - 2 * yC + yR;
    if (denom < -1e-9) {
      const delta = Math.max(-0.5, Math.min(0.5, (0.5 * (yL - yR)) / denom));
      const logF =
        Math.log10(BODE_FREQS[peakBin]) +
        delta * (Math.log10(BODE_FREQS[peakBin + 1]) - Math.log10(BODE_FREQS[peakBin]));
      resonantFrequencyHz = Math.round(Math.pow(10, logF));
    }
  }

  // Passband baseline magnitude below resonance:
  // Use ~180-300 Hz for normal circuits; if a high-pass bass-cut cap rolls off 200 Hz
  // (monotonically rising toward the peak), sample closer to 0.22 * f0.
  const findClosestBin = (targetF: number) => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < BODE_FREQS.length; i++) {
      const d = Math.abs(BODE_FREQS[i] - targetF);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };

  const lowBaseBin = findClosestBin(200);
  const midBaseBin = findClosestBin(Math.max(250, Math.min(900, resonantFrequencyHz * 0.22)));
  // If curve is monotonically rising from 200 Hz to midBase (series bass-cut cap), use midBaseBin;
  // otherwise use lowBaseBin (so a secondary tuned-split bump at ~600Hz doesn't inflate baseMag).
  const isHighPassedLow =
    openToneCurveMags[lowBaseBin] < 0.85 * openToneCurveMags[midBaseBin] &&
    openToneCurveMags[findClosestBin(80)] < openToneCurveMags[lowBaseBin];
  const baseBin = isHighPassedLow ? midBaseBin : lowBaseBin;
  const baseMag = openToneCurveMags[baseBin];

  const peakRatio = baseMag > 1e-6 ? peakMag / baseMag : 1.0;

  // Handle overdamped circuits (no resonant peak above passband): find -3 dB upper cutoff
  if (!foundTrebleLocalMax && peakRatio < 1.04) {
    let cutoffBin = peakBin;
    for (let i = baseBin; i < BODE_FREQS.length; i++) {
      if (openToneCurveMags[i] <= baseMag * 0.7071) {
        cutoffBin = i;
        break;
      }
    }
    resonantFrequencyHz = Math.round(
      Math.min(12000, Math.max(600, BODE_FREQS[cutoffBin] || resonantFrequencyHz))
    );
  } else {
    resonantFrequencyHz = Math.round(Math.min(12000, Math.max(600, resonantFrequencyHz)));
  }

  // Convert peak ratio to Q factor for a 2nd-order RLC response:
  // For Q > 1/sqrt(2), peakRatio = Q / sqrt(1 - 1/(4*Q^2))  =>  Q ≈ peakRatio (exact for Q >= 1.2)
  let rawQ = 0.7;
  if (peakRatio > 1.02) {
    // Exact inverse of M_p = Q / sqrt(1 - 1/(4Q^2)):
    // 4 M_p^2 Q^2 - M_p^2 = 4 Q^4 => Q^2 = (M_p^2 + M_p * sqrt(M_p^2 - 1)) / 2
    const mpSq = peakRatio * peakRatio;
    rawQ = Math.sqrt(0.5 * (mpSq + peakRatio * Math.sqrt(Math.max(0, mpSq - 1))));
  }
  const qFactor = Math.min(7.0, Math.max(0.5, Math.round(rawQ * 10) / 10));
  const peakBoostDb = Math.max(0, Math.round(20 * Math.log10(Math.max(1.0, peakRatio)) * 10) / 10);

  // 11. Measure exact effective load resistance (kOhm) from MNA
  const activeCoilModels: CoilModel[] = activeCoilIndices.map((ci) => detectionSweep.coils[ci]);
  const loadResistanceK = measureEffectiveLoadResistanceK(
    state,
    activeCoilModels,
    resonantFrequencyHz
  );

  // 12. Measure effectiveToneCutoffHz when tone pot(s) are rolled down
  let effectiveToneCutoffHz = 20000;
  if (hasRolledTonePot && hasOutputSignal) {
    // Find frequency where actual response drops -3 dB (0.707) relative to open-tone response
    for (let i = 1; i < BODE_FREQS.length; i++) {
      if (BODE_FREQS[i] < 180) continue;
      const openM = openToneCurveMags[i];
      if (openM < 1e-6) continue;
      const ratio = actualCurveMags[i] / openM;
      if (ratio <= 0.7071) {
        const prevOpen = openToneCurveMags[i - 1];
        const prevRatio = prevOpen > 1e-6 ? actualCurveMags[i - 1] / prevOpen : 1.0;
        if (prevRatio > 0.7071 && prevRatio > ratio) {
          const t = (prevRatio - 0.7071) / (prevRatio - ratio);
          const logF =
            Math.log10(BODE_FREQS[i - 1]) +
            t * (Math.log10(BODE_FREQS[i]) - Math.log10(BODE_FREQS[i - 1]));
          effectiveToneCutoffHz = Math.round(Math.max(200, Math.min(18000, Math.pow(10, logF))));
        } else {
          effectiveToneCutoffHz = Math.round(Math.max(200, Math.min(18000, BODE_FREQS[i])));
        }
        break;
      }
    }
  }

  // 13. Build MNA Bode frequency response array for FrequencyResponsePlot
  const frequencyResponse: { freq: number; db: number }[] = BODE_FREQS.map((freq, idx) => ({
    freq: Math.round(freq * 10) / 10,
    db: hasOutputSignal
      ? Math.round(20 * Math.log10(Math.max(1e-4, actualCurveMags[idx])) * 100) / 100
      : -60,
  }));

  const totalC_Pf = CABLE_CAPACITANCE_PF + STRAY_CAPACITANCE_PF + totalPickupCapPf;

  let gainOffsetDb = 0;
  if (wiringConfig === 'series') {
    gainOffsetDb = 4.0;
  } else if (isCoilSplit) {
    gainOffsetDb = -4.5;
  } else if (activeCoils.some((c) => c.coilName.includes('Parallel'))) {
    gainOffsetDb = -2.5;
  }

  return {
    hasOutputSignal,
    activePickups: Array.from(activePickupsMap.values()),
    activeCoils,
    wiringConfiguration: wiringConfig,
    phaseRelationship,
    isHumCancelling,
    humStatus,
    residualHumDb,
    humCancellingReason: humReason,
    estimatedTotalResistanceK: Math.round(totalR * 10) / 10,
    estimatedTotalInductanceH: Math.round(totalL * 10) / 10,
    resonantFrequencyHz,
    peakBoostDb,
    qFactor,
    effectiveVolumeLevel,
    effectiveToneCutoffHz,
    activeVolumePotIds: activeVolPotIds,
    activeTonePotIds: activeTonePotIds,
    circuitIssues: issues,
    loadResistanceK: Math.round(loadResistanceK * 10) / 10,
    totalCapacitancePf: Math.round(totalC_Pf),
    isCoilSplit,
    gainOffsetDb,
    frequencyResponse,
  };
}

function createSilentResult(issues: string[]): CircuitAnalysisResult {
  return {
    hasOutputSignal: false,
    activePickups: [],
    activeCoils: [],
    wiringConfiguration: 'none',
    phaseRelationship: 'silent',
    isHumCancelling: false,
    humStatus: 'none',
    residualHumDb: -120,
    humCancellingReason: 'No signal path completed.',
    estimatedTotalResistanceK: 0,
    estimatedTotalInductanceH: 0,
    resonantFrequencyHz: 3500,
    peakBoostDb: 0,
    qFactor: 1.0,
    effectiveVolumeLevel: 0,
    effectiveToneCutoffHz: 20000,
    activeVolumePotIds: [],
    activeTonePotIds: [],
    circuitIssues: issues,
  };
}

interface EdgeWithWire {
  neighbor: string;
  wireId?: string;
}

function getConnectedNodesSet(startNode: string, adj: Map<string, EdgeWithWire[]>): Set<string> {
  const visited = new Set<string>();
  const queue = [startNode];
  visited.add(startNode);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adj.get(current);
    if (neighbors) {
      for (const edge of neighbors) {
        if (!visited.has(edge.neighbor)) {
          visited.add(edge.neighbor);
          queue.push(edge.neighbor);
        }
      }
    }
  }

  return visited;
}

function findPathsBetween(
  startNode: string,
  endNode: string,
  adj: Map<string, EdgeWithWire[]>
): { pathNodes: Set<string>; pathWireIds: Set<string> } {
  const dist = new Map<string, number>();
  const parentEdges = new Map<string, { from: string; wireId?: string }[]>();
  const queue = [startNode];
  dist.set(startNode, 0);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const d = dist.get(curr)!;
    const neighbors = adj.get(curr) || [];
    for (const edge of neighbors) {
      const next = edge.neighbor;
      if (!dist.has(next)) {
        dist.set(next, d + 1);
        parentEdges.set(next, [{ from: curr, wireId: edge.wireId }]);
        queue.push(next);
      } else if (dist.get(next) === d + 1) {
        parentEdges.get(next)!.push({ from: curr, wireId: edge.wireId });
      }
    }
  }

  const pathNodes = new Set<string>();
  const pathWireIds = new Set<string>();
  if (!dist.has(endNode)) return { pathNodes, pathWireIds };

  const backtrackQueue = [endNode];
  pathNodes.add(endNode);
  const visitedBack = new Set<string>([endNode]);

  while (backtrackQueue.length > 0) {
    const curr = backtrackQueue.shift()!;
    const parents = parentEdges.get(curr) || [];
    for (const p of parents) {
      pathNodes.add(p.from);
      if (p.wireId) pathWireIds.add(p.wireId);
      if (!visitedBack.has(p.from)) {
        visitedBack.add(p.from);
        backtrackQueue.push(p.from);
      }
    }
  }

  return { pathNodes, pathWireIds };
}

function addPotTrackEdges(
  comp: CircuitComponent,
  wiredTerms: Set<string>,
  connectedToGnd: Set<string> | null,
  addEdge: (a: string, b: string) => void
) {
  const cid = comp.id;
  const safeAdd = (a: string, b: string) => {
    // When building the hot signal graph, never bridge through a grounded pot lug
    if (connectedToGnd && (connectedToGnd.has(a) || connectedToGnd.has(b))) return;
    addEdge(a, b);
  };

  switch (comp.type) {
    case 'pot-standard':
    case 'pot-pushpull': {
      const l1 = `${cid}:lug-1`;
      const l2 = `${cid}:lug-2`;
      const l3 = `${cid}:lug-3`;
      safeAdd(l2, l3);
      if (!wiredTerms.has(l3) && wiredTerms.has(l1) && wiredTerms.has(l2)) {
        safeAdd(l1, l2);
      }
      break;
    }
    case 'pot-stacked': {
      safeAdd(`${cid}:a-lug-2`, `${cid}:a-lug-3`);
      if (
        !wiredTerms.has(`${cid}:a-lug-3`) &&
        wiredTerms.has(`${cid}:a-lug-1`) &&
        wiredTerms.has(`${cid}:a-lug-2`)
      ) {
        safeAdd(`${cid}:a-lug-1`, `${cid}:a-lug-2`);
      }
      safeAdd(`${cid}:b-lug-2`, `${cid}:b-lug-3`);
      if (
        !wiredTerms.has(`${cid}:b-lug-3`) &&
        wiredTerms.has(`${cid}:b-lug-1`) &&
        wiredTerms.has(`${cid}:b-lug-2`)
      ) {
        safeAdd(`${cid}:b-lug-1`, `${cid}:b-lug-2`);
      }
      break;
    }
    case 'pot-blend': {
      safeAdd(`${cid}:a-in`, `${cid}:a-wiper`);
      safeAdd(`${cid}:b-in`, `${cid}:b-wiper`);
      break;
    }
  }
}

export function computeSignalPath(state: CircuitState): SignalPathInfo {
  const { components, wires } = state;
  const emptyResult: SignalPathInfo = {
    activeComponentIds: new Set<string>(),
    activeWireIds: new Set<string>(),
    activeTerminalKeys: new Set<string>(),
    activePickupIds: [],
    hasSignalPath: false,
  };

  const jack = components.find((c) => c.type === 'output-jack');
  if (!jack) return emptyResult;

  const jackTip = `${jack.id}:tip`;
  const jackSleeve = `${jack.id}:sleeve`;

  // 1. True galvanic short circuit check (never treats normal resistors or caps as shorts)
  if (checkDirectShortCircuit(state)) {
    return {
      activeComponentIds: new Set<string>([jack.id]),
      activeWireIds: new Set<string>(),
      activeTerminalKeys: new Set<string>([jackTip, jackSleeve]),
      activePickupIds: [],
      hasSignalPath: false,
      activeHumbuckerCoils: {},
    };
  }

  // 2. Use MNA to determine which coils are genuinely active in the AC signal path
  const actualSweep = solveCircuitMNA(state, REF_FREQS);
  const refSweep = solveCircuitMNA(state, REF_FREQS, { potValueOverride: 1.0 });
  if (!actualSweep || !refSweep) return emptyResult;

  const actualPeaks = getCoilAudioBandPeaks(actualSweep);
  const refPeaks = getCoilAudioBandPeaks(refSweep);
  const maxActualPeak = actualPeaks.reduce((a, b) => Math.max(a, b), 0);
  const maxRefPeak = refPeaks.reduce((a, b) => Math.max(a, b), 0);

  if (maxActualPeak < COIL_ACTIVE_ABS_MIN && maxRefPeak < COIL_ACTIVE_ABS_MIN) {
    return {
      activeComponentIds: new Set<string>([jack.id]),
      activeWireIds: new Set<string>(),
      activeTerminalKeys: new Set<string>([jackTip, jackSleeve]),
      activePickupIds: [],
      hasSignalPath: false,
      activeHumbuckerCoils: {},
    };
  }

  const useRef = maxActualPeak < COIL_ACTIVE_ABS_MIN;
  const sweep = useRef ? refSweep : actualSweep;
  const peaks = useRef ? refPeaks : actualPeaks;
  const maxPeak = useRef ? maxRefPeak : maxActualPeak;
  const threshold = Math.max(COIL_ACTIVE_ABS_MIN, COIL_ACTIVE_REL_MIN * maxPeak);

  const activeCoilModels: CoilModel[] = [];
  for (let ci = 0; ci < sweep.coils.length; ci++) {
    if (peaks[ci] >= threshold) {
      activeCoilModels.push(sweep.coils[ci]);
    }
  }

  if (activeCoilModels.length === 0) {
    return {
      activeComponentIds: new Set<string>([jack.id]),
      activeWireIds: new Set<string>(),
      activeTerminalKeys: new Set<string>([jackTip, jackSleeve]),
      activePickupIds: [],
      hasSignalPath: false,
      activeHumbuckerCoils: {},
    };
  }

  // 3. Build value-aware trace graphs for highlighting active wires, terminals, and components
  const gndAdj = new Map<string, EdgeWithWire[]>();
  const hotAdj = new Map<string, EdgeWithWire[]>();
  const passiveTraceAdj = new Map<string, EdgeWithWire[]>(); // Wires + switches + pots (NO cap/resistor jumps)
  const acGndAdj = new Map<string, EdgeWithWire[]>(); // Fallback ground graph allowing series caps/resistors on ground return

  const pushEdge = (map: Map<string, EdgeWithWire[]>, a: string, b: string, wireId?: string) => {
    if (!map.has(a)) map.set(a, []);
    if (!map.has(b)) map.set(b, []);
    map.get(a)!.push({ neighbor: b, wireId });
    map.get(b)!.push({ neighbor: a, wireId });
  };

  const wiredTerms = new Set<string>();
  for (const wire of wires) {
    const k1 = `${wire.fromComponentId}:${wire.fromTerminalId}`;
    const k2 = `${wire.toComponentId}:${wire.toTerminalId}`;
    wiredTerms.add(k1);
    wiredTerms.add(k2);
    pushEdge(gndAdj, k1, k2, wire.id);
    pushEdge(hotAdj, k1, k2, wire.id);
    pushEdge(passiveTraceAdj, k1, k2, wire.id);
    pushEdge(acGndAdj, k1, k2, wire.id);
  }

  // First pass: switches, ground-lugs, and dead-short resistors (< 100 Ohm) into gndAdj
  for (const comp of components) {
    addSwitchAndGroundEdges(comp, (a, b) => {
      pushEdge(gndAdj, a, b);
      pushEdge(hotAdj, a, b);
      pushEdge(passiveTraceAdj, a, b);
      pushEdge(acGndAdj, a, b);
    });
    if (comp.type === 'resistor') {
      const rOhms = comp.properties.resistanceOhms ?? 150000;
      if (rOhms < SHORT_RESISTOR_THRESHOLD_OHMS) {
        pushEdge(gndAdj, `${comp.id}:lead-1`, `${comp.id}:lead-2`);
      }
    }
  }

  const connectedToGnd = getConnectedNodesSet(jackSleeve, gndAdj);
  const galvanicTipNodes = getConnectedNodesSet(jackTip, gndAdj);

  // Second pass: add pot tracks and series-eligible resistors/capacitors
  for (const comp of components) {
    addPotTrackEdges(comp, wiredTerms, connectedToGnd, (a, b) => {
      pushEdge(hotAdj, a, b);
    });
    addPotTrackEdges(comp, wiredTerms, null, (a, b) => {
      pushEdge(passiveTraceAdj, a, b);
    });

    if (comp.type === 'resistor' || comp.type === 'capacitor') {
      const l1 = `${comp.id}:lead-1`;
      const l2 = `${comp.id}:lead-2`;
      const l1Gnd = connectedToGnd.has(l1);
      const l2Gnd = connectedToGnd.has(l2);

      // Include in hotAdj ONLY if neither lead is directly grounded (so shunt load resistors
      // and grounded tone caps never bridge hot to ground, while series caps & resistors pass!)
      if (!l1Gnd && !l2Gnd) {
        pushEdge(hotAdj, l1, l2);
      }

      // Include in fallback acGndAdj ONLY if neither lead is on the direct jack-tip bus
      if (!galvanicTipNodes.has(l1) && !galvanicTipNodes.has(l2)) {
        pushEdge(acGndAdj, l1, l2);
      }
    }
  }

  const connectedToTip = getConnectedNodesSet(jackTip, hotAdj);

  const activeComponentIds = new Set<string>([jack.id]);
  const activeWireIds = new Set<string>();
  const activeTerminalKeys = new Set<string>([jackTip, jackSleeve]);
  const activePickupIdsSet = new Set<string>();
  const activeHumbuckerCoils: Record<string, { north: boolean; south: boolean }> = {};

  // Group active coils by pickup to highlight coils, hot/ground returns, and series junctions
  const coilsByPickup = new Map<string, CoilModel[]>();
  for (const coil of activeCoilModels) {
    activePickupIdsSet.add(coil.pickupId);
    activeComponentIds.add(coil.pickupId);
    if (!coilsByPickup.has(coil.pickupId)) coilsByPickup.set(coil.pickupId, []);
    coilsByPickup.get(coil.pickupId)!.push(coil);

    if (coil.pickupType === 'pickup-humbucker') {
      if (!activeHumbuckerCoils[coil.pickupId]) {
        activeHumbuckerCoils[coil.pickupId] = { north: false, south: false };
      }
      if (coil.bobbin === 'north') activeHumbuckerCoils[coil.pickupId].north = true;
      if (coil.bobbin === 'south') activeHumbuckerCoils[coil.pickupId].south = true;
    }
  }

  const addPathToActive = (p: { pathNodes: Set<string>; pathWireIds: Set<string> }) => {
    p.pathNodes.forEach((n) => activeTerminalKeys.add(n));
    p.pathWireIds.forEach((w) => activeWireIds.add(w));
  };

  // Track pickup-level terminals that aren't directly connected to Tip or Ground (inter-pickup series junctions)
  const seriesEndpointTerms: string[] = [];

  for (const [puId, coils] of coilsByPickup) {
    if (coils[0].pickupType === 'pickup-humbucker') {
      const nStart = `${puId}:north-start`;
      const nFin = `${puId}:north-finish`;
      const sFin = `${puId}:south-finish`;
      const sStart = `${puId}:south-start`;

      if (coils.length === 2) {
        const nFinReach = getConnectedNodesSet(nFin, hotAdj);
        const isInternalSeries =
          nFinReach.has(sFin) && !connectedToGnd.has(nFin) && !connectedToTip.has(nFin);

        if (isInternalSeries) {
          activeTerminalKeys.add(nStart);
          activeTerminalKeys.add(nFin);
          activeTerminalKeys.add(sFin);
          activeTerminalKeys.add(sStart);
          addPathToActive(findPathsBetween(nFin, sFin, hotAdj));

          for (const term of [nStart, sStart]) {
            if (connectedToTip.has(term)) {
              addPathToActive(findPathsBetween(jackTip, term, hotAdj));
            } else if (connectedToGnd.has(term)) {
              addPathToActive(findPathsBetween(jackSleeve, term, gndAdj));
            } else {
              seriesEndpointTerms.push(term);
            }
          }
          continue;
        }
      }

      // Parallel or split humbucker coils
      for (const coil of coils) {
        activeTerminalKeys.add(coil.posTerm);
        activeTerminalKeys.add(coil.negTerm);
        for (const term of [coil.posTerm, coil.negTerm]) {
          if (connectedToTip.has(term)) {
            addPathToActive(findPathsBetween(jackTip, term, hotAdj));
          } else if (connectedToGnd.has(term)) {
            addPathToActive(findPathsBetween(jackSleeve, term, gndAdj));
          } else {
            const acGndPath = findPathsBetween(jackSleeve, term, acGndAdj);
            if (acGndPath.pathNodes.size > 0) {
              addPathToActive(acGndPath);
            } else {
              seriesEndpointTerms.push(term);
            }
          }
        }
      }
    } else {
      const coil = coils[0];
      activeTerminalKeys.add(coil.posTerm);
      activeTerminalKeys.add(coil.negTerm);
      for (const term of [coil.posTerm, coil.negTerm]) {
        if (connectedToTip.has(term)) {
          addPathToActive(findPathsBetween(jackTip, term, hotAdj));
        } else if (connectedToGnd.has(term)) {
          addPathToActive(findPathsBetween(jackSleeve, term, gndAdj));
        } else {
          const acGndPath = findPathsBetween(jackSleeve, term, acGndAdj);
          if (acGndPath.pathNodes.size > 0) {
            addPathToActive(acGndPath);
          } else {
            seriesEndpointTerms.push(term);
          }
        }
      }
    }
  }

  // Trace inter-pickup series junctions between ungrounded/non-tip pickup endpoints
  for (let i = 0; i < seriesEndpointTerms.length; i++) {
    for (let j = i + 1; j < seriesEndpointTerms.length; j++) {
      const t1 = seriesEndpointTerms[i];
      const t2 = seriesEndpointTerms[j];
      const p = findPathsBetween(t1, t2, hotAdj);
      if (p.pathNodes.size > 0) {
        addPathToActive(p);
      }
    }
  }

  // Trace volume pot ground return paths (volume pot Lug 1 to ground)
  for (const comp of components) {
    if (
      comp.type === 'pot-standard' ||
      comp.type === 'pot-pushpull' ||
      comp.type === 'pot-stacked'
    ) {
      const gangs =
        comp.type === 'pot-stacked'
          ? [
              [`${comp.id}:a-lug-1`, `${comp.id}:a-lug-2`, `${comp.id}:a-lug-3`],
              [`${comp.id}:b-lug-1`, `${comp.id}:b-lug-2`, `${comp.id}:b-lug-3`],
            ]
          : [[`${comp.id}:lug-1`, `${comp.id}:lug-2`, `${comp.id}:lug-3`]];

      for (const [lug1, lug2, lug3] of gangs) {
        const isPotInHot = activeTerminalKeys.has(lug2) || activeTerminalKeys.has(lug3);
        if (isPotInHot) {
          activeComponentIds.add(comp.id);
          activeTerminalKeys.add(lug2);
          activeTerminalKeys.add(lug3);
          if (connectedToGnd.has(lug1)) {
            activeTerminalKeys.add(lug1);
            addPathToActive(findPathsBetween(jackSleeve, lug1, gndAdj));
          }
        }
      }
    }
  }

  // Trace shunt networks (tone caps, load resistors, tuned-split caps/resistors) and treble bleeds
  // using passiveTraceAdj (no internal cap/resistor jumps, so each passive part's two leads are distinct!)
  const gndViaPotNodes = getConnectedNodesSet(jackSleeve, passiveTraceAdj);

  for (const comp of components) {
    if (comp.type === 'capacitor' || comp.type === 'resistor') {
      const lead1 = `${comp.id}:lead-1`;
      const lead2 = `${comp.id}:lead-2`;

      // If already traced as an inline series component on the hot/ground path, skip shunt logic
      if (activeTerminalKeys.has(lead1) && activeTerminalKeys.has(lead2)) {
        activeComponentIds.add(comp.id);
        continue;
      }

      const lead1Reach = getConnectedNodesSet(lead1, passiveTraceAdj);
      const lead2Reach = getConnectedNodesSet(lead2, passiveTraceAdj);

      const lead1MatchingHot = Array.from(activeTerminalKeys).find(
        (tk) => !connectedToGnd.has(tk) && lead1Reach.has(tk)
      );
      const lead2MatchingHot = Array.from(activeTerminalKeys).find(
        (tk) => !connectedToGnd.has(tk) && lead2Reach.has(tk)
      );

      const lead1ReachesGnd = connectedToGnd.has(lead1) || (!lead1MatchingHot && gndViaPotNodes.has(lead1));
      const lead2ReachesGnd = connectedToGnd.has(lead2) || (!lead2MatchingHot && gndViaPotNodes.has(lead2));

      // Shunt network: Tone RC, load resistor to ground, or tuned-split cap/resistor to ground
      if ((lead1MatchingHot && lead2ReachesGnd) || (lead2MatchingHot && lead1ReachesGnd)) {
        activeComponentIds.add(comp.id);
        activeTerminalKeys.add(lead1);
        activeTerminalKeys.add(lead2);

        const hotSide = lead1MatchingHot ? lead1 : lead2;
        const gndSide = lead1MatchingHot ? lead2 : lead1;
        const matchingHot = lead1MatchingHot || lead2MatchingHot!;

        addPathToActive(findPathsBetween(matchingHot, hotSide, passiveTraceAdj));
        const gndPath = connectedToGnd.has(gndSide)
          ? findPathsBetween(jackSleeve, gndSide, gndAdj)
          : findPathsBetween(jackSleeve, gndSide, passiveTraceAdj);
        addPathToActive(gndPath);
      } else if (lead1MatchingHot && lead2MatchingHot && !connectedToGnd.has(lead1) && !connectedToGnd.has(lead2)) {
        // Treble bleed network: both leads connected across active hot terminals (e.g. Vol lug 3 & lug 2)
        activeComponentIds.add(comp.id);
        activeTerminalKeys.add(lead1);
        activeTerminalKeys.add(lead2);
        addPathToActive(findPathsBetween(lead1MatchingHot, lead1, passiveTraceAdj));
        addPathToActive(findPathsBetween(lead2MatchingHot, lead2, passiveTraceAdj));
      }
    }
  }

  // Include any component with active terminals or active wires connected to it
  for (const comp of components) {
    const hasActiveTerm = Array.from(activeTerminalKeys).some((tk) =>
      tk.startsWith(`${comp.id}:`)
    );
    const hasActiveWire = wires.some(
      (w) =>
        activeWireIds.has(w.id) &&
        (w.fromComponentId === comp.id || w.toComponentId === comp.id)
    );
    if (hasActiveTerm || hasActiveWire) {
      activeComponentIds.add(comp.id);
    }
  }

  return {
    activeComponentIds,
    activeWireIds,
    activeTerminalKeys,
    activePickupIds: Array.from(activePickupIdsSet),
    hasSignalPath: true,
    activeHumbuckerCoils,
  };
}

/**
 * Produces a stable signature representing the electrical and tonal output of a circuit configuration.
 */
export function getCircuitResultSignature(result: CircuitAnalysisResult): string {
  if (!result.hasOutputSignal) {
    return 'MUTED_NO_SIGNAL';
  }

  const isSolo = (result.activePickups || []).length <= 1;

  // For solo pickup, electrical phase (0 vs 180 deg) alone produces the identical audible tone,
  // while coil identities (e.g. North Slug vs South Screw bobbin) remain distinct single-coil tones.
  const coilKeys = (result.activeCoils || [])
    .map(
      (c) =>
        `${c.pickupId}_${c.coilName}_${c.magneticPolarity}_${isSolo ? 'SOLO' : c.electricalPhase}`
    )
    .sort()
    .join(';');

  const pickupKeys = (result.activePickups || [])
    .map((p) => p.id)
    .sort()
    .join(',');

  const phaseRelationship = isSolo ? 'solo' : result.phaseRelationship;
  const resK = Math.round((result.estimatedTotalResistanceK || 0) * 10) / 10;
  const indH = Math.round((result.estimatedTotalInductanceH || 0) * 100) / 100;
  const freqHz = Math.round((result.resonantFrequencyHz || 0) / 25) * 25;
  const qBucket = Math.round((result.qFactor || 1) * 5) / 5;

  // Detect significant bass-cut / series-cap high-pass tilt (100 Hz vs 1 kHz)
  let bassTiltBucket = 0;
  if (result.frequencyResponse && result.frequencyResponse.length > 0) {
    let db100 = 0;
    let db1000 = 0;
    let d100 = Infinity;
    let d1000 = Infinity;
    for (const pt of result.frequencyResponse) {
      if (Math.abs(pt.freq - 100) < d100) {
        d100 = Math.abs(pt.freq - 100);
        db100 = pt.db;
      }
      if (Math.abs(pt.freq - 1000) < d1000) {
        d1000 = Math.abs(pt.freq - 1000);
        db1000 = pt.db;
      }
    }
    const diff = db1000 - db100;
    if (diff > 2.5) {
      bassTiltBucket = Math.round(diff / 3) * 3;
    }
  }

  return [
    pickupKeys,
    coilKeys,
    phaseRelationship,
    result.wiringConfiguration,
    result.humStatus || (result.isHumCancelling ? 'cancelling' : 'present'),
    result.isCoilSplit ? 'SPLIT' : 'FULL',
    resK,
    indH,
    freqHz,
    qBucket,
    bassTiltBucket,
  ].join(':::');
}

/**
 * Evaluates all possible combinations of switches and push/pull pots
 * and generates a comprehensive switching analysis report with grouped don't-care combinations.
 */
export function analyzeAllSwitchingCombinations(state: CircuitState): SwitchingAnalysisReport {
  const { components, wires } = state;

  // Identify all switches
  const switches = components.filter(
    (c) =>
      c.type === 'switch-5way-blade' ||
      c.type === 'switch-3way-toggle' ||
      c.type === 'switch-3way-blade' ||
      c.type === 'switch-4way-blade' ||
      c.type === 'switch-superswitch' ||
      c.type === 'switch-dpdt-minitoggle'
  );

  // Identify all push-pull pots
  const pushPulls = components.filter((c) => c.type === 'pot-pushpull');

  function getSwitchOptions(comp: CircuitComponent): SwitchingControlOption[] {
    switch (comp.type) {
      case 'switch-5way-blade':
        return [
          { value: 0, label: 'Pos 1 (Bridge)' },
          { value: 1, label: 'Pos 2 (Bridge + Mid)' },
          { value: 2, label: 'Pos 3 (Middle)' },
          { value: 3, label: 'Pos 4 (Mid + Neck)' },
          { value: 4, label: 'Pos 5 (Neck)' },
        ];
      case 'switch-superswitch':
        return [
          { value: 0, label: 'Position 1' },
          { value: 1, label: 'Position 2' },
          { value: 2, label: 'Position 3' },
          { value: 3, label: 'Position 4' },
          { value: 4, label: 'Position 5' },
        ];
      case 'switch-3way-toggle':
        return [
          { value: 0, label: 'Bridge' },
          { value: 1, label: 'Both (Bridge + Neck)' },
          { value: 2, label: 'Neck' },
        ];
      case 'switch-3way-blade':
        return [
          { value: 0, label: 'Pos 1 (Bridge)' },
          { value: 1, label: 'Pos 2 (Middle / Both)' },
          { value: 2, label: 'Pos 3 (Neck)' },
        ];
      case 'switch-4way-blade':
        return [
          { value: 0, label: 'Pos 1 (Bridge Only)' },
          { value: 1, label: 'Pos 2 (Bridge + Neck Parallel)' },
          { value: 2, label: 'Pos 3 (Neck Only)' },
          { value: 3, label: 'Pos 4 (Bridge + Neck Series)' },
        ];
      case 'switch-dpdt-minitoggle':
        return [
          { value: 0, label: 'Norm / Down' },
          { value: 1, label: 'Alt / Up' },
        ];
      default:
        return [{ value: 0, label: 'Default' }];
    }
  }

  // Push-pull options
  const pushPullOptions: SwitchingControlOption[] = [
    { value: false, label: 'Down (Pushed)' },
    { value: true, label: 'Up (Pulled)' },
  ];

  // Build unified controls list
  const controls: SwitchingControlDef[] = [];
  for (const sw of switches) {
    controls.push({
      id: sw.id,
      name: sw.name,
      type: sw.type,
      isPushPull: false,
      options: getSwitchOptions(sw),
    });
  }
  for (const pp of pushPulls) {
    controls.push({
      id: pp.id,
      name: pp.name,
      type: pp.type,
      isPushPull: true,
      options: pushPullOptions,
    });
  }

  // Generate Cartesian product of all switch and push-pull configurations
  type ConfigAssignment = {
    assignment: number[];
    switches: { compId: string; compName: string; position: number; label: string }[];
    pushPulls: { compId: string; compName: string; pulledUp: boolean; label: string }[];
  };

  let configs: ConfigAssignment[] = [{ assignment: [], switches: [], pushPulls: [] }];

  for (let cIdx = 0; cIdx < controls.length; cIdx++) {
    const ctrl = controls[cIdx];
    const nextConfigs: ConfigAssignment[] = [];
    for (const prevCfg of configs) {
      for (let optIdx = 0; optIdx < ctrl.options.length; optIdx++) {
        const opt = ctrl.options[optIdx];
        if (ctrl.isPushPull) {
          nextConfigs.push({
            assignment: [...prevCfg.assignment, optIdx],
            switches: [...prevCfg.switches],
            pushPulls: [
              ...prevCfg.pushPulls,
              { compId: ctrl.id, compName: ctrl.name, pulledUp: Boolean(opt.value), label: opt.label },
            ],
          });
        } else {
          nextConfigs.push({
            assignment: [...prevCfg.assignment, optIdx],
            switches: [
              ...prevCfg.switches,
              { compId: ctrl.id, compName: ctrl.name, position: Number(opt.value), label: opt.label },
            ],
            pushPulls: [...prevCfg.pushPulls],
          });
        }
      }
    }
    configs = nextConfigs;
    if (configs.length > 128) break;
  }

  // If no switches or push-pulls exist, evaluate the single current state
  if (configs.length === 0 || controls.length === 0) {
    configs = [{ assignment: [], switches: [], pushPulls: [] }];
  }

  // Evaluate each combination
  const items: SwitchingCombinationReportItem[] = [];

  let minR = Infinity;
  let maxR = 0;
  let minF = Infinity;
  let maxF = 0;

  configs.forEach((cfg, index) => {
    const testComponents = components.map((c) => {
      const swMatch = cfg.switches.find((s) => s.compId === c.id);
      const ppMatch = cfg.pushPulls.find((p) => p.compId === c.id);
      if (swMatch || ppMatch) {
        return {
          ...c,
          properties: {
            ...c.properties,
            ...(swMatch ? { switchPosition: swMatch.position } : {}),
            ...(ppMatch ? { pulledUp: ppMatch.pulledUp } : {}),
          },
        };
      }
      return c;
    });

    const result = analyzeCircuit({ components: testComponents, wires });

    const isCurrent =
      cfg.switches.every((s) => {
        const c = components.find((comp) => comp.id === s.compId);
        return (c?.properties.switchPosition ?? 0) === s.position;
      }) &&
      cfg.pushPulls.every((p) => {
        const c = components.find((comp) => comp.id === p.compId);
        return !!c?.properties.pulledUp === p.pulledUp;
      });

    const labelParts: string[] = [];
    if (cfg.switches.length > 0) {
      labelParts.push(cfg.switches.map((s) => `${s.label}`).join(' + '));
    }
    if (cfg.pushPulls.length > 0) {
      labelParts.push(cfg.pushPulls.map((p) => `${p.compName}: ${p.label}`).join(' • '));
    }
    const combinationLabel = labelParts.length > 0 ? labelParts.join(' | ') : 'Standard Wiring State';

    const activePickupSummary =
      result.activePickups.length > 0
        ? result.activePickups.map((p) => p.name).join(' + ')
        : result.hasOutputSignal
        ? 'Active Circuit'
        : 'Muted / Open';

    const activeCoilsSummary =
      result.activeCoils.length > 0
        ? result.activeCoils.map((c) => `${c.pickupName} (${c.coilName})`).join(' + ')
        : 'None';

    let toneDescription = '';
    if (!result.hasOutputSignal) {
      toneDescription = 'Muted / Killswitch position (No output to jack)';
    } else {
      if (result.phaseRelationship === 'out-of-phase') {
        toneDescription = 'Peter Green blues honk: hollow acoustic mid scoop with vocal bite';
      } else if (result.wiringConfiguration === 'series') {
        toneDescription = 'High-output series boost: thick, punchy driving midrange';
      } else if (result.isCoilSplit) {
        toneDescription = 'Coil-split single bobbin: bright glass, crisp clarity, bell-like highs';
      } else if (result.wiringConfiguration === 'parallel' && result.activePickups.length > 1) {
        toneDescription = 'Classic parallel blend: open, airy chime with balanced dynamics';
      } else if (result.activePickups.some((p) => p.position === 'neck')) {
        toneDescription = 'Warm, smooth neck tone: round fundamental with soft highs';
      } else if (result.activePickups.some((p) => p.position === 'bridge')) {
        toneDescription = 'Bright, cutting bridge bite: strong harmonics with pick attack punch';
      } else {
        toneDescription = 'Full balanced guitar tone with clear articulation';
      }
    }

    if (result.hasOutputSignal) {
      const r = result.estimatedTotalResistanceK;
      if (r > 0) {
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
      }
      const f = result.resonantFrequencyHz;
      if (f > 0) {
        minF = Math.min(minF, f);
        maxF = Math.max(maxF, f);
      }
    }

    items.push({
      id: `comb-${index}`,
      combinationIndex: index + 1,
      combinationLabel,
      switchSettings: cfg.switches,
      pushPullSettings: cfg.pushPulls,
      isCurrentState: isCurrent,
      result,
      toneDescription,
      activePickupSummary,
      activeCoilsSummary,
    });
  });

  // --- MULTI-DIMENSIONAL REDUCTION FOR GROUPING EQUIVALENT COMBINATIONS ---
  interface ReductionNode {
    pattern: (number | null)[];
    resultSignature: string;
    items: SwitchingCombinationReportItem[];
  }

  let nodes: ReductionNode[] = [];
  const M = controls.length;

  if (M > 0) {
    nodes = items.map((item, idx) => ({
      pattern: configs[idx]?.assignment ? [...configs[idx].assignment] : [],
      resultSignature: getCircuitResultSignature(item.result),
      items: [item],
    }));

    let changed = true;
    let iteration = 0;
    const maxIterations = 20;

    while (changed && iteration < maxIterations) {
      changed = false;
      iteration++;

      for (let d = 0; d < M; d++) {
        const numOptions = controls[d].options.length;
        if (numOptions < 2) continue;

        const buckets = new Map<string, ReductionNode[]>();

        for (const node of nodes) {
          if (node.pattern[d] === null) {
            const soloKey = `__wildcard_iso_${d}_${Math.random()}`;
            buckets.set(soloKey, [node]);
            continue;
          }

          const otherDims: (string | number)[] = [];
          for (let k = 0; k < M; k++) {
            if (k !== d) {
              otherDims.push(node.pattern[k] === null ? '*' : node.pattern[k]!);
            }
          }
          const key = `${node.resultSignature}__${otherDims.join(':')}`;

          if (!buckets.has(key)) {
            buckets.set(key, []);
          }
          buckets.get(key)!.push(node);
        }

        const nextNodes: ReductionNode[] = [];

        for (const [, bucketNodes] of buckets) {
          if (bucketNodes.length === numOptions) {
            const optionIndices = new Set(bucketNodes.map((n) => n.pattern[d]));
            let allOptionsPresent = true;
            for (let opt = 0; opt < numOptions; opt++) {
              if (!optionIndices.has(opt)) {
                allOptionsPresent = false;
                break;
              }
            }

            if (allOptionsPresent) {
              changed = true;
              const mergedPattern = [...bucketNodes[0].pattern];
              mergedPattern[d] = null;

              const mergedItems: SwitchingCombinationReportItem[] = [];
              for (const bn of bucketNodes) {
                mergedItems.push(...bn.items);
              }

              nextNodes.push({
                pattern: mergedPattern,
                resultSignature: bucketNodes[0].resultSignature,
                items: mergedItems,
              });
              continue;
            }
          }

          for (const bn of bucketNodes) {
            nextNodes.push(bn);
          }
        }

        nodes = nextNodes;
      }
    }
  }

  // --- CONSOLIDATE REDUCTION NODES INTO TRULY DISTINCT TONAL STATES ---
  const signatureMap = new Map<
    string,
    {
      signature: string;
      items: SwitchingCombinationReportItem[];
      nodes: ReductionNode[];
    }
  >();

  for (const node of nodes) {
    if (!signatureMap.has(node.resultSignature)) {
      signatureMap.set(node.resultSignature, {
        signature: node.resultSignature,
        items: [],
        nodes: [],
      });
    }
    const entry = signatureMap.get(node.resultSignature)!;
    entry.items.push(...node.items);
    entry.nodes.push(node);
  }

  const activeEntries: {
    signature: string;
    items: SwitchingCombinationReportItem[];
    nodes: ReductionNode[];
  }[] = [];
  const mutedEntries: {
    signature: string;
    items: SwitchingCombinationReportItem[];
    nodes: ReductionNode[];
  }[] = [];

  for (const [sig, entry] of signatureMap.entries()) {
    if (sig === 'MUTED_NO_SIGNAL' || !entry.items[0]?.result.hasOutputSignal) {
      mutedEntries.push(entry);
    } else {
      activeEntries.push(entry);
    }
  }

  activeEntries.sort((a, b) => {
    const resA = a.items[0].result;
    const resB = b.items[0].result;
    const orderScore = (res: CircuitAnalysisResult) => {
      if (res.activePickups.length === 1) {
        if (res.activePickups[0].position === 'bridge') return 100 + (res.isCoilSplit ? 10 : 0);
        return 200 + (res.isCoilSplit ? 10 : 0);
      }
      if (res.wiringConfiguration === 'parallel') {
        return 300 + (res.phaseRelationship === 'out-of-phase' ? 50 : 0) + (res.isCoilSplit ? 10 : 0);
      }
      if (res.wiringConfiguration === 'series') {
        return 400 + (res.phaseRelationship === 'out-of-phase' ? 50 : 0) + (res.isCoilSplit ? 10 : 0);
      }
      return 500;
    };
    return orderScore(resA) - orderScore(resB);
  });

  const consolidatedEntries = [...activeEntries, ...mutedEntries];

  const groupedItems: GroupedSwitchingCombinationItem[] = consolidatedEntries.map((entry, gIdx) => {
    const isCurrentState = entry.items.some((it) => it.isCurrentState);
    const representativeItem =
      entry.items.find((it) => it.isCurrentState) || entry.items[0];

    const controlValues: GroupedControlValue[] = controls.map((ctrl) => {
      const optionIndices = new Set<number>();
      for (const item of entry.items) {
        if (ctrl.isPushPull) {
          const pp = item.pushPullSettings.find((p) => p.compId === ctrl.id);
          if (pp !== undefined) {
            const optIdx = ctrl.options.findIndex((o) => Boolean(o.value) === pp.pulledUp);
            if (optIdx >= 0) optionIndices.add(optIdx);
          }
        } else {
          const sw = item.switchSettings.find((s) => s.compId === ctrl.id);
          if (sw !== undefined) {
            const optIdx = ctrl.options.findIndex((o) => Number(o.value) === sw.position);
            if (optIdx >= 0) optionIndices.add(optIdx);
          }
        }
      }

      if (optionIndices.size === 1) {
        const singleOptIdx = Array.from(optionIndices)[0];
        const opt = ctrl.options[singleOptIdx];
        return {
          controlId: ctrl.id,
          controlName: ctrl.name,
          isWildcard: false,
          label: opt ? opt.label : 'Default',
          value: opt ? opt.value : undefined,
        };
      }

      return {
        controlId: ctrl.id,
        controlName: ctrl.name,
        isWildcard: true,
        label: '*',
      };
    });

    return {
      id: `group-${gIdx}`,
      groupIndex: gIdx + 1,
      controlValues,
      mergedCount: entry.items.length,
      rawItems: entry.items,
      representativeItem,
      isCurrentState,
      result: representativeItem.result,
      toneDescription: representativeItem.toneDescription,
      activePickupSummary: representativeItem.activePickupSummary,
      activeCoilsSummary: representativeItem.activeCoilsSummary,
    };
  });

  if (controls.length === 0 && items.length > 0) {
    const item = items[0];
    groupedItems.push({
      id: 'group-0',
      groupIndex: 1,
      controlValues: [],
      mergedCount: 1,
      rawItems: [item],
      representativeItem: item,
      isCurrentState: item.isCurrentState,
      result: item.result,
      toneDescription: item.toneDescription,
      activePickupSummary: item.activePickupSummary,
      activeCoilsSummary: item.activeCoilsSummary,
    });
  }

  let humCancellingCount = 0;
  let splitCoilCount = 0;
  let outOfPhaseCount = 0;
  let seriesCount = 0;
  let parallelCount = 0;
  let soloCount = 0;
  let mutedCount = 0;

  for (const item of items) {
    if (!item.result.hasOutputSignal) {
      mutedCount++;
    }
  }

  const activeGrouped = groupedItems.filter((g) => g.result.hasOutputSignal);
  for (const g of activeGrouped) {
    const res = g.result;
    if (res.phaseRelationship === 'out-of-phase') outOfPhaseCount++;
    if (res.wiringConfiguration === 'series') seriesCount++;
    if (res.isCoilSplit) splitCoilCount++;
    if (res.wiringConfiguration === 'parallel' && res.activePickups.length > 1) parallelCount++;
    else if (res.activePickups.length === 1) soloCount++;
    if (res.isHumCancelling) humCancellingCount++;
  }

  return {
    totalCombinations: items.length,
    distinctTonesCount: activeGrouped.length > 0 ? activeGrouped.length : groupedItems.length,
    switchesCount: switches.length,
    pushPullsCount: pushPulls.length,
    humCancellingCount,
    splitCoilCount,
    outOfPhaseCount,
    seriesCount,
    parallelCount,
    soloCount,
    mutedCount,
    resistanceRange: {
      min: minR === Infinity ? 0 : Math.round(minR * 10) / 10,
      max: Math.round(maxR * 10) / 10,
    },
    resonantFreqRange: {
      min: minF === Infinity ? 0 : minF,
      max: maxF,
    },
    controls,
    items,
    groupedItems,
  };
}
