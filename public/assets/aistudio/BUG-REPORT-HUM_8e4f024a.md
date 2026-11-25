# Hum-cancelling verdict wrong for 3+ coil combinations and for parallel-wired humbuckers in a series stack

## Summary

Two bugs in `circuitEngine.ts` decide `isHumCancelling` wrongly. They partly hide each other, so they need to be fixed together.

1. **The 3-or-more-coil rule passes almost anything.** `Math.abs(inPhaseCount - revPhaseCount) < activeCoils.length` is true whenever at least one coil differs in phase from the others. A humbucker plus one split coil (2 in-phase + 1 reverse) is reported as hum-cancelling, but it hums like a single coil: the humbucker cancels its own hum and the lone coil's hum is left over.
2. **The series-stack detector drops a coil.** In the inter-pickup series detector (around lines 198–345), each humbucker is registered either as a full series humbucker (2 coils) or, when `isCoilSplit` is set, as one split coil. A humbucker whose two coils are wired **in parallel** falls into the split branch, so only one of its coils is registered. A pair of parallel humbuckers in series then looks like two single coils with matching phase, and the engine says it hums when it is actually fully cancelling.

## How it was found

I took a two-humbucker harness (bridge magnet flipped, four push-pull pots, 3-way toggle) in two variants, A/B. For every one of the 48 switch states I compared ToneSmith's `analyzeCircuit().isHumCancelling` with an AC nodal model of the same harness. The model computes the hum EMF at 50 and 150 Hz with each coil's winding sense, and counts a state as "full" when hum is below −30 dB relative to a single coil.

| Variant | Distinct tones | Full hum-cancelling (nodal model) | ToneSmith `humCancellingCount` | Wrong verdicts |
|---|---|---|---|---|
| A: hard coil splits | 21 | 10 | 18 | 8 false positives (bug 1) |
| B: coils switch series/parallel | 20 | 20 | 19 | 1 false negative (bug 2) |

### Bug 1: false positives (variant A)

Hum is in dB relative to one single coil, from the nodal model. Coils are listed as ToneSmith detects them: pickup, coil, magnet / electrical phase.

| Tone | Model hum, 50 Hz | ToneSmith | ToneSmith active coils |
|---|---|---|---|
| Neck humbucker + bridge single (parallel), both phases | −3.7 dB | HC | N:N/I N:S/R B:S/I |
| Neck single + bridge humbucker (parallel), both phases | −3.7 dB | HC | N:S/R B:N/R B:S/I |
| Neck humbucker × bridge single (series), both phases | −0.5 dB | HC | B:S/I N:N/I N:S/R |
| Neck single × bridge humbucker (series), both phases | −0.6 dB | HC | B:N/R B:S/I N:S/R |

The coil detection is right for all 8 of these states. Only the 3-coil rule is wrong.

### Bug 2: false negative (variant B)

| Tone | Model hum, 50 Hz | ToneSmith | ToneSmith active coils |
|---|---|---|---|
| Neck parallel × bridge parallel (series), out of phase | −240 dB (cancelled) | hum | B:N/I N:N/I |

Each pickup is a parallel pair, which cancels its own hum, but ToneSmith only sees one coil per pickup. The in-phase version of this tone is reported as HC only by luck: its two detected coils happen to have opposite electrical phase.

### The two bugs hide each other

Bug 2 also hits these series tones in variant B. One coil goes missing from a parallel-wired pickup, but the lenient 3-coil rule still returns HC, so the result is right by accident:

- Neck humbucker × bridge parallel (series), both phases: ToneSmith detects 3 coils, B:N/R N:N/I N:S/R
- Neck parallel × bridge humbucker (series), both phases: ToneSmith detects 3 coils, B:N/R B:S/I N:N/I

I recomputed the verdict from ToneSmith's detected coils using the strict rule (`inPhaseCount === revPhaseCount`). That clears all 8 false positives in variant A, but in variant B the wrong verdicts go **up from 1 to 5**, because those four tones lose their accidental HC. Both bugs need fixing together.

## Expected behaviour

Hum pickup does not depend on the magnets. It depends only on each coil's winding sense and on which end is towards the hot side; that is what `electricalPhase` already encodes. A combination is hum-cancelling when the hum EMFs sum to zero at the output.

## Suggested fix

1. **In the inter-pickup series detector,** register a humbucker whose coils are in parallel with both coils, the same way `evaluateHumbucker` already does in the non-series path ("North Slug Coil (Parallel)" / "South Screw Coil (Parallel)"). Use `isCoilSplit` only when one coil is really shorted.
2. **Replace the 3+ coil rule** with `inPhaseCount === revPhaseCount`. This is exact for equal coils wired symmetrically, and it gives the model's verdict for every state above once fix 1 is in.
3. **Optional, more general:** compute hum as a signed, impedance-weighted sum using the same series/parallel topology as the signal, so that unequal coils and odd topologies come out right. A residual hum figure in dB would also allow a "hum-reduced" category alongside "cancelling" and "not cancelling".

## Environment

- ToneSmith at commit `9732b58`
- Reproduced by calling `analyzeCircuit()` directly with `tsx` on Node v24.14.0, setting `switchPosition` / `pulledUp` for each of the 48 states.
- Related: the separate report on resistors being treated as wires and capacitors as open circuits. Tuned-split circuits (a capacitor from the coil junction) can't be judged for hum until that is fixed, so they were left out of this comparison.
