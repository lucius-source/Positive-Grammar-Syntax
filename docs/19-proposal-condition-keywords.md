# Proposal — condition keywords that are not conditions

**Status: PROPOSED. Nothing in `specification/` has been changed, and the
recommendation is to change no engine rule.** The substance here is a
measured NEGATIVE result: the obvious fix is wrong, and shipping it would
reopen a hole of the same shape as the one closed earlier today.

**Raised:** 2026-10-30, from a member's own sentence, against engine
`0c23b70b`.

---

## 1. The finding

A member typed:

> I dont like governmnent interference and invasion **if** privacy

`if` is a typo for `of`. The generated rewrite corrected it, and
`compareFidelity` blocked the wording:

```
FIDELITY_CONDITION_REMOVED  (if)
```

So **a typo cannot be corrected when the typo happens to spell a protected
keyword.** The member is told their meaning changed, and the thing that
"changed" is a spelling mistake being fixed.

Two other defects in the same sentence were fixed and shipped today — the
negation lexicon and the auxiliary `do`. This is the one left.

---

## 2. The obvious fix, and why it is wrong

`CONDITION` is a surface pattern: `if|unless|provided that|only if`. The
parser, meanwhile, resolves real conditionals into a relation. Measured:

| | propositions | relation | `conditions` field |
|---|---|---|---|
| "If payment is not received…, we will not proceed." | 2 | `condition(If)` | `"P1 via if"` |
| "Unless you reply by Friday, the order is cancelled." | 2 | `condition(Unless)` | `"P1 via unless"` |
| **"…invasion if privacy"** | **1** | **none** | `"if privacy"` (raw text) |

That looks decisive: drive the rule off the parsed relation rather than the
keyword, and the typo stops matching.

**It is not decisive. It is a trap.** Over ten sentences carrying a condition
keyword, six have no parsed `condition` relation — and five of those six are
genuine conditionals:

```
REGEX ONLY  "We will proceed if you confirm."
REGEX ONLY  "Pay by Friday if you can."
REGEX ONLY  "Provided that the form is signed, we will proceed."
REGEX ONLY  "I will attend if invited."
REGEX ONLY  "Let me know if there is a problem."
REGEX ONLY  "…invasion if privacy"                    <- the only typo
```

The parser builds a `condition` relation only for the two-proposition shapes
it recognises. Switching the comparator to that signal would **stop protecting
conditions in five of six real cases** in order to fix one typo.

That is the same trade the negation lexicon had already made by accident, and
it cost `preserve_necessary_negation` 22 of 34 reversals. **Making it
deliberately, in a second rule, would be worse than the bug.**

---

## 3. Recommendation: change no engine rule

The asymmetry decides it.

| | cost |
|---|---|
| leave it | a typo that spells a keyword cannot be corrected; the member sees a confusing refusal |
| "fix" it with the parsed relation | conditions stop being protected in most real sentences |

A refusal a member can read and work around is not in the same category as a
protection that quietly stops applying. The surface check stays.

### What to do instead — and it is not in this repository

**Show the member WHY it was withheld.** The comparator already attaches its
issues to a blocked recommendation, and `compareFidelity` already names the
evidence — the literal string `if`. The portal's UI drops that on the withheld
path and prints only "The generated wording changed the meaning of the
source, so it is withheld."

Had the member seen

> Candidate removes a source condition. — **if**

they would have spotted their own typo in seconds, and so would anyone
reading the bug report. This costs nothing, risks nothing, and belongs in
`src/components/pgs/review-form.tsx` in the portal rather than here.

---

## 4. What is still unsolved, and should not be pretended otherwise

The real class is wider than `if`: **a rewrite cannot correct a typo that
spells a protected keyword.** `no` for `on`, `not` for `nor`, `cant` for
`cart` — anything in `NEGATION`, `CONDITION`, `MODAL` or `QUANTITY` has the
same shape.

Nothing here addresses that, and none of the approaches considered works:

- *Require a clause after the keyword.* "if invited" and "if possible" are
  real conditionals with no clause and no verb. Fails.
- *Require the parsed relation.* §2. Fails, expensively.
- *Detect a near-homograph substitution* — the candidate replaces `if` with
  `of` in the same position. Narrow enough to be safe, but it is one typo
  pair, and the next member will type a different one.

The honest position is that fidelity comparison on text containing typos is
an open problem, and that PGS's input is text containing typos. Worth stating
plainly somewhere a reader will find it, rather than being rediscovered by
the next person who types quickly.

---

## 5. What a decision needs to settle

1. **Accept the recommendation to change nothing here?** The default is the
   status quo, so a decision is only needed to depart from it.
2. **Approve the portal UI change** — show fidelity issues on a withheld
   wording. Separate repository, no engine impact, and it is the whole of the
   practical remedy.
3. **Is the typo class worth its own work later?** It is not a one-line fix
   and it is not urgent, but it recurs for every protected lexicon.

---

## 6. Provenance

Found 2026-10-30 from the first sentence a member typed into the live page.
Three defects came out of it; two were real bugs and were fixed the same day.
This one looked like the third and turned out to be a design limit with a
tempting wrong answer — which is the only reason it is a document rather than
a commit.

The measurement in §2 was run before the fix was written, not after. Had it
been run after, the fix would already have shipped.
