import { CircuitComponent, CircuitState, Wire } from '../types/guitar';
import { analyzeAllSwitchingCombinations, analyzeCircuit } from './circuitEngine';
import { WIRING_PRESETS } from './presets';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    failed++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    failed++;
    throw new Error(
      `Assertion failed: ${message}\n  Expected: ${String(expected)}\n  Actual:   ${String(actual)}`
    );
  }
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Builds a Les Paul "Twenty-Dual" series-blend schematic:
 * - Two 4-conductor humbuckers (Neck & Bridge)
 * - 3-way toggle switch
 * - 4 push-pull 500k pots:
 *   - Neck Vol (Pull: Neck Coil Split)
 *   - Bridge Vol (Pull: Series-Blend)
 *   - Neck Tone (Pull: Neck Phase Reverse)
 *   - Bridge Tone (Pull: Bridge Coil Split)
 *
 * In series mode (Bridge Vol pulled):
 * - Neck pickup's low end AND Neck Vol lug 1 are lifted off ground onto Bridge Vol wiper (lug 2).
 * - Neck Vol keeps lug 3 on Neck hot and lug 1 on Neck low end, so each volume pot's 500k track
 *   sits directly across its own pickup (acting as a series blend).
 * - Toggle bridge lug switches over to Neck Vol wiper so all 3 toggle positions output the series stack.
 */
