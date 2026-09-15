# AGENTS.md — Positive Grammar Syntax

This file defines the standing instructions for Codex and other coding agents working in this repository.

## Mission

Build Positive Grammar Syntax (PGS) as a universal, specification-driven language analysis, transformation and training system. PGS should work across email, documents, chat, web interfaces, APIs and future communication channels.

## Normative sources

Treat these sources in order of authority:

1. `specification/` — normative machine-readable language rules.
2. `docs/` — human-readable definitions, rationale, procedures and architecture.
3. `tests/` and `corpus/validation/` — executable behavioural requirements.
4. `prompts/` — model instructions implementing the specification.
5. Application code — implementation only; it must not silently redefine PGS.

If sources conflict, flag the conflict rather than inventing a new rule.

## Non-negotiable invariants

1. Preserve semantic meaning unless the user explicitly requests substantive alteration.
2. Preserve necessary negation. Legal, factual, logical, medical, safety and evidential propositions may depend upon `not`, `no`, `never`, prohibitions or other negative forms.
3. Do not fabricate actors, facts, dates, certainty, intentions or requested actions.
4. Distinguish observation from interpretation and inference.
5. Never increase epistemic certainty without evidence.
6. Recommendations and transformations must be explainable by rule ID.
7. Every transformation rule requires tests, including counterexamples and exception cases.
8. Prefer deterministic analysis where reliable; use model-assisted analysis where linguistic context requires it.
9. The PGS specification must remain portable across model vendors and application channels.
10. Natural, expressive English is a requirement. Do not optimise scores by producing robotic language.

## Governing precedence

When objectives conflict, apply:

`semantic fidelity > factual accuracy > clarity > agency > precision > constructive expression > concision`

## Seven rules

- `PGS-001` Explicit Agency
- `PGS-002` Observation Before Interpretation
- `PGS-003` Affirmative Outcome
- `PGS-004` Temporal Specificity
- `PGS-005` Epistemic Precision
- `PGS-006` Action Orientation
- `PGS-007` Constructive Negation

Read `specification/rules.yaml` before implementing these rules.

## Engine contract

The core engine should expose distinct operations rather than treating rewriting as the only outcome:

- `analyse` — identify relevant rule conditions without changing source text.
- `score` — return transparent per-rule and aggregate measurements.
- `suggest` — propose changes without applying them.
- `transform` — produce a PGS-aligned version subject to fidelity constraints.
- `compare` — show material differences and reasons.
- `explain` — teach why findings or changes arise.

Preserve the original source alongside transformed output.

## Architecture

Keep the core engine independent from channel adapters and infrastructure.

Preferred stack:

- TypeScript / Node.js for the core engine and APIs.
- React / Next.js for the web client.
- Vercel-compatible deployment.
- Wix Headless may supply authentication, subscription, CMS, CRM and database capabilities where required, but the PGS engine must not depend on Wix.

Use typed interfaces and structured JSON outputs suitable for both UI and API consumers.

## Development procedure

Before implementing a feature:

1. Identify the applicable PGS rule(s).
2. Confirm the expected behaviour in the specification.
3. Add or update fixtures covering ordinary cases, counterexamples and protected exceptions.
4. Implement the smallest coherent behaviour.
5. Run tests and type checks.
6. Document any material behavioural decision.

For ambiguous language behaviour, create an issue or specification proposal instead of silently choosing policy in code.

## Initial priority

The first milestone is not a complete application. Build a validated PGS specification and evaluation harness first, then the core analysis engine, then email/document adapters, then user-facing interfaces.
