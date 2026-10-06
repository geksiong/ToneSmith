import {
  ActiveCoilInfo,
  CircuitAnalysisResult,
  CircuitComponent,
  CircuitState,
  SignalPathInfo,
  Wire,
  SwitchingCombinationReportItem,
  SwitchingAnalysisReport,
  SwitchingControlDef,
  GroupedSwitchingCombinationItem,
  GroupedControlValue,
  SwitchingControlOption,
} from '../types/guitar';
import { getComponentTerminals } from './componentDefs';

interface GraphNode {
  componentId: string;
  terminalId: string;
}

function nodeKey(node: GraphNode): string {
  return `${node.componentId}:${node.terminalId}`;
}

export function analyzeCircuit(state: CircuitState): CircuitAnalysisResult {
  const { components, wires } = state;
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

  // Build adjacency list for wires and internal switch/pot connections
  const adj = new Map<string, Set<string>>();

  function addEdge(a: string, b: string) {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  }

  // Add wire connections
  for (const wire of wires) {
    const k1 = `${wire.fromComponentId}:${wire.fromTerminalId}`;
    const k2 = `${wire.toComponentId}:${wire.toTerminalId}`;
    addEdge(k1, k2);
  }

  // Add internal connections based on component states
  for (const comp of components) {
    addInternalComponentConnections(comp, addEdge);
  }

  const jackTip = `${jack.id}:tip`;
  const jackSleeve = `${jack.id}:sleeve`;

  // Find all nodes reachable from jack tip and jack sleeve
  const connectedToTip = getConnectedNodes(jackTip, adj);
  const connectedToGround = getConnectedNodes(jackSleeve, adj);

  // Check for short circuit
  if (connectedToTip.has(jackSleeve)) {
    issues.push('⚠ Short circuit detected: Jack Tip is directly connected to Ground.');
    return createSilentResult(issues);
  }

  // Find all pickups and determine which coils are active
  const activeCoils: ActiveCoilInfo[] = [];
  const activePickupsMap = new Map<string, { id: string; name: string; position?: string; type: any }>();

  // Candidates for series inter-pickup evaluation
  interface PickupCandidate {
    comp: CircuitComponent;
    leadA: string;
    leadB: string;
    rK: number;
    indH: number;
    isHumbucker: boolean;
    isSeriesLinked?: boolean;
    isCoilSplit?: boolean;
    splitCoilName?: string;
  }
  const pickupCandidates: PickupCandidate[] = [];

  // Check each pickup
  for (const comp of components) {
    if (comp.type === 'pickup-humbucker') {
      const humbuckerCoils = evaluateHumbucker(comp, connectedToTip, connectedToGround, adj);
      if (humbuckerCoils.length > 0) {
        activePickupsMap.set(comp.id, {
          id: comp.id,
          name: comp.name,
          position: comp.properties.pickupPosition,
          type: comp.type,
        });
        activeCoils.push(...humbuckerCoils);
      } else {
        const cid = comp.id;
        const nStart = `${cid}:north-start`;
        const nFin = `${cid}:north-finish`;
        const sFin = `${cid}:south-finish`;
        const sStart = `${cid}:south-start`;
        const nFinNeighbors = getConnectedNodes(nFin, adj);
        const isSeriesLinked = nFinNeighbors.has(sFin) && !connectedToGround.has(nFin) && !connectedToTip.has(nFin) && !nFinNeighbors.has(sStart) && !nFinNeighbors.has(nStart);
        const rK = comp.properties.dcResistanceK ?? 8.4;
        const indH = comp.properties.inductanceH ?? 4.2;
        if (isSeriesLinked) {
          pickupCandidates.push({
            comp,
            leadA: nStart,
            leadB: sStart,
            rK,
            indH,
            isHumbucker: true,
            isSeriesLinked: true,
          });
        } else {
          // Coil split candidates for humbuckers in series mode
          pickupCandidates.push({
            comp,
            leadA: nStart,
            leadB: nFin,
            rK: rK / 2,
            indH: indH / 2,
            isHumbucker: true,
            isCoilSplit: true,
            splitCoilName: 'North Slug Coil',
          });
          pickupCandidates.push({
            comp,
            leadA: sStart,
            leadB: sFin,
            rK: rK / 2,
            indH: indH / 2,
            isHumbucker: true,
            isCoilSplit: true,
            splitCoilName: 'South Screw Coil',
          });
        }
      }
    } else if (
      comp.type === 'pickup-singlecoil' ||
      comp.type === 'pickup-p90' ||
      comp.type === 'pickup-tele-bridge'
    ) {
      const coil = evaluateSingleCoil(comp, connectedToTip, connectedToGround, adj);
      if (coil) {
        activePickupsMap.set(comp.id, {
          id: comp.id,
          name: comp.name,
          position: comp.properties.pickupPosition,
          type: comp.type,
        });
        activeCoils.push(coil);
      } else {
        pickupCandidates.push({
          comp,
          leadA: `${comp.id}:hot`,
          leadB: `${comp.id}:ground`,
          rK: comp.properties.dcResistanceK ?? 6.2,
          indH: comp.properties.inductanceH ?? 2.8,
          isHumbucker: false,
        });
      }
    } else if (comp.type === 'pickup-tele-neck') {
      const coil = evaluateTeleNeck(comp, connectedToTip, connectedToGround, adj);
      if (coil) {
        activePickupsMap.set(comp.id, {
          id: comp.id,
          name: comp.name,
          position: comp.properties.pickupPosition,
          type: comp.type,
        });
        activeCoils.push(coil);
      } else {
        pickupCandidates.push({
          comp,
          leadA: `${comp.id}:hot`,
          leadB: `${comp.id}:ground`,
          rK: comp.properties.dcResistanceK ?? 7.4,
          indH: comp.properties.inductanceH ?? 2.6,
          isHumbucker: false,
        });
      }
    }
  }

  // Check for pairs of pickups connected in SERIES across Tip and Ground
  let isInterPickupSeries = false;
  if (activeCoils.length === 0 && pickupCandidates.length >= 2) {
    for (let i = 0; i < pickupCandidates.length; i++) {
      for (let j = 0; j < pickupCandidates.length; j++) {
        if (i === j) continue;
        const p1 = pickupCandidates[i];
        const p2 = pickupCandidates[j];
        if (p1.comp.id === p2.comp.id) continue;

        const p1Leads = [
          { tipLead: p1.leadA, juncLead: p1.leadB, reversed: false },
          { tipLead: p1.leadB, juncLead: p1.leadA, reversed: true },
        ];
        const p2Leads = [
          { juncLead: p2.leadA, gndLead: p2.leadB, reversed: false },
          { juncLead: p2.leadB, gndLead: p2.leadA, reversed: true },
        ];

        let matched = false;
        for (const l1 of p1Leads) {
          if (!connectedToTip.has(l1.tipLead)) continue;
          if (connectedToGround.has(l1.juncLead)) continue;

          for (const l2 of p2Leads) {
            if (!connectedToGround.has(l2.gndLead)) continue;
            if (connectedToGround.has(l2.juncLead)) continue;

            const juncReach = getConnectedNodes(l1.juncLead, adj);
            if (juncReach.has(l2.juncLead)) {
              isInterPickupSeries = true;
              matched = true;

              // Register p1
              activePickupsMap.set(p1.comp.id, {
                id: p1.comp.id,
                name: p1.comp.name,
                position: p1.comp.properties.pickupPosition,
                type: p1.comp.type,
              });
              if (p1.isHumbucker) {
                const isFlipped = !!p1.comp.properties.magnetFlipped;
                if (p1.isCoilSplit && p1.splitCoilName) {
                  const isNorth = p1.splitCoilName === 'North Slug Coil';
                  activeCoils.push({
                    pickupId: p1.comp.id,
                    pickupName: p1.comp.name,
                    coilName: p1.splitCoilName,
                    magneticPolarity: isNorth ? (isFlipped ? 'South' : 'North') : (isFlipped ? 'North' : 'South'),
                    electricalPhase: l1.reversed ? 'Reverse-Phase' : 'In-Phase',
                    dcResistanceK: p1.rK,
                    inductanceH: p1.indH,
                  });
                } else {
                  activeCoils.push(
                    {
                      pickupId: p1.comp.id,
                      pickupName: p1.comp.name,
                      coilName: 'North Slug Coil',
                      magneticPolarity: isFlipped ? 'South' : 'North',
                      electricalPhase: l1.reversed ? 'Reverse-Phase' : 'In-Phase',
                      dcResistanceK: p1.rK / 2,
                      inductanceH: p1.indH / 2,
                    },
                    {
                      pickupId: p1.comp.id,
                      pickupName: p1.comp.name,
                      coilName: 'South Screw Coil',
                      magneticPolarity: isFlipped ? 'North' : 'South',
                      electricalPhase: l1.reversed ? 'In-Phase' : 'Reverse-Phase',
                      dcResistanceK: p1.rK / 2,
                      inductanceH: p1.indH / 2,
                    }
                  );
                }
              } else {
                const isRwrp = !!p1.comp.properties.rwrp;
                activeCoils.push({
                  pickupId: p1.comp.id,
                  pickupName: p1.comp.name,
                  coilName: p1.comp.name,
                  magneticPolarity: isRwrp ? 'South' : 'North',
                  electricalPhase: l1.reversed ? (isRwrp ? 'In-Phase' : 'Reverse-Phase') : (isRwrp ? 'Reverse-Phase' : 'In-Phase'),
                  dcResistanceK: p1.rK,
                  inductanceH: p1.indH,
                });
              }

              // Register p2
              activePickupsMap.set(p2.comp.id, {
                id: p2.comp.id,
                name: p2.comp.name,
                position: p2.comp.properties.pickupPosition,
                type: p2.comp.type,
              });
              if (p2.isHumbucker) {
                const isFlipped = !!p2.comp.properties.magnetFlipped;
                if (p2.isCoilSplit && p2.splitCoilName) {
                  const isNorth = p2.splitCoilName === 'North Slug Coil';
                  activeCoils.push({
                    pickupId: p2.comp.id,
                    pickupName: p2.comp.name,
                    coilName: p2.splitCoilName,
                    magneticPolarity: isNorth ? (isFlipped ? 'South' : 'North') : (isFlipped ? 'North' : 'South'),
                    electricalPhase: l2.reversed ? 'Reverse-Phase' : 'In-Phase',
                    dcResistanceK: p2.rK,
                    inductanceH: p2.indH,
                  });
                } else {
                  activeCoils.push(
                    {
                      pickupId: p2.comp.id,
                      pickupName: p2.comp.name,
                      coilName: 'North Slug Coil',
                      magneticPolarity: isFlipped ? 'South' : 'North',
                      electricalPhase: l2.reversed ? 'Reverse-Phase' : 'In-Phase',
                      dcResistanceK: p2.rK / 2,
                      inductanceH: p2.indH / 2,
                    },
                    {
                      pickupId: p2.comp.id,
                      pickupName: p2.comp.name,
                      coilName: 'South Screw Coil',
                      magneticPolarity: isFlipped ? 'North' : 'South',
                      electricalPhase: l2.reversed ? 'In-Phase' : 'Reverse-Phase',
                      dcResistanceK: p2.rK / 2,
                      inductanceH: p2.indH / 2,
                    }
                  );
                }
              } else {
                const isRwrp = !!p2.comp.properties.rwrp;
                activeCoils.push({
                  pickupId: p2.comp.id,
                  pickupName: p2.comp.name,
                  coilName: p2.comp.name,
                  magneticPolarity: isRwrp ? 'South' : 'North',
                  electricalPhase: l2.reversed ? (isRwrp ? 'In-Phase' : 'Reverse-Phase') : (isRwrp ? 'Reverse-Phase' : 'In-Phase'),
                  dcResistanceK: p2.rK,
                  inductanceH: p2.indH,
                });
              }

              break;
            }
          }
          if (matched) break;
        }
        if (matched) break;
      }
      if (isInterPickupSeries) break;
    }
  }

  if (activeCoils.length === 0) {
    return createSilentResult([
      'No pickups currently connected to the output path. Check selector switch position or volume pot.',
    ]);
  }

  // Determine series vs parallel wiring configuration
  let wiringConfig: 'solo' | 'parallel' | 'series' | 'complex' | 'none' = 'solo';
  if (activeCoils.length === 1) {
    wiringConfig = 'solo';
  } else if (isInterPickupSeries) {
    wiringConfig = 'series';
  } else {
    // Check if coils are connected in series or parallel
    const isSeries = detectSeriesConfiguration(activeCoils, adj, connectedToGround, connectedToTip);
    wiringConfig = isSeries ? 'series' : 'parallel';
  }

  // Phase and Hum Cancellation Analysis
  let isHumCancelling = false;
  let humReason = '';
  let phaseRelationship: 'in-phase' | 'out-of-phase' | 'solo' | 'silent' = 'in-phase';

  if (activeCoils.length === 1) {
    isHumCancelling = false;
    humReason = 'Single coil active — susceptible to 60Hz ambient electromagnetic interference.';
    phaseRelationship = 'solo';
  } else if (activeCoils.length === 2) {
    const c1 = activeCoils[0];
    const c2 = activeCoils[1];

    // Hum Cancellation Condition:
    // Hum cancels if electrical phase is opposite (one CCW / reverse-wound, one CW / normal)
    const oppositeWinding = c1.electricalPhase !== c2.electricalPhase;
    const oppositeMagnets = c1.magneticPolarity !== c2.magneticPolarity;

    if (oppositeWinding) {
      isHumCancelling = true;
      humReason = 'Hum-cancelling active! Reverse-wound / opposite electrical polarity cancels 60Hz EMI.';
    } else {
      isHumCancelling = false;
      humReason = 'Both coils have matching electrical polarity — 60Hz hum is additive (not cancelled).';
    }

    // String Signal Phase Condition:
    // String vibration signal = (Magnetic Polarity) * (Electrical Phase)
    // +1 for North, -1 for South; +1 for In-Phase, -1 for Reverse-Phase
    const sign1 = (c1.magneticPolarity === 'North' ? 1 : -1) * (c1.electricalPhase === 'In-Phase' ? 1 : -1);
    const sign2 = (c2.magneticPolarity === 'North' ? 1 : -1) * (c2.electricalPhase === 'In-Phase' ? 1 : -1);

    if (sign1 * sign2 > 0) {
      phaseRelationship = 'in-phase';
    } else {
      phaseRelationship = 'out-of-phase';
      humReason += ' ⚡ Notice: Pickups are OUT OF PHASE (Peter Green hollow nasal acoustic cancellation).';
    }
  } else {
    // 3 or more coils (e.g. Strat pos 2/4 or dual humbuckers)
    const northCount = activeCoils.filter((c) => c.magneticPolarity === 'North').length;
    const southCount = activeCoils.filter((c) => c.magneticPolarity === 'South').length;
    const inPhaseCount = activeCoils.filter((c) => c.electricalPhase === 'In-Phase').length;
    const revPhaseCount = activeCoils.filter((c) => c.electricalPhase === 'Reverse-Phase').length;

    if (Math.abs(inPhaseCount - revPhaseCount) < activeCoils.length) {
      isHumCancelling = true;
      humReason = `Balanced multiple coil configuration reduces ambient hum (${northCount}N / ${southCount}S).`;
    } else {
      isHumCancelling = false;
      humReason = 'Unbalanced coils — residual 60Hz hum present.';
    }

    // Check if 2 distinct pickups are active (e.g. dual humbuckers) to evaluate acoustic phase
    const activePickupIds = Array.from(new Set(activeCoils.map((c) => c.pickupId)));
    if (activePickupIds.length === 2) {
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

      const sign1 = getPuSign(activePickupIds[0]);
      const sign2 = getPuSign(activePickupIds[1]);

      if (sign1 * sign2 < 0) {
        phaseRelationship = 'out-of-phase';
        humReason += ' ⚡ Notice: Pickups are OUT OF PHASE (Peter Green hollow nasal acoustic cancellation).';
      } else {
        phaseRelationship = 'in-phase';
      }
    } else {
      phaseRelationship = 'in-phase';
    }
  }

  // Calculate equivalent RLC electrical properties
  let totalL = 0;
  let totalR = 0;

  // Group active coils by pickup to compute per-pickup equivalent L and R
  const pickupCoilGroups = new Map<string, ActiveCoilInfo[]>();
  for (const coil of activeCoils) {
    if (!pickupCoilGroups.has(coil.pickupId)) {
      pickupCoilGroups.set(coil.pickupId, []);
    }
    pickupCoilGroups.get(coil.pickupId)!.push(coil);
  }

  // Calculate each pickup's L and R (internal coils in humbucker can be series, parallel, or split)
  const pickupEquivs: { L: number; R: number }[] = [];
  for (const [puId, pCoils] of pickupCoilGroups) {
    const pu = compMap.get(puId);
    let pL = 0;
    let pR = 0;
    if (pCoils.length === 1) {
      // Single active coil (e.g. Strat single-coil or Humbucker coil-split)
      pL = pCoils[0].inductanceH;
      pR = pCoils[0].dcResistanceK;
    } else if (pu?.type === 'pickup-humbucker') {
      const isInternalSeries = detectSeriesConfiguration(pCoils, adj, connectedToGround, connectedToTip);
      if (isInternalSeries) {
        // Coils in series: inductances and resistances add
        pL = pCoils.reduce((sum, c) => sum + c.inductanceH, 0);
        pR = pCoils.reduce((sum, c) => sum + c.dcResistanceK, 0);
      } else {
        // Coils in parallel: inductances and resistances in parallel
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
  }

  if (pickupEquivs.length === 1) {
    totalL = pickupEquivs[0].L;
    totalR = pickupEquivs[0].R;
  } else if (wiringConfig === 'series') {
    totalL = pickupEquivs.reduce((sum, p) => sum + p.L, 0);
    totalR = pickupEquivs.reduce((sum, p) => sum + p.R, 0);
  } else {
    // Parallel configuration between pickups
    const invL = pickupEquivs.reduce((sum, p) => sum + 1 / Math.max(0.1, p.L), 0);
    totalL = 1 / Math.max(0.001, invL);
    const invR = pickupEquivs.reduce((sum, p) => sum + 1 / Math.max(0.1, p.R), 0);
    totalR = 1 / Math.max(0.001, invR);
  }

  // Helper to build graph with optional component exclusion
  function buildAdjGraph(excludedCompId?: string) {
    const graph = new Map<string, Set<string>>();
    function addGEdge(a: string, b: string) {
      if (!graph.has(a)) graph.set(a, new Set());
      if (!graph.has(b)) graph.set(b, new Set());
      graph.get(a)!.add(b);
      graph.get(b)!.add(a);
    }
    for (const wire of wires) {
      addGEdge(`${wire.fromComponentId}:${wire.fromTerminalId}`, `${wire.toComponentId}:${wire.toTerminalId}`);
    }
    for (const comp of components) {
      if (comp.id === excludedCompId) continue;
      addInternalComponentConnections(comp, addGEdge);
    }
    return graph;
  }

  // Pure wire adjacency (physical external wires only, no component internal shortcuts)
  const wireAdj = new Map<string, Set<string>>();
  for (const wire of wires) {
    const k1 = `${wire.fromComponentId}:${wire.fromTerminalId}`;
    const k2 = `${wire.toComponentId}:${wire.toTerminalId}`;
    if (!wireAdj.has(k1)) wireAdj.set(k1, new Set());
    if (!wireAdj.has(k2)) wireAdj.set(k2, new Set());
    wireAdj.get(k1)!.add(k2);
    wireAdj.get(k2)!.add(k1);
  }
  function getWiredTerminals(startNode: string): Set<string> {
    const visited = new Set<string>();
    const queue = [startNode];
    visited.add(startNode);
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const nbs = wireAdj.get(curr);
      if (nbs) {
        for (const n of nbs) {
          if (!visited.has(n)) {
            visited.add(n);
            queue.push(n);
          }
        }
      }
    }
    return visited;
  }

  // Identify Active Volume Pots and Active Tone Pots
  const activeVolPotIds: string[] = [];
  const activeTonePotIds: string[] = [];
  const activeVolPots: { id: string; val: number; taper: string; rK: number }[] = [];
  const activeTonePots: { id: string; val: number; rK: number; capUf: number }[] = [];

  const pots = components.filter(
    (c) =>
      c.type === 'pot-standard' ||
      c.type === 'pot-pushpull' ||
      c.type === 'pot-stacked' ||
      c.type === 'pot-blend'
  );
  const caps = components.filter((c) => c.type === 'capacitor');

  for (const pot of pots) {
    const isStacked = pot.type === 'pot-stacked';
    const isBlend = pot.type === 'pot-blend';
    const lug1 = isStacked ? `${pot.id}:a-lug-1` : `${pot.id}:lug-1`;
    const lug2 = isStacked ? `${pot.id}:a-lug-2` : `${pot.id}:lug-2`;
    const lug3 = isStacked ? `${pot.id}:a-lug-3` : `${pot.id}:lug-3`;
    const potLugs = isStacked
      ? [lug1, lug2, lug3, `${pot.id}:b-lug-1`, `${pot.id}:b-lug-2`, `${pot.id}:b-lug-3`]
      : isBlend
      ? [
          `${pot.id}:a-in`,
          `${pot.id}:a-wiper`,
          `${pot.id}:a-ground`,
          `${pot.id}:a-gnd`,
          `${pot.id}:b-in`,
          `${pot.id}:b-wiper`,
          `${pot.id}:b-ground`,
          `${pot.id}:b-gnd`,
        ]
      : [lug1, lug2, lug3];

    // Check if this pot has a ground connection
    const isGrounded = isBlend
      ? connectedToGround.has(`${pot.id}:a-ground`) ||
        connectedToGround.has(`${pot.id}:b-ground`) ||
        connectedToGround.has(`${pot.id}:a-gnd`) ||
        connectedToGround.has(`${pot.id}:b-gnd`) ||
        connectedToGround.has(`${pot.id}:case-ground`)
      : connectedToGround.has(lug1) || connectedToGround.has(lug3);

    // Build graph without this pot's wiper/track connection
    const adjWithoutPot = buildAdjGraph(pot.id);
    const tipWithoutPot = getConnectedNodes(jackTip, adjWithoutPot);

    // Check if removing this pot breaks connection from an active pickup to jack tip
    let breaksActivePickup = false;
    for (const [puId] of activePickupsMap) {
      const pu = compMap.get(puId);
      if (!pu) continue;
      const hotTerm =
        pu.type === 'pickup-humbucker'
          ? (connectedToTip.has(`${pu.id}:north-start`) ? `${pu.id}:north-start` : `${pu.id}:south-start`)
          : (connectedToTip.has(`${pu.id}:hot`) ? `${pu.id}:hot` : `${pu.id}:ground`);
      if (connectedToTip.has(hotTerm) && !tipWithoutPot.has(hotTerm)) {
        breaksActivePickup = true;
        break;
      }
    }

    if (breaksActivePickup && (isGrounded || isBlend)) {
      // Active Volume / Blend Pot
      const val = pot.properties.currentValue ?? 1.0;
      const taper = pot.properties.taper ?? 'audio';
      const rK = pot.properties.resistanceK ?? 500;
      activeVolPotIds.push(pot.id);
      activeVolPots.push({ id: pot.id, val, taper, rK });
    } else {
      // Check if it's an Active Tone Pot (series RC shunt to ground off the active signal path)
      let isTone = false;
      let toneCapUf = 0.022;

      for (const cap of caps) {
        const capLead1 = `${cap.id}:lead-1`;
        const capLead2 = `${cap.id}:lead-2`;

        const capLead1Wired = getWiredTerminals(capLead1);
        const capLead2Wired = getWiredTerminals(capLead2);

        const cap1Gnd = connectedToGround.has(capLead1);
        const cap2Gnd = connectedToGround.has(capLead2);
        const cap1Tip = connectedToTip.has(capLead1);
        const cap2Tip = connectedToTip.has(capLead2);

        // Case A: Cap lead 2 grounded, Cap lead 1 wired to pot lug, other pot lug in tipWithoutPot (active hot path)
        if (cap2Gnd && !cap1Gnd) {
          const wiredToCap1 = potLugs.filter((l) => capLead1Wired.has(l));
          const otherLugsInTip = potLugs.filter((l) => !wiredToCap1.includes(l) && tipWithoutPot.has(l));
          if (wiredToCap1.length > 0 && otherLugsInTip.length > 0) {
            isTone = true;
            toneCapUf = cap.properties.capacitanceUf ?? 0.022;
            break;
          }
        }
        if (cap1Gnd && !cap2Gnd) {
          const wiredToCap2 = potLugs.filter((l) => capLead2Wired.has(l));
          const otherLugsInTip = potLugs.filter((l) => !wiredToCap2.includes(l) && tipWithoutPot.has(l));
          if (wiredToCap2.length > 0 && otherLugsInTip.length > 0) {
            isTone = true;
            toneCapUf = cap.properties.capacitanceUf ?? 0.022;
            break;
          }
        }

        // Case B: Cap lead 1 in tip, Cap lead 2 wired to pot lug, other pot lug grounded (e.g. Gibson '50s wiring)
        if (cap1Tip && !cap2Tip) {
          const wiredToCap2 = potLugs.filter((l) => capLead2Wired.has(l));
          const otherLugsInGnd = potLugs.filter((l) => !wiredToCap2.includes(l) && connectedToGround.has(l));
          if (wiredToCap2.length > 0 && otherLugsInGnd.length > 0) {
            isTone = true;
            toneCapUf = cap.properties.capacitanceUf ?? 0.022;
            break;
          }
        }
        if (cap2Tip && !cap1Tip) {
          const wiredToCap1 = potLugs.filter((l) => capLead1Wired.has(l));
          const otherLugsInGnd = potLugs.filter((l) => !wiredToCap1.includes(l) && connectedToGround.has(l));
          if (wiredToCap1.length > 0 && otherLugsInGnd.length > 0) {
            isTone = true;
            toneCapUf = cap.properties.capacitanceUf ?? 0.022;
            break;
          }
        }
      }

      if (isTone) {
        const val = pot.properties.currentValue ?? 1.0;
        const rK = pot.properties.resistanceK ?? 250;
        activeTonePotIds.push(pot.id);
        activeTonePots.push({ id: pot.id, val, rK, capUf: toneCapUf });
      }
    }
  }

  // Calculate Volume Attenuation from active volume pots only
  let volAttenuation = 1.0;
  if (activeVolPots.length > 0) {
    let minFactor = 1.0;
    for (const vp of activeVolPots) {
      let factor = vp.val;
      if (vp.taper === 'audio') {
        factor = Math.pow(vp.val, 2.5);
      } else if (vp.taper === 'reverse-audio') {
        factor = 1 - Math.pow(1 - vp.val, 2.5);
      }
      minFactor = Math.min(minFactor, factor);
    }
    volAttenuation = Math.max(0.001, minFactor);
  }

  // Calculate Tone Rolloff from active tone pots only (defaults to 20kHz wide open if no tone pot is active)
  let toneRolloffHz = 20000;
  if (activeTonePots.length > 0) {
    let minCutoff = 20000;
    for (const tp of activeTonePots) {
      if (tp.val < 1.0) {
        const capScaling = Math.sqrt(0.022 / Math.max(0.001, tp.capUf));
        const lowestHz = Math.round(Math.max(200, Math.min(800, 360 * capScaling)));
        const highestHz = 18000;
        const toneFactor = Math.pow(tp.val, 2.0);
        const cutoff = lowestHz + toneFactor * (highestHz - lowestHz);
        minCutoff = Math.min(minCutoff, cutoff);
      }
    }
    toneRolloffHz = minCutoff;
  }

  // Calculate total parallel AC loading resistance from ACTIVE pots and amp input (1M)
  let invLoadK = 1 / 1000; // 1M standard amp input
  for (const vp of activeVolPots) {
    invLoadK += 1 / Math.max(10, vp.rK);
  }
  for (const tp of activeTonePots) {
    invLoadK += 1 / Math.max(10, tp.rK);
  }
  const potLoadK = 1 / invLoadK;

  // Calculate pickup self-capacitances and mechanical/eddy-current damping
  let totalPickupCapPf = 0;
  let minDamping = 1.0;
  let isCoilSplit = false;

  for (const [puId, pCoils] of pickupCoilGroups) {
    const pu = compMap.get(puId);
    if (!pu) continue;
    const isSplit = pu.type === 'pickup-humbucker' && pCoils.length === 1;
    if (isSplit) isCoilSplit = true;
    const isParHumbucker =
      pu.type === 'pickup-humbucker' &&
      pCoils.length === 2 &&
      !detectSeriesConfiguration(pCoils, adj, connectedToGround, connectedToTip);

    if (pu.type === 'pickup-singlecoil') {
      totalPickupCapPf += pu.properties.capacitancePf ?? 95;
      minDamping = Math.min(minDamping, 1.0);
    } else if (pu.type === 'pickup-tele-neck') {
      totalPickupCapPf += pu.properties.capacitancePf ?? 120;
      minDamping = Math.min(minDamping, 0.65); // chrome-plated brass cover eddy current damping
    } else if (pu.type === 'pickup-tele-bridge') {
      totalPickupCapPf += pu.properties.capacitancePf ?? 105;
      minDamping = Math.min(minDamping, 0.88); // steel baseplate damping
    } else if (pu.type === 'pickup-p90') {
      totalPickupCapPf += pu.properties.capacitancePf ?? 130;
      minDamping = Math.min(minDamping, 0.90);
    } else if (pu.type === 'pickup-humbucker') {
      if (isSplit) {
        totalPickupCapPf += 80;
        minDamping = Math.min(minDamping, 0.95);
      } else if (isParHumbucker) {
        totalPickupCapPf += 160;
        minDamping = Math.min(minDamping, 0.92);
      } else {
        totalPickupCapPf += pu.properties.capacitancePf ?? 145;
        minDamping = Math.min(minDamping, 0.85);
      }
    }
  }

  // Resonant frequency calculation:
  // f0 = 1 / (2 * pi * sqrt(L * C))
  const cableCapPf = 450; // standard 10-foot guitar cable capacitance
  const strayCapPf = 40;  // control cavity and wiring capacitance
  const totalC_Pf = cableCapPf + strayCapPf + totalPickupCapPf;
  const totalC_Farads = totalC_Pf * 1e-12;
  const f0 = 1 / (2 * Math.PI * Math.sqrt(Math.max(0.01, totalL) * totalC_Farads));
  const resonantFrequencyHz = Math.round(Math.min(12000, Math.max(1200, f0)));

  // Physically accurate Q factor calculation:
  // Q = 1 / (R_coil / (w0 * L) + (w0 * L) / R_load) * minDamping
  const loadOhms = potLoadK * 1000;
  const w0 = 2 * Math.PI * resonantFrequencyHz;
  const coilDamping = (totalR * 1000) / Math.max(100, w0 * totalL);
  const potDamping = (w0 * totalL) / Math.max(1000, loadOhms);
  const rawQ = 1 / Math.max(0.12, coilDamping + potDamping);
  const qFactor = Math.min(7.0, Math.max(0.8, Math.round(rawQ * minDamping * 10) / 10));
  const peakBoostDb = Math.round(20 * Math.log10(Math.max(1.15, qFactor)) * 10) / 10;

  // Level offset: series humbucker / series pairs produce higher output EMF (+4dB),
  // split humbucker produces single bobbin output (-4.5dB)
  let gainOffsetDb = 0;
  if (wiringConfig === 'series') {
    gainOffsetDb = 4.0;
  } else if (isCoilSplit) {
    gainOffsetDb = -4.5;
  } else if (activeCoils.some((c) => c.coilName.includes('Parallel'))) {
    gainOffsetDb = -2.5;
  }

  return {
    hasOutputSignal: volAttenuation > 0.01,
    activePickups: Array.from(activePickupsMap.values()),
    activeCoils,
    wiringConfiguration: wiringConfig,
    phaseRelationship,
    isHumCancelling,
    humCancellingReason: humReason,
    estimatedTotalResistanceK: Math.round(totalR * 10) / 10,
    estimatedTotalInductanceH: Math.round(totalL * 10) / 10,
    resonantFrequencyHz,
    peakBoostDb,
    qFactor: Math.round(qFactor * 10) / 10,
    effectiveVolumeLevel: volAttenuation,
    effectiveToneCutoffHz: Math.round(toneRolloffHz),
    activeVolumePotIds: activeVolPotIds,
    activeTonePotIds: activeTonePotIds,
    circuitIssues: issues,
    loadResistanceK: Math.round(potLoadK * 10) / 10,
    totalCapacitancePf: Math.round(totalC_Pf),
    isCoilSplit,
    gainOffsetDb,
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

function addInternalComponentConnections(
  comp: CircuitComponent,
  addEdge: (a: string, b: string) => void
) {
  const cid = comp.id;

  switch (comp.type) {
    case 'pot-standard': {
      // Connect Lug 3 to Lug 2 (wiper) with variable resistance
      // Volume/tone pots at zero are still considered active circuit participants
      addEdge(`${cid}:lug-2`, `${cid}:lug-3`);
      break;
    }

    case 'pot-pushpull': {
      // Volume/tone pots at zero are still considered active circuit participants
      addEdge(`${cid}:lug-2`, `${cid}:lug-3`);
      // DPDT switch section
      const isPulled = !!comp.properties.pulledUp;
      if (isPulled) {
        // Pulled UP: C1 connects to 2, C2 connects to 4
        addEdge(`${cid}:sw-c1`, `${cid}:sw-2`);
        addEdge(`${cid}:sw-c2`, `${cid}:sw-4`);
      } else {
        // Pushed DOWN: C1 connects to 1, C2 connects to 3
        addEdge(`${cid}:sw-c1`, `${cid}:sw-1`);
        addEdge(`${cid}:sw-c2`, `${cid}:sw-3`);
      }
      break;
    }

    case 'pot-stacked': {
      addEdge(`${cid}:a-lug-2`, `${cid}:a-lug-3`);
      addEdge(`${cid}:b-lug-2`, `${cid}:b-lug-3`);
      break;
    }

    case 'pot-blend': {
      addEdge(`${cid}:a-in`, `${cid}:a-wiper`);
      addEdge(`${cid}:b-in`, `${cid}:b-wiper`);
      break;
    }

    case 'switch-3way-toggle': {
      const pos = comp.properties.switchPosition ?? 1; // 0=Bridge, 1=Both, 2=Neck
      if (pos === 0 || pos === 1) {
        addEdge(`${cid}:sw-bridge`, `${cid}:sw-output`);
      }
      if (pos === 2 || pos === 1) {
        addEdge(`${cid}:sw-neck`, `${cid}:sw-output`);
      }
      break;
    }

    case 'switch-5way-blade': {
      const pos = comp.properties.switchPosition ?? 0;
      // Pos 0: Neck (Throw 1)
      // Pos 1: Neck + Mid (Throws 1 & 2)
      // Pos 2: Mid (Throw 2)
      // Pos 3: Mid + Bridge (Throws 2 & 3)
      // Pos 4: Bridge (Throw 3)
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
      // Pos 0: Neck (1), Pos 1: Neck & Bridge (1 & 3), Pos 2: Bridge (3)
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
      // 0: Bridge, 1: Parallel, 2: Neck, 3: Series
      addEdge(`${cid}:p1-c`, `${cid}:p1-${pos + 1}`);
      addEdge(`${cid}:p2-c`, `${cid}:p2-${pos + 1}`);
      break;
    }

    case 'switch-superswitch': {
      const pos = comp.properties.switchPosition ?? 0; // 0 to 4
      const throwNum = pos + 1;
      addEdge(`${cid}:pa-c`, `${cid}:pa-${throwNum}`);
      addEdge(`${cid}:pb-c`, `${cid}:pb-${throwNum}`);
      addEdge(`${cid}:pc-c`, `${cid}:pc-${throwNum}`);
      addEdge(`${cid}:pd-c`, `${cid}:pd-${throwNum}`);
      break;
    }

    case 'switch-dpdt-minitoggle': {
      const pos = comp.properties.switchPosition ?? 0; // 0=down, 1=up
      if (pos === 0) {
        addEdge(`${cid}:sw-c1`, `${cid}:sw-2`);
        addEdge(`${cid}:sw-c2`, `${cid}:sw-4`);
      } else {
        addEdge(`${cid}:sw-c1`, `${cid}:sw-1`);
        addEdge(`${cid}:sw-c2`, `${cid}:sw-3`);
      }
      break;
    }

    case 'ground-lug': {
      // All ground lugs internally connected
      addEdge(`${cid}:gnd-1`, `${cid}:gnd-2`);
      addEdge(`${cid}:gnd-2`, `${cid}:gnd-3`);
      addEdge(`${cid}:gnd-3`, `${cid}:gnd-bridge`);
      break;
    }

    case 'capacitor': {
      // Capacitors block DC and are reactive audio filter components.
      // Do not add a galvanic connection between leads; doing so shorts tone circuits to ground.
      break;
    }

    case 'resistor': {
      // Connect both leads internally for audio AC continuity
      addEdge(`${cid}:lead-1`, `${cid}:lead-2`);
      break;
    }
  }
}

function getConnectedNodes(startNode: string, adj: Map<string, Set<string>>): Set<string> {
  const visited = new Set<string>();
  const queue = [startNode];
  visited.add(startNode);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adj.get(current);
    if (neighbors) {
      for (const next of neighbors) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
  }

  return visited;
}

function evaluateHumbucker(
  comp: CircuitComponent,
  connectedToTip: Set<string>,
  connectedToGround: Set<string>,
  adj: Map<string, Set<string>>
): ActiveCoilInfo[] {
  const active: ActiveCoilInfo[] = [];
  const cid = comp.id;
  const isFlipped = !!comp.properties.magnetFlipped;
  const rK = comp.properties.dcResistanceK ?? 8.4;
  const indH = comp.properties.inductanceH ?? 4.2;

  const nStart = `${cid}:north-start`;
  const nFinish = `${cid}:north-finish`;
  const sFinish = `${cid}:south-finish`;
  const sStart = `${cid}:south-start`;

  // Standard humbucker: North coil (nStart to nFinish), South coil (sFinish to sStart)
  // Check if North Coil is in active circuit
  const nStartTip = connectedToTip.has(nStart);
  const nStartGnd = connectedToGround.has(nStart);
  const nFinishTip = connectedToTip.has(nFinish);
  const nFinishGnd = connectedToGround.has(nFinish);

  // Check South Coil
  const sFinishTip = connectedToTip.has(sFinish);
  const sFinishGnd = connectedToGround.has(sFinish);
  const sStartTip = connectedToTip.has(sStart);
  const sStartGnd = connectedToGround.has(sStart);

  // Check series link: nFinish connected to sFinish
  const nFinishNeighbors = getConnectedNodes(nFinish, adj);
  const isSeriesLinked = nFinishNeighbors.has(sFinish);

  // Case 1: Standard Series Humbucker
  // nStart goes to Tip, sStart goes to Gnd, nFinish connected to sFinish (and not shunted)
  if (
    isSeriesLinked &&
    !nFinishNeighbors.has(`${comp.id}:bare-shield`) &&
    !connectedToGround.has(nFinish) &&
    !connectedToTip.has(nFinish) &&
    ((nStartTip && sStartGnd) || (nStartGnd && sStartTip))
  ) {
    const isReversed = nStartGnd && sStartTip;
    active.push({
      pickupId: comp.id,
      pickupName: comp.name,
      coilName: 'North Slug Coil',
      magneticPolarity: isFlipped ? 'South' : 'North',
      electricalPhase: isReversed ? 'Reverse-Phase' : 'In-Phase',
      dcResistanceK: rK / 2,
      inductanceH: indH / 2,
    });
    active.push({
      pickupId: comp.id,
      pickupName: comp.name,
      coilName: 'South Screw Coil',
      magneticPolarity: isFlipped ? 'North' : 'South',
      electricalPhase: isReversed ? 'In-Phase' : 'Reverse-Phase',
      dcResistanceK: rK / 2,
      inductanceH: indH / 2,
    });
    return active;
  }

  // Case 2: Coil Split or Parallel to North Coil
  const isNorthActive = (nStartTip && nFinishGnd) || (nStartGnd && nFinishTip);
  const isSouthActive =
    (sFinishTip && sStartGnd) ||
    (sFinishGnd && sStartTip) ||
    (sStartTip && sFinishGnd) ||
    (sStartGnd && sFinishTip);

  const isParallelCoils = isNorthActive && isSouthActive && !isSeriesLinked;

  if (isNorthActive) {
    active.push({
      pickupId: comp.id,
      pickupName: comp.name,
      coilName: isParallelCoils
        ? 'North Slug Coil (Parallel)'
        : isSeriesLinked
        ? 'North Slug Coil'
        : 'North Slug Coil (Coil-Split)',
      magneticPolarity: isFlipped ? 'South' : 'North',
      electricalPhase: nStartTip ? 'In-Phase' : 'Reverse-Phase',
      dcResistanceK: rK / 2,
      inductanceH: indH / 2,
    });
  }

  // Case 3: Coil Split or Parallel to South Coil
  if (isSouthActive) {
    active.push({
      pickupId: comp.id,
      pickupName: comp.name,
      coilName: isParallelCoils
        ? 'South Screw Coil (Parallel)'
        : isSeriesLinked
        ? 'South Screw Coil'
        : 'South Screw Coil (Coil-Split)',
      magneticPolarity: isFlipped ? 'North' : 'South',
      electricalPhase: sFinishTip || sStartGnd ? 'Reverse-Phase' : 'In-Phase',
      dcResistanceK: rK / 2,
      inductanceH: indH / 2,
    });
  }

  return active;
}

function evaluateSingleCoil(
  comp: CircuitComponent,
  connectedToTip: Set<string>,
  connectedToGround: Set<string>,
  adj: Map<string, Set<string>>
): ActiveCoilInfo | null {
  const cid = comp.id;
  const hot = `${cid}:hot`;
  const gnd = `${cid}:ground`;
  const isRwrp = !!comp.properties.rwrp;
  const rK = comp.properties.dcResistanceK ?? 6.2;
  const indH = comp.properties.inductanceH ?? 2.8;

  const hotInTip = connectedToTip.has(hot);
  const hotInGnd = connectedToGround.has(hot);
  const gndInTip = connectedToTip.has(gnd);
  const gndInGnd = connectedToGround.has(gnd);

  if (hotInTip && gndInGnd) {
    return {
      pickupId: comp.id,
      pickupName: comp.name,
      coilName: isRwrp ? 'Single Coil (RWRP)' : 'Single Coil',
      magneticPolarity: isRwrp ? 'South' : 'North',
      electricalPhase: isRwrp ? 'Reverse-Phase' : 'In-Phase',
      dcResistanceK: rK,
      inductanceH: indH,
    };
  }

  if (hotInGnd && gndInTip) {
    // Reverse connected
    return {
      pickupId: comp.id,
      pickupName: comp.name,
      coilName: isRwrp ? 'Single Coil (RWRP Rev)' : 'Single Coil (Phase Inverted)',
      magneticPolarity: isRwrp ? 'South' : 'North',
      electricalPhase: isRwrp ? 'In-Phase' : 'Reverse-Phase',
      dcResistanceK: rK,
      inductanceH: indH,
    };
  }

  return null;
}

function evaluateTeleNeck(
  comp: CircuitComponent,
  connectedToTip: Set<string>,
  connectedToGround: Set<string>,
  adj: Map<string, Set<string>>
): ActiveCoilInfo | null {
  const cid = comp.id;
  const hot = `${cid}:hot`;
  const gnd = `${cid}:ground`;
  const rK = comp.properties.dcResistanceK ?? 7.4;
  const indH = comp.properties.inductanceH ?? 2.6;

  const hotInTip = connectedToTip.has(hot);
  const gndInGnd = connectedToGround.has(gnd);

  if (hotInTip && gndInGnd) {
    return {
      pickupId: comp.id,
      pickupName: comp.name,
      coilName: 'Tele Neck (Chrome Shielded)',
      magneticPolarity: 'North',
      electricalPhase: 'In-Phase',
      dcResistanceK: rK,
      inductanceH: indH,
    };
  }

  return null;
}

function detectSeriesConfiguration(
  coils: ActiveCoilInfo[],
  adj: Map<string, Set<string>>,
  connectedToGround: Set<string>,
  connectedToTip?: Set<string>
): boolean {
  if (coils.length < 2) return false;
  const uniquePickups = new Set(coils.map((c) => c.pickupId));
  // A single humbucker with its two internal coils in series
  if (uniquePickups.size === 1 && coils.length === 2) {
    const puId = coils[0].pickupId;
    const nFin = `${puId}:north-finish`;
    const sFin = `${puId}:south-finish`;
    const nFinNeighbors = getConnectedNodes(nFin, adj);
    return (
      nFinNeighbors.has(sFin) &&
      !connectedToGround.has(nFin) &&
      (!connectedToTip || !connectedToTip.has(nFin))
    );
  }
  return false;
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

function addHotInternalConnections(
  comp: CircuitComponent,
  addEdge: (a: string, b: string) => void
) {
  const cid = comp.id;

  switch (comp.type) {
    case 'pot-standard': {
      // Connect Lug 3 to Lug 2 (wiper) regardless of pot value (active at 0)
      addEdge(`${cid}:lug-2`, `${cid}:lug-3`);
      break;
    }
    case 'pot-pushpull': {
      addEdge(`${cid}:lug-2`, `${cid}:lug-3`);
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
    case 'pot-stacked': {
      addEdge(`${cid}:a-lug-2`, `${cid}:a-lug-3`);
      addEdge(`${cid}:b-lug-2`, `${cid}:b-lug-3`);
      break;
    }
    case 'pot-blend': {
      addEdge(`${cid}:a-in`, `${cid}:a-wiper`);
      addEdge(`${cid}:b-in`, `${cid}:b-wiper`);
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
    case 'capacitor': {
      break;
    }
    case 'resistor': {
      addEdge(`${cid}:lead-1`, `${cid}:lead-2`);
      break;
    }
  }
}

function addGndInternalConnections(
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
    case 'switch-3way-toggle': {
      const pos = comp.properties.switchPosition ?? 1;
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
    case 'capacitor': {
      break;
    }
    case 'resistor': {
      addEdge(`${cid}:lead-1`, `${cid}:lead-2`);
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

  const hotAdj = new Map<string, EdgeWithWire[]>();
  const gndAdj = new Map<string, EdgeWithWire[]>();

  function addHotEdge(a: string, b: string, wireId?: string) {
    if (!hotAdj.has(a)) hotAdj.set(a, []);
    if (!hotAdj.has(b)) hotAdj.set(b, []);
    hotAdj.get(a)!.push({ neighbor: b, wireId });
    hotAdj.get(b)!.push({ neighbor: a, wireId });
  }

  function addGndEdge(a: string, b: string, wireId?: string) {
    if (!gndAdj.has(a)) gndAdj.set(a, []);
    if (!gndAdj.has(b)) gndAdj.set(b, []);
    gndAdj.get(a)!.push({ neighbor: b, wireId });
    gndAdj.get(b)!.push({ neighbor: a, wireId });
  }

  // Add all physical circuit wires
  for (const wire of wires) {
    const k1 = `${wire.fromComponentId}:${wire.fromTerminalId}`;
    const k2 = `${wire.toComponentId}:${wire.toTerminalId}`;
    addHotEdge(k1, k2, wire.id);
    addGndEdge(k1, k2, wire.id);
  }

  // Add internal connections based on switch positions and pot tracks
  for (const comp of components) {
    addHotInternalConnections(comp, (a, b) => addHotEdge(a, b));
    addGndInternalConnections(comp, (a, b) => addGndEdge(a, b));
  }

  const connectedToTip = getConnectedNodesSet(jackTip, hotAdj);
  const connectedToGnd = getConnectedNodesSet(jackSleeve, gndAdj);

  // Short circuit check
  const isShort = connectedToTip.has(jackSleeve);

  // Find all pickups with completed closed electrical circuits
  interface ActivePickupRecord {
    compId: string;
    hotTerm: string;
    gndTerm: string;
    seriesLinks?: [string, string];
    seriesJunction?: [string, string];
  }
  const activePickups: ActivePickupRecord[] = [];
  const activeHumbuckerCoils: Record<string, { north: boolean; south: boolean }> = {};

  for (const comp of components) {
    const cid = comp.id;
    if (
      comp.type === 'pickup-singlecoil' ||
      comp.type === 'pickup-p90' ||
      comp.type === 'pickup-tele-bridge' ||
      comp.type === 'pickup-tele-neck'
    ) {
      const hot = `${cid}:hot`;
      const gnd = `${cid}:ground`;
      if (connectedToTip.has(hot) && connectedToGnd.has(gnd)) {
        activePickups.push({ compId: comp.id, hotTerm: hot, gndTerm: gnd });
      } else if (connectedToTip.has(gnd) && connectedToGnd.has(hot)) {
        activePickups.push({ compId: comp.id, hotTerm: gnd, gndTerm: hot });
      }
    } else if (comp.type === 'pickup-humbucker') {
      const nStart = `${cid}:north-start`;
      const nFin = `${cid}:north-finish`;
      const sFin = `${cid}:south-finish`;
      const sStart = `${cid}:south-start`;

      const nFinReachable = getConnectedNodesSet(nFin, hotAdj);
      const isSeriesLinked = nFinReachable.has(sFin) && !connectedToGnd.has(nFin) && !connectedToTip.has(nFin);

      if (isSeriesLinked && connectedToTip.has(nStart) && connectedToGnd.has(sStart)) {
        activePickups.push({
          compId: comp.id,
          hotTerm: nStart,
          gndTerm: sStart,
          seriesLinks: [nFin, sFin],
        });
        activeHumbuckerCoils[comp.id] = { north: true, south: true };
      } else if (isSeriesLinked && connectedToTip.has(sStart) && connectedToGnd.has(nStart)) {
        activePickups.push({
          compId: comp.id,
          hotTerm: sStart,
          gndTerm: nStart,
          seriesLinks: [nFin, sFin],
        });
        activeHumbuckerCoils[comp.id] = { north: true, south: true };
      } else {
        const isNorthActive =
          (connectedToTip.has(nStart) && connectedToGnd.has(nFin)) ||
          (connectedToTip.has(nFin) && connectedToGnd.has(nStart));
        const isSouthActive =
          (connectedToTip.has(sFin) && connectedToGnd.has(sStart)) ||
          (connectedToTip.has(sStart) && connectedToGnd.has(sFin));

        if (isNorthActive) {
          const hotTerm = connectedToTip.has(nStart) ? nStart : nFin;
          const gndTerm = connectedToTip.has(nStart) ? nFin : nStart;
          activePickups.push({ compId: comp.id, hotTerm, gndTerm });
        }
        if (isSouthActive) {
          const hotTerm = connectedToTip.has(sFin) ? sFin : sStart;
          const gndTerm = connectedToTip.has(sFin) ? sStart : sFin;
          activePickups.push({ compId: comp.id, hotTerm, gndTerm });
        }
        activeHumbuckerCoils[comp.id] = { north: isNorthActive, south: isSouthActive };
      }
    }
  }

  // Check for pairs of pickups connected in SERIES across Tip and Ground
  if (activePickups.length === 0) {
    interface PathCandidate {
      comp: CircuitComponent;
      leadA: string;
      leadB: string;
      isHumbucker: boolean;
    }
    const pathCandidates: PathCandidate[] = [];
    for (const comp of components) {
      if (comp.type === 'pickup-humbucker') {
        const cid = comp.id;
        const nStart = `${cid}:north-start`;
        const nFin = `${cid}:north-finish`;
        const sFin = `${cid}:south-finish`;
        const sStart = `${cid}:south-start`;
        const nFinReachable = getConnectedNodesSet(nFin, hotAdj);
        if (nFinReachable.has(sFin) && !connectedToGnd.has(nFin) && !connectedToTip.has(nFin)) {
          pathCandidates.push({ comp, leadA: nStart, leadB: sStart, isHumbucker: true });
        }
      } else if (
        comp.type === 'pickup-singlecoil' ||
        comp.type === 'pickup-p90' ||
        comp.type === 'pickup-tele-bridge' ||
        comp.type === 'pickup-tele-neck'
      ) {
        pathCandidates.push({ comp, leadA: `${comp.id}:hot`, leadB: `${comp.id}:ground`, isHumbucker: false });
      }
    }

    if (pathCandidates.length >= 2) {
      for (let i = 0; i < pathCandidates.length; i++) {
        for (let j = 0; j < pathCandidates.length; j++) {
          if (i === j) continue;
          const p1 = pathCandidates[i];
          const p2 = pathCandidates[j];

          const p1Leads = [
            { tipLead: p1.leadA, juncLead: p1.leadB },
            { tipLead: p1.leadB, juncLead: p1.leadA },
          ];
          const p2Leads = [
            { juncLead: p2.leadA, gndLead: p2.leadB },
            { juncLead: p2.leadB, gndLead: p2.leadA },
          ];

          let found = false;
          for (const l1 of p1Leads) {
            if (!connectedToTip.has(l1.tipLead)) continue;
            if (connectedToGnd.has(l1.juncLead)) continue;

            for (const l2 of p2Leads) {
              if (!connectedToGnd.has(l2.gndLead)) continue;
              if (connectedToGnd.has(l2.juncLead)) continue;

              const juncReach = getConnectedNodesSet(l1.juncLead, hotAdj);
              if (juncReach.has(l2.juncLead)) {
                found = true;
                activePickups.push({
                  compId: p1.comp.id,
                  hotTerm: l1.tipLead,
                  gndTerm: l1.juncLead,
                  seriesLinks: p1.isHumbucker ? [`${p1.comp.id}:north-finish`, `${p1.comp.id}:south-finish`] : undefined,
                  seriesJunction: [l1.juncLead, l2.juncLead],
                });
                if (p1.isHumbucker) {
                  activeHumbuckerCoils[p1.comp.id] = { north: true, south: true };
                }

                activePickups.push({
                  compId: p2.comp.id,
                  hotTerm: l2.juncLead,
                  gndTerm: l2.gndLead,
                  seriesLinks: p2.isHumbucker ? [`${p2.comp.id}:north-finish`, `${p2.comp.id}:south-finish`] : undefined,
                });
                if (p2.isHumbucker) {
                  activeHumbuckerCoils[p2.comp.id] = { north: true, south: true };
                }
                break;
              }
            }
            if (found) break;
          }
          if (found) break;
        }
        if (activePickups.length > 0) break;
      }
    }
  }

  if (activePickups.length === 0 || isShort) {
    return {
      activeComponentIds: new Set<string>([jack.id]),
      activeWireIds: new Set<string>(),
      activeTerminalKeys: new Set<string>([jackTip, jackSleeve]),
      activePickupIds: [],
      hasSignalPath: false,
      activeHumbuckerCoils: {},
    };
  }

  const activeComponentIds = new Set<string>([jack.id]);
  const activeWireIds = new Set<string>();
  const activeTerminalKeys = new Set<string>([jackTip, jackSleeve]);
  const activePickupIds: string[] = [];

  // Trace hot and ground paths for every active pickup
  for (const ap of activePickups) {
    activePickupIds.push(ap.compId);
    activeComponentIds.add(ap.compId);
    activeTerminalKeys.add(ap.hotTerm);
    activeTerminalKeys.add(ap.gndTerm);

    const hotPath = findPathsBetween(jackTip, ap.hotTerm, hotAdj);
    hotPath.pathNodes.forEach((n) => activeTerminalKeys.add(n));
    hotPath.pathWireIds.forEach((w) => activeWireIds.add(w));

    const gndPath = findPathsBetween(jackSleeve, ap.gndTerm, gndAdj);
    gndPath.pathNodes.forEach((n) => activeTerminalKeys.add(n));
    gndPath.pathWireIds.forEach((w) => activeWireIds.add(w));

    if (ap.seriesLinks) {
      activeTerminalKeys.add(ap.seriesLinks[0]);
      activeTerminalKeys.add(ap.seriesLinks[1]);
      const seriesPath = findPathsBetween(ap.seriesLinks[0], ap.seriesLinks[1], hotAdj);
      seriesPath.pathNodes.forEach((n) => activeTerminalKeys.add(n));
      seriesPath.pathWireIds.forEach((w) => activeWireIds.add(w));
    }

    if (ap.seriesJunction) {
      activeTerminalKeys.add(ap.seriesJunction[0]);
      activeTerminalKeys.add(ap.seriesJunction[1]);
      const junctionPath = findPathsBetween(ap.seriesJunction[0], ap.seriesJunction[1], hotAdj);
      junctionPath.pathNodes.forEach((n) => activeTerminalKeys.add(n));
      junctionPath.pathWireIds.forEach((w) => activeWireIds.add(w));
    }
  }

  // Trace volume pot ground return paths (volume pot Lug 1 to ground)
  for (const comp of components) {
    if (
      comp.type === 'pot-standard' ||
      comp.type === 'pot-pushpull' ||
      comp.type === 'pot-stacked'
    ) {
      const lug1 = comp.type === 'pot-stacked' ? `${comp.id}:a-lug-1` : `${comp.id}:lug-1`;
      const lug2 = comp.type === 'pot-stacked' ? `${comp.id}:a-lug-2` : `${comp.id}:lug-2`;
      const lug3 = comp.type === 'pot-stacked' ? `${comp.id}:a-lug-3` : `${comp.id}:lug-3`;

      const isPotInHot = activeTerminalKeys.has(lug2) || activeTerminalKeys.has(lug3);
      if (isPotInHot) {
        activeComponentIds.add(comp.id);
        activeTerminalKeys.add(lug2);
        activeTerminalKeys.add(lug3);

        if (connectedToGnd.has(lug1)) {
          activeTerminalKeys.add(lug1);
          const vGndPath = findPathsBetween(jackSleeve, lug1, gndAdj);
          vGndPath.pathNodes.forEach((n) => activeTerminalKeys.add(n));
          vGndPath.pathWireIds.forEach((w) => activeWireIds.add(w));
        }
      }
    }
  }

  // Trace tone networks and treble bleed networks
  for (const comp of components) {
    if (comp.type === 'capacitor' || comp.type === 'resistor') {
      const lead1 = `${comp.id}:lead-1`;
      const lead2 = `${comp.id}:lead-2`;

      const lead1Reach = getConnectedNodesSet(lead1, hotAdj);
      const lead2Reach = getConnectedNodesSet(lead2, hotAdj);

      const lead1ReachesHot = Array.from(activeTerminalKeys).some((tk) => lead1Reach.has(tk));
      const lead2ReachesHot = Array.from(activeTerminalKeys).some((tk) => lead2Reach.has(tk));

      const lead1ReachesGnd = connectedToGnd.has(lead1);
      const lead2ReachesGnd = connectedToGnd.has(lead2);

      // Tone network: one side connected to active hot path, other side to ground
      if ((lead1ReachesHot && lead2ReachesGnd) || (lead2ReachesHot && lead1ReachesGnd)) {
        activeComponentIds.add(comp.id);
        activeTerminalKeys.add(lead1);
        activeTerminalKeys.add(lead2);

        const hotSide = lead1ReachesHot ? lead1 : lead2;
        const gndSide = lead1ReachesHot ? lead2 : lead1;

        const matchingHot = Array.from(activeTerminalKeys).find((tk) =>
          getConnectedNodesSet(hotSide, hotAdj).has(tk)
        );
        if (matchingHot) {
          const capHotPath = findPathsBetween(matchingHot, hotSide, hotAdj);
          capHotPath.pathNodes.forEach((n) => activeTerminalKeys.add(n));
          capHotPath.pathWireIds.forEach((w) => activeWireIds.add(w));
        }

        const capGndPath = findPathsBetween(jackSleeve, gndSide, gndAdj);
        capGndPath.pathNodes.forEach((n) => activeTerminalKeys.add(n));
        capGndPath.pathWireIds.forEach((w) => activeWireIds.add(w));
      }

      // Treble bleed: both leads connected across active hot terminals
      if (lead1ReachesHot && lead2ReachesHot && !lead1ReachesGnd && !lead2ReachesGnd) {
        activeComponentIds.add(comp.id);
        activeTerminalKeys.add(lead1);
        activeTerminalKeys.add(lead2);
        const node1 = Array.from(activeTerminalKeys).find((tk) => lead1Reach.has(tk));
        const node2 = Array.from(activeTerminalKeys).find((tk) => lead2Reach.has(tk));
        if (node1) {
          const p = findPathsBetween(node1, lead1, hotAdj);
          p.pathNodes.forEach((n) => activeTerminalKeys.add(n));
          p.pathWireIds.forEach((w) => activeWireIds.add(w));
        }
        if (node2) {
          const p = findPathsBetween(node2, lead2, hotAdj);
          p.pathNodes.forEach((n) => activeTerminalKeys.add(n));
          p.pathWireIds.forEach((w) => activeWireIds.add(w));
        }
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
    activePickupIds,
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
  const freqHz = Math.round((result.resonantFrequencyHz || 0) / 10) * 10;

  return [
    pickupKeys,
    coilKeys,
    phaseRelationship,
    result.wiringConfiguration,
    result.isHumCancelling ? 'HC' : 'HUM',
    result.isCoilSplit ? 'SPLIT' : 'FULL',
    resK,
    indH,
    freqHz,
  ].join(':::');
}

/**
 * Evaluates all possible combinations of switches and push/pull pots
 * and generates a comprehensive switching analysis report with grouped don't-care combinations.
 */
export function analyzeAllSwitchingCombinations(state: CircuitState): SwitchingAnalysisReport {
  const { components, wires } = state;

  // Identify all switches
  const switches = components.filter((c) =>
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
    if (configs.length > 64) break;
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
    // Clone components and assign this configuration
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

    // Check if this matches current state
    const isCurrent =
      cfg.switches.every((s) => {
        const c = components.find((comp) => comp.id === s.compId);
        return (c?.properties.switchPosition ?? 0) === s.position;
      }) &&
      cfg.pushPulls.every((p) => {
        const c = components.find((comp) => comp.id === p.compId);
        return !!c?.properties.pulledUp === p.pulledUp;
      });

    // Generate descriptive labels
    const labelParts: string[] = [];
    if (cfg.switches.length > 0) {
      labelParts.push(cfg.switches.map((s) => `${s.label}`).join(' + '));
    }
    if (cfg.pushPulls.length > 0) {
      labelParts.push(cfg.pushPulls.map((p) => `${p.compName}: ${p.label}`).join(' • '));
    }
    const combinationLabel = labelParts.length > 0 ? labelParts.join(' | ') : 'Standard Wiring State';

    // Summary of active pickups
    const activePickupSummary =
      result.activePickups.length > 0
        ? result.activePickups.map((p) => p.name).join(' + ')
        : result.hasOutputSignal
        ? 'Active Circuit'
        : 'Muted / Open';

    // Summary of active coils
    const activeCoilsSummary =
      result.activeCoils.length > 0
        ? result.activeCoils.map((c) => `${c.pickupName} (${c.coilName})`).join(' + ')
        : 'None';

    // Tonal description
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
    pattern: (number | null)[]; // null represents '*' (wildcard covering all options of that control)
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

        // Group nodes by (resultSignature + all other dimensions)
        const buckets = new Map<string, ReductionNode[]>();

        for (const node of nodes) {
          if (node.pattern[d] === null) {
            // Already wildcard on dimension d, isolate in unique bucket
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
              // MERGE along dimension d!
              changed = true;
              const mergedPattern = [...bucketNodes[0].pattern];
              mergedPattern[d] = null; // Wildcard '*'!

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

          // Keep nodes unmerged if full coverage condition wasn't met
          for (const bn of bucketNodes) {
            nextNodes.push(bn);
          }
        }

        nodes = nextNodes;
      }
    }
  }

  // --- CONSOLIDATE REDUCTION NODES INTO TRULY DISTINCT TONAL STATES ---
  // (Removes redundant duplicate rows that produce the identical electrical/tonal sound)
  const signatureMap = new Map<string, {
    signature: string;
    items: SwitchingCombinationReportItem[];
    nodes: ReductionNode[];
  }>();

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

  // Separate active playable tones from muted / dead switch positions
  const activeEntries: { signature: string; items: SwitchingCombinationReportItem[]; nodes: ReductionNode[] }[] = [];
  const mutedEntries: { signature: string; items: SwitchingCombinationReportItem[]; nodes: ReductionNode[] }[] = [];

  for (const [sig, entry] of signatureMap.entries()) {
    if (sig === 'MUTED_NO_SIGNAL' || !entry.items[0]?.result.hasOutputSignal) {
      mutedEntries.push(entry);
    } else {
      activeEntries.push(entry);
    }
  }

  // Sort active entries logically:
  // 1. Solo Bridge pickups (full, then split)
  // 2. Solo Neck pickups (full, then split slug, split screw)
  // 3. Parallel combinations (in-phase, then out-of-phase)
  // 4. Series combinations (in-phase, then out-of-phase)
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

    // Compute consolidated control values:
    // If every combination for this tone shares the exact same option for a control, show that option;
    // otherwise show wildcard '*' indicating this control doesn't change this tone.
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

  // Handle fallback if no switches or push-pulls exist
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

  // Summary counts across distinct active playable tones
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

  for (const entry of activeEntries) {
    const res = entry.items[0].result;
    if (res.phaseRelationship === 'out-of-phase') outOfPhaseCount++;
    if (res.wiringConfiguration === 'series') seriesCount++;
    if (res.isCoilSplit) splitCoilCount++;
    if (res.wiringConfiguration === 'parallel' && res.activePickups.length > 1) parallelCount++;
    else if (res.activePickups.length === 1) soloCount++;
    if (res.isHumCancelling) humCancellingCount++;
  }

  return {
    totalCombinations: items.length,
    distinctTonesCount: activeEntries.length > 0 ? activeEntries.length : groupedItems.length,
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