function createTwentyDualSeriesBlendCircuit(overrides?: {
  togglePos?: number;
  seriesPulled?: boolean;
  neckSplitPulled?: boolean;
  bridgeSplitPulled?: boolean;
  phasePulled?: boolean;
  neckVol?: number;
  bridgeVol?: number;
  neckVolTaper?: 'audio' | 'linear';
}): CircuitState {
  const components: CircuitComponent[] = [
    {
      id: 'pu-neck',
      type: 'pickup-humbucker',
      name: 'Neck PAF',
      x: 60,
      y: 80,
      properties: { pickupPosition: 'neck', dcResistanceK: 7.9, inductanceH: 4.2 },
    },
    {
      id: 'pu-bridge',
      type: 'pickup-humbucker',
      name: 'Bridge PAF',
      x: 60,
      y: 280,
      properties: { pickupPosition: 'bridge', dcResistanceK: 8.6, inductanceH: 4.8 },
    },
    {
      id: 'pot-neck-vol',
      type: 'pot-pushpull',
      name: 'Neck Vol (Pull: Split)',
      x: 300,
      y: 60,
      properties: {
        resistanceK: 500,
        taper: overrides?.neckVolTaper ?? 'audio',
        currentValue: overrides?.neckVol ?? 1.0,
        pulledUp: overrides?.neckSplitPulled ?? false,
      },
    },
    {
      id: 'pot-bridge-vol',
      type: 'pot-pushpull',
      name: 'Bridge Vol (Pull: Series)',
      x: 500,
      y: 60,
      properties: {
        resistanceK: 500,
        taper: 'audio',
        currentValue: overrides?.bridgeVol ?? 1.0,
        pulledUp: overrides?.seriesPulled ?? false,
      },
    },
    {
      id: 'pot-neck-tone',
      type: 'pot-pushpull',
      name: 'Neck Tone (Pull: Phase)',
      x: 300,
      y: 260,
      properties: {
        resistanceK: 500,
        taper: 'audio',
        currentValue: 1.0,
        pulledUp: overrides?.phasePulled ?? false,
      },
    },
    {
      id: 'pot-bridge-tone',
      type: 'pot-pushpull',
      name: 'Bridge Tone (Pull: Split)',
      x: 500,
      y: 260,
      properties: {
        resistanceK: 500,
        taper: 'audio',
        currentValue: 1.0,
        pulledUp: overrides?.bridgeSplitPulled ?? false,
      },
    },
    {
      id: 'cap-neck',
      type: 'capacitor',
      name: 'Neck 0.022uF Cap',
      x: 300,
      y: 440,
      properties: { capacitanceUf: 0.022, capType: 'orange-drop' },
    },
    {
      id: 'cap-bridge',
      type: 'capacitor',
      name: 'Bridge 0.022uF Cap',
      x: 500,
      y: 440,
      properties: { capacitanceUf: 0.022, capType: 'orange-drop' },
    },
    {
      id: 'sw-toggle',
      type: 'switch-3way-toggle',
      name: '3-Way Toggle',
      x: 700,
      y: 120,
      properties: { switchPosition: overrides?.togglePos ?? 1 },
    },
    {
      id: 'jack-out',
      type: 'output-jack',
      name: 'Output Jack',
      x: 860,
      y: 120,
      properties: { jackType: 'mono' },
    },
  ];

  const wires: Wire[] = [
    // Neck coil split on Neck Vol DPDT: ties finish junction to Neck low end when pulled
    { id: 'w-ns-w', fromComponentId: 'pu-neck', fromTerminalId: 'north-finish', toComponentId: 'pot-neck-vol', toTerminalId: 'sw-c1', color: '#fff' },
    { id: 'w-ns-r', fromComponentId: 'pu-neck', fromTerminalId: 'south-finish', toComponentId: 'pot-neck-vol', toTerminalId: 'sw-c1', color: '#f00' },
    { id: 'w-ns-low', fromComponentId: 'pot-neck-vol', fromTerminalId: 'sw-2', toComponentId: 'pot-neck-tone', toTerminalId: 'sw-3', color: '#000' },

    // Neck phase reverse on Neck Tone DPDT
    { id: 'w-np-in1', fromComponentId: 'pu-neck', fromTerminalId: 'north-start', toComponentId: 'pot-neck-tone', toTerminalId: 'sw-c1', color: '#000' },
    { id: 'w-np-in2', fromComponentId: 'pu-neck', fromTerminalId: 'south-start', toComponentId: 'pot-neck-tone', toTerminalId: 'sw-c2', color: '#0f0' },
    { id: 'w-np-x1', fromComponentId: 'pot-neck-tone', fromTerminalId: 'sw-2', toComponentId: 'pot-neck-tone', toTerminalId: 'sw-3', color: '#ff0' },
    { id: 'w-np-x2', fromComponentId: 'pot-neck-tone', fromTerminalId: 'sw-4', toComponentId: 'pot-neck-tone', toTerminalId: 'sw-1', color: '#ff0' },

    // Neck hot -> Neck Vol lug 3; Neck low -> Neck Vol lug 1 AND Bridge Vol series switch C1
    { id: 'w-n-hot', fromComponentId: 'pot-neck-tone', fromTerminalId: 'sw-1', toComponentId: 'pot-neck-vol', toTerminalId: 'lug-3', color: '#000' },
    { id: 'w-n-low-v1', fromComponentId: 'pot-neck-tone', fromTerminalId: 'sw-3', toComponentId: 'pot-neck-vol', toTerminalId: 'lug-1', color: '#0f0' },
    { id: 'w-n-low-ser', fromComponentId: 'pot-neck-vol', fromTerminalId: 'lug-1', toComponentId: 'pot-bridge-vol', toTerminalId: 'sw-c1', color: '#0f0' },

    // Neck Vol wiper -> Toggle Neck
    { id: 'w-nv-tog', fromComponentId: 'pot-neck-vol', fromTerminalId: 'lug-2', toComponentId: 'sw-toggle', toTerminalId: 'sw-neck', color: '#00f' },

    // Neck Tone (2-lug on lug 3 & lug 2 -> cap -> ground)
    { id: 'w-nt-in', fromComponentId: 'pot-neck-vol', fromTerminalId: 'lug-3', toComponentId: 'pot-neck-tone', toTerminalId: 'lug-3', color: '#ff0' },
    { id: 'w-nt-cap', fromComponentId: 'pot-neck-tone', fromTerminalId: 'lug-2', toComponentId: 'cap-neck', toTerminalId: 'lead-1', color: '#ff0' },
    { id: 'w-nc-gnd', fromComponentId: 'cap-neck', fromTerminalId: 'lead-2', toComponentId: 'pot-neck-tone', toTerminalId: 'case-ground', color: '#000' },

    // Bridge coil split on Bridge Tone DPDT
    { id: 'w-bs-w', fromComponentId: 'pu-bridge', fromTerminalId: 'north-finish', toComponentId: 'pot-bridge-tone', toTerminalId: 'sw-c1', color: '#fff' },
    { id: 'w-bs-r', fromComponentId: 'pu-bridge', fromTerminalId: 'south-finish', toComponentId: 'pot-bridge-tone', toTerminalId: 'sw-c1', color: '#f00' },
    { id: 'w-bs-gnd', fromComponentId: 'pot-bridge-tone', fromTerminalId: 'sw-2', toComponentId: 'pot-bridge-tone', toTerminalId: 'case-ground', color: '#000' },

    // Bridge pickup -> Bridge Vol
    { id: 'w-b-hot', fromComponentId: 'pu-bridge', fromTerminalId: 'north-start', toComponentId: 'pot-bridge-vol', toTerminalId: 'lug-3', color: '#000' },
    { id: 'w-b-gnd', fromComponentId: 'pu-bridge', fromTerminalId: 'south-start', toComponentId: 'pot-bridge-vol', toTerminalId: 'case-ground', color: '#0f0' },
    { id: 'w-bv-l1', fromComponentId: 'pot-bridge-vol', fromTerminalId: 'lug-1', toComponentId: 'pot-bridge-vol', toTerminalId: 'case-ground', color: '#000' },

    // Bridge Tone
    { id: 'w-bt-in', fromComponentId: 'pot-bridge-vol', fromTerminalId: 'lug-3', toComponentId: 'pot-bridge-tone', toTerminalId: 'lug-3', color: '#ff0' },
    { id: 'w-bt-cap', fromComponentId: 'pot-bridge-tone', fromTerminalId: 'lug-2', toComponentId: 'cap-bridge', toTerminalId: 'lead-1', color: '#ff0' },
    { id: 'w-bc-gnd', fromComponentId: 'cap-bridge', fromTerminalId: 'lead-2', toComponentId: 'pot-bridge-tone', toTerminalId: 'case-ground', color: '#000' },

    // Series-Blend DPDT on Bridge Vol:
    // Pole 1 (sw-c1 = Neck low + Neck Vol lug 1): Down (sw-1) -> Ground, Up (sw-2) -> Bridge Vol wiper (lug 2)
    { id: 'w-ser-p1-gnd', fromComponentId: 'pot-bridge-vol', fromTerminalId: 'sw-1', toComponentId: 'pot-bridge-vol', toTerminalId: 'case-ground', color: '#000' },
    { id: 'w-ser-p1-bw', fromComponentId: 'pot-bridge-vol', fromTerminalId: 'sw-2', toComponentId: 'pot-bridge-vol', toTerminalId: 'lug-2', color: '#f00' },
    // Pole 2 (sw-c2 = Toggle Bridge): Down (sw-3) -> Bridge Vol wiper, Up (sw-4) -> Neck Vol wiper
    { id: 'w-ser-p2-c', fromComponentId: 'pot-bridge-vol', fromTerminalId: 'sw-c2', toComponentId: 'sw-toggle', toTerminalId: 'sw-bridge', color: '#f00' },
    { id: 'w-ser-p2-down', fromComponentId: 'pot-bridge-vol', fromTerminalId: 'sw-3', toComponentId: 'pot-bridge-vol', toTerminalId: 'lug-2', color: '#f00' },
    { id: 'w-ser-p2-up', fromComponentId: 'pot-bridge-vol', fromTerminalId: 'sw-4', toComponentId: 'pot-neck-vol', toTerminalId: 'lug-2', color: '#00f' },

    // Toggle output to jack
    { id: 'w-tog-tip', fromComponentId: 'sw-toggle', fromTerminalId: 'sw-output', toComponentId: 'jack-out', toTerminalId: 'tip', color: '#000' },

    // Ground bus
    { id: 'w-g1', fromComponentId: 'pot-neck-vol', fromTerminalId: 'case-ground', toComponentId: 'pot-bridge-vol', toTerminalId: 'case-ground', color: '#000' },
    { id: 'w-g2', fromComponentId: 'pot-neck-vol', fromTerminalId: 'case-ground', toComponentId: 'pot-neck-tone', toTerminalId: 'case-ground', color: '#000' },
    { id: 'w-g3', fromComponentId: 'pot-bridge-vol', fromTerminalId: 'case-ground', toComponentId: 'pot-bridge-tone', toTerminalId: 'case-ground', color: '#000' },
    { id: 'w-g4', fromComponentId: 'pot-bridge-vol', fromTerminalId: 'case-ground', toComponentId: 'jack-out', toTerminalId: 'sleeve', color: '#000' },
  ];

  return { components, wires };
}

