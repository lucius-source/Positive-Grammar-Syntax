# Proposal — preserve evidential framing

**Status: ACCEPTED at `review_required`, owner, 2026-10-30. Implemented the
same day.** The document is kept as written, in the proposing voice, because
the measurement in §5 is the evidence the decision rests on and rewriting it
as a description would lose that. §8 records what was built.

**Raised:** 2026-10-30, by the render eval, against engine `7aca49f8`.

---

## 1. The finding

The PGS-L3 render eval put this pair in front of the fidelity comparator:

| | |
|---|---|
| source | It has been decided that your application will not be progressed at this time. |
| candidate | Your application will not be progressed at this time. |

`compareFidelity` returns **`pass`, with no issues at all.**

The eval's judge disagreed, and said why: *"Dropped 'It has been decided
that', which removes the framing of a decision having been made; also the
passive without an actor is lost, making it a flat statement of future fact."*

**This is not a generator problem.** The same gap is reachable today through
`/api/pgs/rewrite` in production: a member who writes that rewrite themselves
is told their meaning survived. The generator only found it first.

### What is actually lost

The source reports a decision: somebody, unnamed, decided something. The
candidate asserts an outcome. Those are different claims. The source attributes
the proposition to a source it does not name; the candidate owns it.

---

## 2. Why the comparator cannot see it

Not an oversight in the rules — the representation has nothing to compare.
Measured against the parser on 2026-10-30:

```
SOURCE    "It has been decided that your application will not be progressed…"
CANDIDATE "Your application will not be progressed at this time."

both →  propositions=1  actor=NULL  action=absent
        speechAct=assertion  epistemic=unknown  unresolved=["reference"]
```

**Byte-identical parses.** PGS extracts actions from a closed lexicon and
`decide` is not in it, so the framing clause contributes nothing: no second
proposition, no distinct speech act, no evidential marker. A comparator working
on the parsed representation has nothing to notice.

(For contrast, "Mistakes were made in the processing of my claim." *does* parse
to `action=make`, `unresolved=["actor"]`, `epistemic=alleged` — the agentless
passive is handled there. The lexicon reaches that construction and not this
one.)

---

## 3. This is a gap in an existing invariant, not a new one

`rules.yaml` already carries `never_increase_certainty_without_evidence`, and
`core/fidelity.ts` enforces it as `FIDELITY_CERTAINTY_UPGRADED`:

```
source has HEDGES  AND  candidate has none  AND  candidate has STRONG_CERTAINTY
```

`HEDGES` is `may|might|could|maybe|perhaps|possibly|uncertain|believe|think|assume|allege`.

That list is **epistemic modality** (may, might) and **mental-state verbs**
(believe, think, assume). It is not **evidentiality** — the marking of a
proposition as reported, decided or attributed rather than asserted. The single
exception is `allege`, which is evidential, and which suggests the boundary was
never drawn deliberately.

So the proposal is narrow: the invariant is right, and its implementation does
not cover the evidential case.

---

## 4. The proposed rule

> **PGS-F-EVID.** When the source frames a proposition as reported, decided or
> attributed, and the candidate asserts that proposition directly, the
> evidential frame has been lost. Raise `FIDELITY_FRAMING_REMOVED`.

Detection, surface-level and in the style of the comparator's existing classes:

```
it (has been|had been|was|is) (decided|agreed|determined|concluded|resolved|
                               found|held|understood|reported|alleged|
                               suggested|arranged|confirmed) that
(a|the) decision (has been|had been|was) (made|taken)
(I|we) (am|are|was|were|have been|has been) (told|advised|informed) that
it (is|was) (believed|thought|said|anticipated|expected) that
```

Fires when the source matches and the candidate does not.

**It must require the FRAME, not the bare verb.** "We decided to close the
account" is an assertion by a named actor and must not match; only the
impersonal or reported construction does.

### Severity — a real choice, not an obvious one

The analogous rule, `FIDELITY_CERTAINTY_UPGRADED`, is `blocked`. But it demands
three conditions where this demands one, so it is harder to trip by accident.

**Recommended: `review_required`.** The loss is pragmatic rather than a flat
contradiction, and the comparator cannot distinguish a careless flattening from
a deliberate and acceptable one. `review_required` shows the member what moved
and lets them decide, which is the posture EXC-009 already took for a verified
negation change.

