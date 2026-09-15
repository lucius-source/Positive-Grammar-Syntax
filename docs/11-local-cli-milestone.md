# Local PGS CLI Foundation Milestone

**Checkpoint date:** 2026-09-15

**Status:** verified local foundation/core-engine slice

**Semantic provider tested:** Ollama `qwen3.8:latest`

**Cloud fallback:** disabled

## Milestone outcome

The repository now contains an executable local PGS pipeline:

```bash
npm run pgs -- "They deliberately ignored my email."
```

The pipeline performs deterministic document and PGS-PIR analysis before requesting local semantic determination. Model output is treated as untrusted: reasoning is disabled, JSON is validated, proposition identifiers and source spans must remain unchanged, and recommendations pass through deterministic fidelity comparison.

This checkpoint establishes a working and tested architectural path. It does not establish general linguistic coverage or production readiness.

## Verified capabilities

- Sentence and multi-proposition document analysis.
- Deterministic PIR fields for actor, action/relation, object/target, epistemic status, speech act, time, quantities, conditions, ambiguity and protected content.
- Explicit `null` representation for unresolved actors.
- Local-only Ollama semantic determination with no cloud fallback.
- Strict semantic response envelope and PIR validation.
- Suppression of model reasoning traces through Ollama's `think: false` option.
- Resolution ledger separating source findings, user context and model assessments.
- Explicit reference bindings through `--bind`.
- Classified evidence through `--evidence`, with sufficiency rules for resolution.
- Verified facts and user intent through `--fact` and `--intent`.
- Conservative, rule-traced PGS-L1 and PGS-L2 recommendations.
- High-risk legal, medical and safety negation protection.
- Source-to-candidate lexical and PIR fidelity comparison.
- Conditional PIR for `if`, `unless` and `only if` constructions.
- Structurally verified double-negative conditional contraposition.
- Executable local evaluation corpus with per-case progress and selectable case IDs.

## Fidelity behavior

The current fidelity layer blocks:

- removed material negation;
- removed conditions;
- omitted, changed or invented quantities and temporal content;
- certainty upgrades;
- unauthorized actor or action introduction.

It marks omitted known actors or source actions as `review_required`. A verified `if` to `only if` contraposition also remains `review_required`, even when the deterministic structure establishes the supported equivalence pattern.

No model determination alone can resolve deterministic ambiguity. References require explicit bindings. Belief, inference and unclassified evidence remain insufficient. Motive and intention require documented evidence or an attributed admission.

## Verification record

At this checkpoint:

- `npm run typecheck`: pass
- `npm test`: 79/79 tests passed across 12 files
- `npm run eval:local`: 20/20 live cases passed
- Working tree before this documentation commit: clean

The local corpus covers ambiguity, motive attribution, safety and medical instructions, legal factual negation, vague timing, unsupported certainty, consent/refusal, quantities, positive controls, verified context, reference binding, evidence sufficiency, canonical/paraphrase pairs and conditional negation.

## Known limitations

- Deterministic action extraction uses a controlled vocabulary rather than a general syntactic parser.
- Domain classification is intentionally conservative and lexical.
- Natural rendering covers selected specification-backed structures, not arbitrary English.
- Reference binding substitution is limited to straightforward personal-pronoun cases.
- Evidence sufficiency records type and provenance but does not authenticate external evidence.
- Candidate PIR comparison uses semantic action families only for a small set of known equivalents.
- Conditional contraposition supports one verified two-proposition pattern; broader logical transformations are not yet authorized.
- The executable evaluation subset contains 20 cases; the canonical corpus contains 50 cases.
- There is no stable JSON CLI output, published package API, email adapter, document adapter or user interface yet.

## Recommended next milestone

Expand the executable evaluation gate toward the full canonical corpus before broadening free-form rendering. The next work should prioritize:

1. Machine-readable CLI output for repeatable evaluation artifacts.
2. More complete deterministic PIR extraction and proposition alignment.
3. Additional protected exception and counterexample coverage.
4. Gradual onboarding of canonical cases with explicit expected invariants.
5. Public `analyse`, `suggest`, `compare` and `explain` operations built on the verified pipeline.

The governing order remains semantic fidelity, factual accuracy, clarity, agency, precision, constructive expression and concision.