test('Twenty-Dual series-blend: all 24 pulled states are series, all 24 pushed states unchanged', () => {
  const circuit = createTwentyDualSeriesBlendCircuit();
  const report = analyzeAllSwitchingCombinations(circuit);

  assertEqual(report.totalCombinations, 48, 'expected 48 switching combinations');

  let seriesPulledCount = 0;
  let parallelPushedBothCount = 0;
  let soloPushedCount = 0;

  for (const item of report.items) {
    const togglePos = item.switchSettings.find((s) => s.compId === 'sw-toggle')!.position;
    const seriesPulled = item.pushPullSettings.find((p) => p.compId === 'pot-bridge-vol')!.pulledUp;
    const neckSplit = item.pushPullSettings.find((p) => p.compId === 'pot-neck-vol')!.pulledUp;
    const bridgeSplit = item.pushPullSettings.find((p) => p.compId === 'pot-bridge-tone')!.pulledUp;

    assert(item.result.hasOutputSignal, `expected output signal for ${item.combinationLabel}`);

    if (seriesPulled) {
      seriesPulledCount++;
      assertEqual(
        item.result.wiringConfiguration,
        'series',
        `series-blend pulled state should be 'series': ${item.combinationLabel}`
      );
      assertEqual(
        item.result.activePickups.length,
        2,
        `both pickups active in series-blend: ${item.combinationLabel}`
      );
      assertEqual(
        item.result.gainOffsetDb,
        4.0,
        `series gainOffsetDb should be +4.0 dB: ${item.combinationLabel}`
      );
      assert(
        item.result.estimatedTotalInductanceH >= 4.0,
        `series total inductance should sum (got ${item.result.estimatedTotalInductanceH}H): ${item.combinationLabel}`
      );
    } else if (togglePos === 1) {
      parallelPushedBothCount++;
      assertEqual(
        item.result.wiringConfiguration,
        'parallel',
        `parallel pushed Both state should be 'parallel': ${item.combinationLabel}`
      );
      assertEqual(
        item.result.activePickups.length,
        2,
        `both pickups active in parallel Both: ${item.combinationLabel}`
      );
    } else {
      soloPushedCount++;
      const isActiveSplit = togglePos === 0 ? bridgeSplit : neckSplit;
      const expectedConfig = isActiveSplit ? 'solo' : 'series';
      assertEqual(
        item.result.wiringConfiguration,
        expectedConfig,
        `solo pickup state should be '${expectedConfig}': ${item.combinationLabel}`
      );
      assertEqual(
        item.result.activePickups.length,
        1,
        `single pickup active in togglePos=${togglePos}: ${item.combinationLabel}`
      );
    }
  }

  assertEqual(seriesPulledCount, 24, 'expected 24 series-pulled states');
  assertEqual(parallelPushedBothCount, 8, 'expected 8 parallel-pushed Both states');
  assertEqual(soloPushedCount, 16, 'expected 16 solo-pushed states');
  assert(report.seriesCount > 0, 'report.seriesCount should be > 0');
});

