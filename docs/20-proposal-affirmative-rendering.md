# Proposal — the affirmative rendering nothing asks for

**Status: PROPOSED. Nothing in `specification/` has been changed.** Unlike
`docs/19`, this recommends change: three gaps, each measured, each necessary
and none of them sufficient alone.

**Raised:** 2026-10-31, against engine `142e835`, from the owner's statement
of what PGS is for:

> PGS should help clarify simple facts … so a user can instead explain what was
> absent from their order or deficient in their experience on a factual basis
> without using words like should not, do not, have not.

That is rule 7 — *constructive negation: replace unnecessary negative
construction with affirmative intent while retaining necessary legal, factual,
logical and safety-critical negation* — and the portal's
`docs/53-pgs-renderer-spec.md` specified it on 2026-10-27, quoting the same
requirement. It has not been implemented, and this records why in terms
precise enough to implement from.

---

## 1. Three gaps, measured

Run through `npm run pgs` at `142e835`, with the local semantic engine.

### 1a. Detection never fires on a negative ASSERTION

```
SOURCE: I did not receive the invoice with my order.

DETERMINISTIC ANALYSIS
- P1: actor=speaker; action=receive; object=the invoice with my order;
      speech-act=assertion; ambiguity=none
```

No `protected` marker and **no PGS-007**. `src/core/rules.ts:47-52` raises
PGS-007 on exactly two paths: a `negativeInstruction` match, or
`classifyProtectedDomain` plus a material negation. A plain negative assertion
in an unprotected domain matches neither.

So for the owner's primary case — stating what was absent from an order — the
rule whose message is *"otherwise consider an affirmative desired state"* never
runs. The engine sees the negation (`polarity: negative` is determined) and no
rule asks what to do about it.

### 1b. The determination is never asked for the fields the spec needs

`docs/53` §4.1 requires a conforming engine to set `negation.necessary`, and
`desiredState`/`requestedAction` when `necessary` is false.
`src/semantic/prompts.ts` mentions affirmative language once, as a restraint:

> Preferred affirmative language is subordinate to fidelity. Never change
> technical or legal meaning merely to remove a negative construction.

That sentence is correct and should stay. It is also the only one, so the model
is told what not to do and never asked for either field. The measurement
agrees — seven determinations came back for the sentence above
(`epistemicStatus`, `fidelityStatus`, `actor`, `actionOrRelation`,
`objectOrTarget`, `polarity`, `speechAct`) and `negation.necessary` was not
among them.

### 1c. Nothing composes

`renderRecommendations` consults `negation.necessary` twice
(`src/render/recommendations.ts:173,235`) and both are GUARDS on unrelated
rules — inability and absolute-generalisation — which decline to fire when a
negation is necessary. There is no branch for `docs/53` §4.2 row 1.

`naturalL1` is a table of regex shapes whose fall-through returns the source,
as `docs/17` recorded (L1 identical to the source, 9 of 12). Worth noting what
the shapes it does handle produce:

| source | rendered |
|---|---|
| `I can't attend.` | `I am not currently able to attend.` |
| `The report is bad.` | `The criteria for this evaluation of the report are not stated.` |
| `You never listen.` | `I believe you rarely listen.` |

Two of the three outputs introduce or keep a negation. These are calibration
and clarity rules. **No rule in the table produces an affirmative
construction**, which is consistent: none was written to.

---

## 2. The framing error, and it is the interesting part

`Do not park here.` is `docs/53`'s case 1, and the one input where PGS-007 does
fire. The spec expects `necessary: false`, `desiredState: "this space stays
clear"`, and an affirmative candidate. What came back:

```
- P1 negation: protected — protected (The negation 'not' is operative and
  material to the prohibition; removing it would alter the semantic meaning
  from prohibition to permission.)
```

**The model is right about the question it was asked, and it was asked the
wrong question.** Deleting "not" does turn a prohibition into permission. But
rule 7 does not delete negations — it restates them:

