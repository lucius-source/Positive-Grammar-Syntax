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

## EXC-009 — the rule that forbade the fix

**Added 2026-10-30, after the first render eval.**

That eval found the generator safe and mostly inert: 0/8 unfaithful, but six
of eight rewrites no clearer than the source, and the flagship case — the
double negative used as the portal's own placeholder text — returned
essentially unchanged.

The cause was structural, not a prompt that needed another pass:

```
"I did not fail to send it."  →  "I sent it."
BLOCKED: FIDELITY_NEGATION_REMOVED
```

That rewrite is logically equivalent and plainly better, and the comparator
refused it. The comparator was not wrong — its message says "logical
equivalence is not established", which is exactly true, it could not establish
it. But the consequence was that PGS-003 Affirmative Outcome and PGS-007
Constructive Negation, two of the seven rules, could not be exercised at all.

EXC-001 had always been conditional: "preserve negation WHEN removing it would
alter the asserted fact." The code read it as absolute. EXC-009 implements the
condition rather than inventing a rule — parity, core identity and a scope
guard, all deterministic, and `review_required` rather than `pass`, because
structural verification is evidence and not a semantic guarantee.

**It fires rarely, and the reason matters.** PGS extracts actions from a closed
lexicon, so for most sentences `actionOrRelation` is undefined, and an action
PGS cannot see is not one it can verify. The limit is now parser coverage,
which can grow, rather than a blanket refusal, which cannot.

Measured after, on the same ten letters plus two that exercise the new path:

|  | before | after |
|---|---|---|
| wordings offered | 8/10 | 10/10 (12/12 corpus: 11) |
| unfaithful | 0/8 | 0/11 |
| clarity better | 2 | 3 |

The prompt had to change too — the comparator permitting an untangling is no
use while the renderer is told negation is untouchable. Both were needed, and
only the `double-neg-send` case is attributable to EXC-009 alone; the council
sentence improved because the prompt stopped forbidding it, and was never
blocked by the comparator because its rewrite kept a negation.

Run-to-run variation is real at this corpus size: two cases that scored
"better" in the first run scored "same" in the second. The offered and
unfaithful counts are the trustworthy numbers; the clarity split is not a
precise rate.

## Testing

`tests/render/instrument.test.ts` — the detector, counterexamples first, per
invariant 7. `tests/render/generated.test.ts` — the four gates through the
pipeline, including the assertion that `render` is never reached for instrument
text.
