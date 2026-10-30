# Generated Rewrite (PGS-L3 Natural)

**Checkpoint date:** 2026-10-30

PGS can now propose a wording, not only judge one. This is the first level a
model is permitted to author, and it is the narrowest possible addition: L1 and
L2 remain deterministic, so a consumer can always tell which wording the engine
derived and which a model wrote.

## Why it was needed

`renderRecommendations` is deterministic, and its generator `naturalL1` is a
short table of pattern matches whose fall-through returns the source verbatim.
Measured over 12 realistic sentences and paragraphs on 2026-10-30:

| | |
|---|---|
| L1 identical to the source | 9 / 12 |
| L2 withheld | 8 / 12 |
| L1 changed by a perfect model | 0 / 12 |

The last row is the one that mattered. `SemanticEngine` has declared an
optional `render?()` and a `rendering` capability flag since the interface was
written, but `runPgsPipeline` never called it — the only engine method the
pipeline invoked was `determine()`. A model's entire route to the wording was a
`hasMotive` boolean toggling an "I believe " prefix. No amount of inference
could produce a better sentence, because nothing asked it for one.

`render()` now has its first caller.

## The contract

`generateRecommendation` (`src/render/generated.ts`) appends at most one
`PGS-L3-natural` recommendation to `PipelineResult.recommendations`. Four gates,
in this order:

1. **Capability.** An engine that does not advertise `rendering`, or has no
   `render`, produces no L3 recommendation at all — not a withheld one.
   Absence means "not offered", which is what every pre-existing caller sees.
2. **EXC-008.** Instrument text is withheld *before* the engine is called, so a
   deed is never transmitted anywhere to be rewritten.
3. **The engine's own report.** When `RenderResponse.protectedContentPreserved`
   is false, the wording is withheld. An engine admitting a failure is better
   evidence than a comparator inferring one.
4. **Fidelity.** `compareFidelity` — the same comparison `compare()` exposes.
   `blocked` withholds the text and keeps the issues. `review_required` keeps
   the text *and* the issues: the engine cannot establish equivalence either
   way, and the reader is the one who knows what they meant.

A `render` that throws sets `PipelineResult.renderError` and is never
propagated. Losing a proposed wording must not cost the caller the analysis
they would otherwise have had.

## EXC-008 — correspondence only, not instruments

Added to `specification/exceptions.yaml`; `specification/l3-modes.yaml` records
the withholding under `L3.withheld`.

A clause does not describe a disposition, it effects one. So a wording that
survives fidelity comparison may still alter what the instrument *does*, which
is a failure mode the comparator is not built to see. Generation is therefore
withheld outright for instrument text rather than permitted subject to
verification — which is what EXC-104 already requires for operative language
generally, and is not enough here.

**The costs are asymmetric.** Withholding costs a drafter their own wording.
A wrong generation costs an instrument that does not do what its maker
intended. Those are not comparable, so detector confidence does not set the
default: the detector withholds when the reading is uncertain.

### Why not the domain classifier

`classifyProtectedDomain` marks text `legal` on "notice", "consent",
"contract" and "liable". That makes "I do not consent to this." legal text —
correspondence, and precisely the sentence PGS exists to help someone write.
Reusing it would have emptied the feature of its purpose while protecting
nothing.

`readsAsInstrument` keys on *function* instead: markers that appear when text
is executing, reciting or disposing rather than describing. One decisive marker
settles it; otherwise two distinct *kinds* of corroborating marker are
required, because a letter can be pompous without being a deed.

### What it does not claim

This is a reading of surface markers. It is wrong in both directions and is a
floor, not a guarantee — a plainly drafted modern trust clause carrying none of
these markers will pass it. It is not a substitute for a drafter knowing what
they are editing, and it should not be described to a user as one.

The known boundary case is the formal notice. "Take notice that unless the sum
of £420 is paid…" is operative in the sense that it triggers consequences, but
it is a communication sent to a person, so it is treated as correspondence
unless a second marker corroborates. `tests/render/instrument.test.ts` holds
the counterexamples that fix this line.

## Testing

`tests/render/instrument.test.ts` — the detector, counterexamples first, per
invariant 7. `tests/render/generated.test.ts` — the four gates through the
pipeline, including the assertion that `render` is never reached for instrument
text.