test('Twenty-Dual series-blend: topology verdict is independent of live volume knob positions', () => {
  const cases = [
    { neckVol: 1.0, bridgeVol: 1.0, neckVolTaper: 'audio' as const },
    { neckVol: 0.5, bridgeVol: 1.0, neckVolTaper: 'audio' as const },
    { neckVol: 0.7, bridgeVol: 1.0, neckVolTaper: 'audio' as const },
    { neckVol: 1.0, bridgeVol: 0.7, neckVolTaper: 'audio' as const },
    { neckVol: 0.5, bridgeVol: 1.0, neckVolTaper: 'linear' as const },
    { neckVol: 0.5, bridgeVol: 0.5, neckVolTaper: 'linear' as const },
    { neckVol: 0.0, bridgeVol: 0.0, neckVolTaper: 'audio' as const }, // Muted by pots -> refSweep topology
  ];

  for (const cfg of cases) {
    const state = createTwentyDualSeriesBlendCircuit({
      togglePos: 1,
      seriesPulled: true,
      ...cfg,
    });
    const res = analyzeCircuit(state);
    assertEqual(
      res.wiringConfiguration,
      'series',
      `expected 'series' for neckVol=${cfg.neckVol}, bridgeVol=${cfg.bridgeVol}, taper=${cfg.neckVolTaper}`
    );
  }
});

