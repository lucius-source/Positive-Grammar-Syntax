# Local PGS CLI Foundation Milestone

**Checkpoint date:** 2026-09-17

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
- Conservative intra-sentence proposition alignment for explicit comma-`so` action, contrast and causal clauses.
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
- Embedded condition preservation for constructions such as conditional apologies.
- Deterministic distinction between possibility, ability, intention, commitment, obligation and probability modalities.
- Experiential-status preservation and epistemic calibration for spiritual or energetic claims.
- Conservative handling for claimed legal effects, formal syntax, null chains, double negatives and asserted knowledge.
- Structurally verified double-negative conditional contraposition.
- Executable local evaluation corpus with per-case progress and selectable case IDs.
- Stable, versioned `pgs.output.v1` JSON envelopes for analysis and evaluation commands.
- Canonical identifiers in executable evaluation results for traceability to the specification corpus.
- Executable adversarial fidelity corpus with versioned JSON output and selectable mutation IDs.
- Deterministic property-style mutation matrices covering actor, action, date, quantity, motive, evidence and modality preservation.
- Source-level `analyse`, `suggest`, `compare` and `explain` engine operations with an explicit local-only semantic boundary.
- Compiled private ESM package boundary with declarations, declaration maps and a narrow verified export surface.
- Deterministic email analysis adapter preserving subject, body, participants, thread and attachment snapshots without merging contextual text into source analysis.
- Plain-text and Markdown analysis adapter with exact source offsets and protected quotation and fenced-code sections.
- Conservative cross-document dependency reporting that leaves ambiguous attachment references unresolved.
- Explicit selected-content suggestion orchestration for email fields and text-document sections.
- Protected-section rejection and recommendation withholding when fidelity findings are blocked.
- Deterministic non-mutating diffs, explicit approval and copy-on-write application for selected email/document recommendations.
- Revalidation at approval and stale-source rejection at application.
- Hosted CI verification for source, tests, package boundary and deterministic fidelity artifacts.

## Fidelity behavior

The current fidelity layer blocks:

- removed material negation;
- invented material negation;
- removed or invented conditions;
- omitted, changed or invented quantities and temporal content;
- certainty upgrades;
- unauthorized actor or action introduction;
- invented motive or evidential basis;
- changed source modality;
- removed user-protected terms.

It marks omitted known actors or source actions as `review_required`. A verified `if` to `only if` contraposition also remains `review_required`, even when the deterministic structure establishes the supported equivalence pattern.

No model determination alone can resolve deterministic ambiguity. References require explicit bindings. Belief, inference and unclassified evidence remain insufficient. Motive and intention require documented evidence or an attributed admission.

## Verification record

At this checkpoint:

- `npm run typecheck`: pass
- `npm test`: 169/169 tests passed across 20 files
- `npm run build` and `npm run verify:package`: pass
- `npm run artifacts:ci`: deterministic `pgs.output.v1` artifact reproduced byte-for-byte
- `npm run eval:fidelity`: 19/19 deterministic mutation cases passed
- Live canonical regression: 47 unaffected cases passed in the strengthened full run; the 3 affected equivalence cases then passed 3/3 after narrow fixes
- Live public `suggest` operation: local Ollama response validated; unresolved reference, motive, actor and epistemic status retained; L2 withheld; no blocked fidelity finding

The local corpus covers all 50 canonical cases, including ambiguity, motive attribution, protected legal/medical/safety negation, timing, certainty, consent/refusal, quantities, verified context, evidence sufficiency, conditionals, tense, pronouns, figurative language, speech acts, modality, spiritual experience and assertions, claimed legal effects, formal/null syntax, lexical restraint, double negatives, requirements, evidential claims and complete positive controls.

## Known limitations

- Deterministic action extraction uses a controlled vocabulary rather than a general syntactic parser.
- Domain classification is intentionally conservative and lexical.
- Natural rendering covers selected specification-backed structures, not arbitrary English.
- Reference binding substitution is limited to straightforward personal-pronoun cases.
- Evidence sufficiency records type and provenance but does not authenticate external evidence.
- Candidate PIR comparison uses semantic action families only for a small set of known equivalents.
- Conditional contraposition supports one verified two-proposition pattern; broader logical transformations are not yet authorized.
- The executable evaluation corpus covers all 50 canonical cases plus 19 adversarial mutations, with 24 additional deterministic property-style mutations; broader generative fuzz coverage remains incomplete.
- The email and text-document adapters can prepare and apply explicitly approved text replacements, but visual diff presentation, persistent approval records, DOCX/PDF ingestion and a user interface remain future work.
- The compiled engine package remains private and unpublished.

## Recommended next milestone

Extend the verified engine boundary and deterministic alignment without broadening unsafe rewrites. The next work should prioritize:

1. Add an explicitly provisioned local-model or self-hosted live evaluation workflow.
2. Expand from deterministic property matrices to seeded generative fuzz coverage.
3. Define release/versioning criteria for the private package boundary.
4. Extend controlled proposition alignment only where relation direction and actor boundaries can be verified.
5. Build a review interface over the explicit proposal and approval contract without weakening it.

The governing order remains semantic fidelity, factual accuracy, clarity, agency, precision, constructive expression and concision.