| source | deletion | affirmative restatement |
|---|---|---|
| `Do not park here.` | `Park here.` — meaning inverted | `This space stays clear.` |
| `I did not receive the invoice.` | `I received the invoice.` — false | `The invoice is absent from what arrived.` |
| `They have not replied.` | `They replied.` — false | `A reply is outstanding.` |

The right-hand column preserves truth conditions exactly. It is the same fact,
without the negative construction, which is what the owner asked for and what
rule 7 describes.

So the determination must ask: **can this be said affirmatively without
changing what is true?** — not *may this negation be removed?* Those questions
have opposite answers on the spec's own worked example, which is why that
example fails today.

This also bounds the safety case. `I do not consent to this.` has no
truth-preserving affirmative restatement: consent withheld is not a state that
can be asserted positively without asserting consent. Rule 7's carve-out is
not a list of keywords to protect, it is this test failing — and a determination
asked the right question returns `necessary: true` for it on the merits.

---

## 3. What to change, in order

The order matters, because each step is measurable only once the one before it
exists.

**Step 1 — detection (`src/core/rules.ts`).** Raise PGS-007, or a sibling
pattern, on a negative assertion in an unprotected domain. The existing
`materialNegation` regex at line 51 already matches the right tokens; today it
is reachable only behind `classifyProtectedDomain`.

*Risk, and it is the one this repo has already paid:* `142e835` records that an
accidental widening of the negation lexicon cost `preserve_necessary_negation`
**22 of 34 reversals**. This step changes which sentences carry an `info`
finding and must not change which negations are protected. Gate on
`eval:fidelity` and `eval:fuzz` unchanged, and on that metric specifically.

**Step 2 — determination (`src/semantic/prompts.ts`).** Ask for
`negation.necessary` and, when false, `desiredState`/`requestedAction`, framed
as §2 above: truth-preserving affirmative restatement, not removal. Keep the
existing subordination sentence verbatim. Expected effect on `Do not park
here.`: `necessary: false`, `desiredState` populated. Expected effect on
`I do not consent to this.`: `necessary: true` with a reason.

**Step 3 — composition (`src/render/recommendations.ts`).** Implement
`docs/53` §4.2's four rows, §4.3's never-echo requirement including the
distinguishable "already affirmative" marker, and §4.4's `ruleIds` /
`supportingFields`. The composer is deterministic and the model supplies no
prose, which is `docs/53` §4.1 and the portal's claim that no language model
writes operative text.

---

## 4. What this does not propose

- **No change to `compareFidelity`.** An affirmative restatement that preserves
  truth conditions should pass it; one that does not should be blocked, and
  that is the comparator working. If step 3 produces candidates the comparator
  rejects, the candidates are wrong until measured otherwise.
- **No model-authored prose.** `docs/17`'s `PGS-L3-natural` remains the only
  level a model may write, separately labelled. This proposal is about L1/L2.
- **No keyword list for "necessary".** §2 argues the test is semantic.
  Hard-coding *consent*, *liable*, *contract*, *notice* would reproduce the
  lexicon trap `142e835` warns about, in the one place it does most harm.

## 5. Open, and the owner's to settle

The owner has offered reference material, and two choices want grounding
better than the author's intuition:

1. **What makes a negation unnecessary.** Step 2 asks a model to judge it. The
   owner named NLP and the pentagonal framing method as the bodies of knowledge
   to draw on; the engine's own `Actor → Observation → Meaning → Intention →
   Action` is five-part and may be the same thing, which wants confirming
   before it is written into a prompt as though it were.
2. **How far action orientation goes.** Rule 6 converts unresolved complaint
   into a request, remedy, decision or proposed action. `The invoice is absent
   from what arrived` is a restatement; `Please send the invoice` is a new
   speech act the member did not make. Step 3 should compose the first and not
   the second, unless the owner wants otherwise.