test('3-pickup complex topology: (Neck || Middle) in series with Bridge', () => {
  const state: CircuitState = {
    components: [
      { id: 'n', type: 'pickup-singlecoil', name: 'Neck', x: 0, y: 0, properties: { pickupPosition: 'neck' } },
      { id: 'm', type: 'pickup-singlecoil', name: 'Middle', x: 0, y: 50, properties: { pickupPosition: 'middle', rwrp: true } },
      { id: 'b', type: 'pickup-singlecoil', name: 'Bridge', x: 0, y: 100, properties: { pickupPosition: 'bridge' } },
      { id: 'j', type: 'output-jack', name: 'Jack', x: 100, y: 50, properties: { jackType: 'mono' } },
    ],
    wires: [
      { id: 'w1', fromComponentId: 'n', fromTerminalId: 'hot', toComponentId: 'j', toTerminalId: 'tip', color: '#000' },
      { id: 'w2', fromComponentId: 'm', fromTerminalId: 'hot', toComponentId: 'j', toTerminalId: 'tip', color: '#000' },
      { id: 'w3', fromComponentId: 'n', fromTerminalId: 'ground', toComponentId: 'b', toTerminalId: 'hot', color: '#000' },
      { id: 'w4', fromComponentId: 'm', fromTerminalId: 'ground', toComponentId: 'b', toTerminalId: 'hot', color: '#000' },
      { id: 'w5', fromComponentId: 'b', fromTerminalId: 'ground', toComponentId: 'j', toTerminalId: 'sleeve', color: '#000' },
    ],
  };
  assertEqual(analyzeCircuit(state).wiringConfiguration, 'complex', '(Neck || Middle) + Bridge should be complex');
});

test('Intra-humbucker series with resistor or capacitor network spanning one bobbin', () => {
  const baseHumbucker = (extraComp: CircuitComponent, extraWires: Wire[]): CircuitState => ({
    components: [
      {
        id: 'pu-1',
        type: 'pickup-humbucker',
        name: 'Bridge HB',
        x: 0,
        y: 0,
        properties: { pickupPosition: 'bridge', dcResistanceK: 8.4, inductanceH: 4.4 },
      },
      extraComp,
      {
        id: 'jack-out',
        type: 'output-jack',
        name: 'Jack',
        x: 200,
        y: 0,
        properties: { jackType: 'mono' },
      },
    ],
    wires: [
      { id: 'w1', fromComponentId: 'pu-1', fromTerminalId: 'north-start', toComponentId: 'jack-out', toTerminalId: 'tip', color: '#000' },
      { id: 'w2', fromComponentId: 'pu-1', fromTerminalId: 'north-finish', toComponentId: 'pu-1', toTerminalId: 'south-finish', color: '#f00' },
      { id: 'w3', fromComponentId: 'pu-1', fromTerminalId: 'south-start', toComponentId: 'jack-out', toTerminalId: 'sleeve', color: '#0f0' },
      ...extraWires,
    ],
  });

  // 10k resistor across South coil (partial split)
  const partialSplitRes = analyzeCircuit(
    baseHumbucker(
      { id: 'r-split', type: 'resistor', name: '10k Split', x: 100, y: 50, properties: { resistanceOhms: 10000 } },
      [
        { id: 'wr1', fromComponentId: 'pu-1', fromTerminalId: 'north-finish', toComponentId: 'r-split', toTerminalId: 'lead-1', color: '#ff0' },
        { id: 'wr2', fromComponentId: 'r-split', fromTerminalId: 'lead-2', toComponentId: 'jack-out', toTerminalId: 'sleeve', color: '#000' },
      ]
    )
  );
  assertEqual(partialSplitRes.wiringConfiguration, 'series', 'partial-split resistor across bobbin should still be series');

  // 0.047uF cap across South coil (tuned split)
  const tunedSplitRes = analyzeCircuit(
    baseHumbucker(
      { id: 'c-split', type: 'capacitor', name: '47nF Split', x: 100, y: 50, properties: { capacitanceUf: 0.047 } },
      [
        { id: 'wc1', fromComponentId: 'pu-1', fromTerminalId: 'north-finish', toComponentId: 'c-split', toTerminalId: 'lead-1', color: '#ff0' },
        { id: 'wc2', fromComponentId: 'c-split', fromTerminalId: 'lead-2', toComponentId: 'jack-out', toTerminalId: 'sleeve', color: '#000' },
      ]
    )
  );
  assertEqual(tunedSplitRes.wiringConfiguration, 'series', 'tuned-split cap across bobbin should still be series');
});

