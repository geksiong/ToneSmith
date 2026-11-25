# Circuit engine treats resistors as wires and capacitors as open circuits, so valid circuits read as shorted or dead

## Summary

`circuitEngine.ts` reduces both passive parts to a yes/no connection:

- **Resistor:** `lead-1` is joined to `lead-2` with a plain edge, so any resistor counts as a wire, whatever its value.
- **Capacitor:** no edge at all, so a capacitor is always an open circuit.

As a result, any circuit with a resistor to ground on the signal path, or a capacitor in series with the signal, is analysed wrongly: it is reported as a short circuit or as having no output.

## Steps to reproduce

Starting point: one single-coil pickup → volume pot (lug 3 in, wiper out, lug 1 to case) → jack tip. The pickup ground and the jack sleeve go to the pot case. Run `analyzeCircuit()`:

| Case | Change from baseline | `hasOutputSignal` | `effectiveVolumeLevel` | `circuitIssues` |
|---|---|---|---|---|
| A | none (baseline) | `true` | 1 | none |
| B | add a 220 kΩ resistor from the pickup hot to ground | `false` | 0 | "⚠ Short circuit detected: Jack Tip is directly connected to Ground." |
| C | put a 47 nF cap in series between the volume wiper and the jack tip | `false` | 0 | "No pickups currently connected to the output path. Check selector switch position or volume pot." |

**Expected:**
- **B:** output present. A 220 kΩ load across the pickup only lowers the load resistance (500k pot ‖ 220k) and damps the resonant peak.
- **C:** output present. With a 1 MΩ amp input, 47 nF in series is a high-pass filter at about 3 Hz, so nothing audible changes.

## Real-world impact

Common guitar mods that use these parts are analysed wrongly:

- Load resistors on coil splits ("Strat loading"), and fixed load resistors in general.
- Resistor-to-ground pickup loading. Any resistor between the hot path and ground is read as a dead short.
- Duncan-style treble bleeds (a resistor in parallel with a cap across volume lug 3 and the wiper). If the resistor is a wire, the volume pot is bypassed, so turning the volume down should have no effect in the analysis (not tested).
- Capacitors in the signal path: half-series switching, tuned (partial) coil splits that use a cap from the coil junction, and cut-only bass caps.

Example: a two-humbucker, four push-pull harness. Its own nodal model gives 48 states with 0 dead. ToneSmith shows 26 of the 48 states as muted, and some as "Jack Tip directly connected to Ground". A sister harness without resistors or series caps shows 0 muted states and the correct tone count, so the switch handling itself works.

## Where in the code

`src/lib/circuitEngine.ts`, all three graph builders:

- `addInternalComponentConnections()`, around line 995: `case 'capacitor': break;` and `case 'resistor': addEdge(lead-1, lead-2)`.
- The same pattern repeats in the two later builders, around lines 1421–1426 and 1527–1532.
- The tone and treble-bleed tracing around line 1831 depends on these edges.

## Suggested fix

1. **Use part values to decide connectivity.** At minimum:
   - Treat a resistor at or above a threshold (say 10 kΩ) as *not* a DC short for short detection and output-path detection. Use it as a parallel load in `loadResistanceK` instead.
   - Treat a capacitor in the series signal path as passing audio when its corner frequency against the load, `1 / (2π · R_load · C)`, is below about 20 Hz.
   - A capacitor from the hot path to ground stays what it is today: a filter, not a connection.
2. **Better: compute the response from impedances.** Do a small nodal (MNA) solve at a set of frequencies, using the pickup's R/L/C, the pot positions, the cables and the amp input. That would give correct muting, loading, resonance, and tuned-split / half-series behaviour from one model, and the Bode plot could use the same data.

## Environment

- ToneSmith at commit `9732b58`
- Reproduced by calling `analyzeCircuit()` directly with `tsx` on Node v24.14.0