`blocked` is defensible and is the owner's call. The cost of choosing wrong in
that direction is a correct rewrite refused; in the other, a flattened
attribution offered.

---

## 5. Measured before proposing

Against `corpus/evaluation/adversarial-fidelity.json`, all 19 cases:

```
0 of 19 would gain a new issue
```

Against hand-built pairs, 9 of 9 behave as intended — including three it should
flag and six it must not:

| pair | proposed | comparator today |
|---|---|---|
| the finding | flag | **pass** |
| "a decision has been taken to…" | flag | **pass** |
| "I am told that…" | flag | review_required |
| frame kept in the rewrite | — | pass |
| named actor, no frame | — | pass |
| hedge rather than frame | — | pass |
| removed negation | — | blocked |
| instrument | — | blocked |

The two `pass` rows in the first group are the gap. Nothing in the regression
corpus moves.

---

## 6. What this does not fix

**It is a surface pattern over a closed list.** It will miss every framing not
in the list — "the position taken is that…", "our understanding is that…",
"per the decision of the committee…" — and English has an open-ended supply.

**The real fix is in the parser.** If `analyseDocument` extracted the framing
clause as its own proposition with an unresolved actor, the existing
actor-and-proposition rules would cover this case and the whole family, without
a regex. That is the same conclusion EXC-009 reached from the other direction:
the limit is parser coverage, and widening it retires the surface rules rather
than adding to them.

Proposing the surface rule anyway, because it closes a reachable production gap
now and is cheap to retire later. It should be documented as provisional in
whatever accepts it.

---

## 7. What a decision needs to settle

1. **Accept the rule at all?** It makes the comparator stricter twelve days
   before launch, and the strictness falls on `/api/pgs/rewrite`, which is live.
2. **`review_required` or `blocked`?** §4.
3. **Where does it live?** It is a fidelity check, and the fidelity codes are
   presently only in `core/fidelity.ts` rather than in `specification/`. If it
   is accepted, the invariant list in `rules.yaml` is the honest home for the
   principle, with the pattern beside the other fidelity classes.
4. **Does the parser work get scheduled?** If yes, this is an interim measure
   with an owner and an end date. If no, it is permanent and its closed list
   will need maintaining.

---

## 8. What was decided, and what was built — 2026-10-30

Owner: **accept at `review_required`.** The four questions in §7, answered:

1. **Accepted**, with the live endpoint in view. `review_required` cannot turn
   a `pass` into a refusal, so no rewrite a member could previously adopt is
   now refused — they are shown what moved and decide.
2. **`review_required`**, as recommended.
3. **`specification/rules.yaml`**, as the invariant
   `preserve_evidential_framing`, beside
   `never_increase_certainty_without_evidence` whose gap it closes. The
   comment there points back to this document.
4. **Parser work: not scheduled.** So the surface list in §4 is the rule in
   force and its limits in §6 stand. It should be revisited when the parser's
   action lexicon is next widened, not before.

Built:

- `preserve_evidential_framing` in `specification/rules.yaml`.
- `EVIDENTIAL_FRAME` and `FIDELITY_FRAMING_REMOVED` in `core/fidelity.ts`,
  placed immediately after `FIDELITY_CERTAINTY_UPGRADED` because it closes
  that rule's gap.
- `tests/core/evidential-framing.test.ts` — 15 cases, counterexamples first,
  including the `g`-flag trap: the regex is non-global on purpose, because a
  global one carries `lastIndex` between calls and would answer the same
  comparison differently depending on what preceded it.
- `ADV-020` in `corpus/evaluation/adversarial-fidelity.json`, so the case that
  used to pass clean is pinned permanently rather than by a unit test alone.
  The corpus-size guard moves 19 → 20.

Verified: **281 tests** (from 266), **350 seeded fuzz cases**, **20/20
adversarial**, build and package verify.

**Still true, and not fixed by any of this:** the detector is a closed list of
surface patterns and will miss framings outside it. §6 is the honest statement
of what was bought.

---

## 9. Provenance

Found by `scripts/pgs-render-eval.mjs` in the portal, run against engine
`7aca49f8` on 2026-10-30: 10/12 wordings offered, **1 of 10 judged unfaithful**,
which was this case. Earlier runs of the same corpus scored 0/8 and 0/11
unfaithful — so the case appears intermittently, which is itself worth
recording. A gate that passes a bad rewrite sometimes is not meaningfully safer
than one that passes it often; it is only harder to notice.