test('Parallel-wired humbuckers stacked in series', () => {
  const state: CircuitState = {
    components: [
      {
        id: 'pu-neck',
        type: 'pickup-humbucker',
        name: 'Neck HB',
        x: 0,
        y: 0,
        properties: { pickupPosition: 'neck', dcResistanceK: 8.0, inductanceH: 4.0 },
      },
      {
        id: 'pu-bridge',
        type: 'pickup-humbucker',
        name: 'Bridge HB',
        x: 0,
        y: 100,
        properties: { pickupPosition: 'bridge', dcResistanceK: 8.0, inductanceH: 4.0 },
      },
      {
        id: 'jack-out',
        type: 'output-jack',
        name: 'Jack',
        x: 200,
        y: 50,
        properties: { jackType: 'mono' },
      },
    ],
    wires: [
      // Neck internal parallel: (north-start + south-finish) -> tip; (north-finish + south-start) -> junction
      { id: 'w1', fromComponentId: 'pu-neck', fromTerminalId: 'north-start', toComponentId: 'jack-out', toTerminalId: 'tip', color: '#000' },
      { id: 'w2', fromComponentId: 'pu-neck', fromTerminalId: 'south-finish', toComponentId: 'jack-out', toTerminalId: 'tip', color: '#f00' },
      { id: 'w3', fromComponentId: 'pu-neck', fromTerminalId: 'north-finish', toComponentId: 'pu-neck', toTerminalId: 'south-start', color: '#0f0' },
      // Series link: Neck low -> Bridge hot (north-start + south-finish)
      { id: 'w4', fromComponentId: 'pu-neck', fromTerminalId: 'south-start', toComponentId: 'pu-bridge', toTerminalId: 'north-start', color: '#ff0' },
      { id: 'w5', fromComponentId: 'pu-bridge', fromTerminalId: 'north-start', toComponentId: 'pu-bridge', toTerminalId: 'south-finish', color: '#f00' },
      // Bridge low (north-finish + south-start) -> Ground
      { id: 'w6', fromComponentId: 'pu-bridge', fromTerminalId: 'north-finish', toComponentId: 'jack-out', toTerminalId: 'sleeve', color: '#000' },
      { id: 'w7', fromComponentId: 'pu-bridge', fromTerminalId: 'south-start', toComponentId: 'jack-out', toTerminalId: 'sleeve', color: '#0f0' },
    ],
  };

  const res = analyzeCircuit(state);
  assertEqual(res.wiringConfiguration, 'series', 'two parallel humbuckers in series should report series');
  assertEqual(res.activeCoils.length, 4, 'all 4 coils should be active');
  assert(res.activeCoils.every((c) => c.coilName.includes('(Parallel)')), 'each bobbin should be labelled (Parallel)');
  assertEqual(res.isHumCancelling, true, 'parallel humbuckers in series should be hum-cancelling');
});

test('Series-blend with 47nF output coupling capacitor still detects series via pot-track-stripped fallback', () => {
  const base = createTwentyDualSeriesBlendCircuit({ togglePos: 1, seriesPulled: true });
  const components: CircuitComponent[] = [
    ...base.components,
    {
      id: 'cap-out',
      type: 'capacitor',
      name: '47nF Output Cap',
      x: 780,
      y: 120,
      properties: { capacitanceUf: 0.047 },
    },
  ];
  const wires: Wire[] = [
    ...base.wires.filter((w) => w.id !== 'w-tog-tip'),
    { id: 'w-tog-c1', fromComponentId: 'sw-toggle', fromTerminalId: 'sw-output', toComponentId: 'cap-out', toTerminalId: 'lead-1', color: '#000' },
    { id: 'w-c2-tip', fromComponentId: 'cap-out', fromTerminalId: 'lead-2', toComponentId: 'jack-out', toTerminalId: 'tip', color: '#000' },
  ];

  const res = analyzeCircuit({ components, wires });
  assertEqual(res.hasOutputSignal, true, 'output signal should pass 47nF coupling cap');
  assertEqual(res.wiringConfiguration, 'series', 'series-blend behind 47nF output cap should still report series');
});

test('Built-in presets retain accurate series/parallel/solo classifications', () => {
  const byId = new Map(WIRING_PRESETS.map((p) => [p.id, p]));

  // Tele 4-Way: Pos 1=solo, Pos 2=parallel, Pos 3=solo, Pos 4=series
  const tele = byId.get('tele-4way-mod')!;
  const teleReport = analyzeAllSwitchingCombinations({ components: tele.components, wires: tele.wires });
  const teleConfigs = teleReport.items.map((it) => it.result.wiringConfiguration);
  assertEqual(teleConfigs.join(','), 'solo,parallel,solo,series', 'Tele 4-Way positions');

  // Strat SSS: Pos 1=solo, Pos 2=parallel, Pos 3=solo, Pos 4=parallel, Pos 5=solo
  const strat = byId.get('strat-modern-sss')!;
  const stratReport = analyzeAllSwitchingCombinations({ components: strat.components, wires: strat.wires });
  const stratConfigs = stratReport.items.map((it) => it.result.wiringConfiguration);
  assertEqual(stratConfigs.join(','), 'solo,parallel,solo,parallel,solo', 'Strat 5-Way positions');

  // Les Paul 50s: Bridge=series (HB), Both=parallel, Neck=series (HB)
  const lp = byId.get('les-paul-50s-hh')!;
  const lpReport = analyzeAllSwitchingCombinations({ components: lp.components, wires: lp.wires });
  const lpConfigs = lpReport.items.map((it) => it.result.wiringConfiguration);
  assertEqual(lpConfigs.join(','), 'series,parallel,series', 'Les Paul 50s toggle positions');

  // Blend pot: center detent = parallel
  const blend = byId.get('blend-pot-dual-pickup')!;
  const blendRes = analyzeCircuit({ components: blend.components, wires: blend.wires });
  assertEqual(blendRes.wiringConfiguration, 'parallel', 'Dual pickup blend pot at center');

  // Jimmy Page 4PP: verify series states exist when Series push-pull is Up and Toggle=Neck
  const jp = byId.get('jimmy-page-4pp')!;
  const jpReport = analyzeAllSwitchingCombinations({ components: jp.components, wires: jp.wires });
  const jpNeckSeries = jpReport.items.filter((it) => {
    const tog = it.switchSettings.find((s) => s.compId === 'sw-toggle')!.position;
    const ser = it.pushPullSettings.find((p) => p.compId === 'pot-bridge-tone')!.pulledUp;
    return tog === 2 && ser;
  });
  assertEqual(jpNeckSeries.length, 8, 'Jimmy Page should have 8 Toggle=Neck + Series=Up states');
  for (const it of jpNeckSeries) {
    assertEqual(it.result.wiringConfiguration, 'series', `Jimmy Page series state: ${it.combinationLabel}`);
  }
});

console.log(`\nSummary: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  throw new Error(`${failed} test(s) failed`);
}
