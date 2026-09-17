# Positive Grammar Syntax (PGS)

Positive Grammar Syntax is a universal language-analysis, transformation and training system for producing concise, direct, affirmative, explicit and agency-preserving English while maintaining semantic fidelity, factual precision, necessary warnings and linguistic nuance.

## Governing hierarchy

PGS applies this precedence whenever principles compete:

1. Semantic fidelity
2. Factual accuracy
3. Clarity
4. Agency
5. Precision
6. Constructive expression
7. Concision

Positive construction never overrides factual meaning.

## Core transformation model

PGS analyses communication through:

**Actor → Observation → Meaning → Intention → Action**

These components are descriptive tools, not mandatory surface syntax. The system must preserve natural English and context.

## Seven core rules

1. **Explicit agency** — identify the actor responsible for an action where agency is material.
2. **Observation before interpretation** — distinguish observable information from inference, judgement or conclusion.
3. **Affirmative outcome** — express the desired state wherever doing so preserves meaning.
4. **Temporal specificity** — replace unnecessary temporal ambiguity with appropriate explicit timing.
5. **Epistemic precision** — distinguish observation, inference, belief, assumption and knowledge.
6. **Action orientation** — convert unresolved complaint into a request, remedy, decision or proposed action where appropriate.
7. **Constructive negation** — replace unnecessary negative construction with affirmative intent while retaining necessary legal, factual, logical and safety-critical negation.

## Product architecture

The project is specification-first. The PGS specification is independent from any particular LLM, prompt, user interface or communications channel.

The intended architecture is:

`PGS Specification → Core Engine → Channel Adapters → Interfaces / Integrations`

Initial adapters include email and general documents, followed by chat, web/API and additional communications channels.

The core engine should support at least: analyse, explain, suggest, rewrite, compare and teach modes.

## Technology direction

The portable language engine will be implemented in TypeScript/Node.js and remain separable from application infrastructure. The intended web implementation uses React/Next.js on Vercel, with Wix Headless available for application/backend capabilities. Linguistic intelligence must remain portable and must not depend upon Wix.

## Project status

The local CLI and compiled private engine API foundation are implemented and verified. The current checkpoint passes 147 automated tests, including 24 property-style fidelity mutations, all 50 canonical cases in the local-model evaluation gate, and 19 deterministic adversarial fidelity mutations. General linguistic coverage and the broader application remain in development; see `docs/11-local-cli-milestone.md` for supported behavior and `docs/12-engine-api.md` for the API contract.

## Engine API

The package root exports `analyse`, `suggest`, `compare`, `explain`, and the local `OllamaSemanticEngine`. Deterministic operations never call a model; `suggest` requires an explicitly supplied local semantic engine whenever semantic review is necessary.

```ts
import { OllamaSemanticEngine, analyse, compare, explain, suggest } from 'positive-grammar-syntax';

const analysis = analyse('Maybe it will work.');
const explanation = explain('Maybe it will work.');
const suggestion = await suggest('They deliberately ignored my email.', {
  engine: new OllamaSemanticEngine(),
});
const fidelity = compare('Send the report.', 'Send the report by 2026-10-01.');
```

The former rule-only analysis helper remains available internally as `analyseRules`. Run `npm run build` to emit the private ESM package and TypeScript declarations into `dist`; `npm run check` also verifies the built package through its public export map. The package remains marked private and is not published.

## Local CLI

With Ollama running and `qwen3.8:latest` installed, run the local analysis pipeline with:

```bash
npm run pgs -- "They deliberately ignored my email."
```

The CLI performs deterministic PGS-PIR analysis first, requests semantic determination only when review is required, validates the model's JSON response, and applies an initial fidelity gate before displaying recommendations. The semantic adapter accepts local engines only; it has no cloud fallback. Configure another local Ollama model or endpoint with `PGS_OLLAMA_MODEL` and `PGS_OLLAMA_URL`; override the four-minute local request ceiling with `PGS_OLLAMA_TIMEOUT_MS` when needed.

Add `--json` for a versioned `pgs.output.v1` machine-readable envelope:

```bash
npm run --silent pgs -- "Maybe it will work." --json
npm run --silent eval:local -- --json
npm run --silent eval:fidelity -- --json
```

Evaluation progress remains on stderr so redirected stdout contains valid JSON only.

Supply facts and intended action only when they are known:

```bash
npm run pgs -- "They deliberately ignored my email." \
  --bind "they=Acme support team" \
  --fact "I sent the email" \
  --fact "I have not received a response" \
  --intent "Please confirm receipt and review"
```

Facts and intent are recorded separately in the report and are the only additional content allowed into context-aware recommendations.

Use `--bind "reference=entity"` for an explicit referential resolution and `--evidence "field:kind=statement"` for field-specific supporting evidence. Evidence kinds are `direct_observation`, `documented`, `attributed_admission`, `inference`, `belief`, and `unclassified`. Belief, inference, and unclassified evidence remain unresolved. Motive and intention require documented evidence or an attributed admission. The resolution ledger records provenance; a model assessment alone cannot resolve deterministic ambiguity.

For example, binding `they=Acme support team` resolves only the reference. Motive remains unresolved unless separate motive evidence is supplied.

Each recommendation also passes through a deterministic source-to-candidate comparator. It blocks removed or invented negation and conditions, changed modality, invented motive or evidence, removed protected terms, changed or invented quantities and times, upgraded certainty, and actors or actions absent from the source and verified context.

The comparator also analyses the candidate as PIR. Omitted source actions or known actors produce `review_required` findings rather than assumed equivalence; hard invariant violations remain blocked.

Legal, medical, and safety language receives conservative deterministic domain classification. Material negation in these domains is marked as protected even when it is a factual statement rather than an instruction.

Intra-sentence `if` and `unless` constructions are represented as separate antecedent and consequent propositions joined by a deterministic condition relation. Negation participating in that relation is marked `conditional_negation` and protected.

A double-negative `if` condition may render as an affirmative `only if` contraposition only when source and candidate PIR both contain the same two action relations and temporal content with reversed proposition polarity. The fidelity report records this as structurally equivalent while retaining `review_required` status.

Conservative PGS-L1 rendering currently covers explicit non-consent, stated uncertainty, unsupported certainty markers, motive attribution, unidentified passive responsibility, absolute relational generalisation, present inability, and unsupported failure prediction. Every changed recommendation reports the governing PGS rule IDs; unrecognised or unsafe constructions preserve the source instead of forcing a rewrite.

The deterministic proposition seed records recoverable PIR fields—including actor, action or relation, object or target, reported observation, intention, requested action, time, conditions, and quantities—while representing unresolved actors as `null`. Selected recommendations render from those fields, allowing equivalent paraphrases to follow the same rule-traced path.

Controlled comma-`so` coordination is aligned as separate desired-state and action propositions only when the right side has an explicit clause actor. Explicit contrast clauses using `but`, `yet`, `however` or leading `although`, and causal clauses using `because`, `therefore`, `thus` or `consequently`, are also aligned when both clauses have explicit actors. Contrast relations are deterministic; causal relations remain candidates for semantic review. Ordinary comma lists, adverbial `so` phrases and `because of` phrases remain unsplit.

Run the live canonical corpus and deterministic adversarial fidelity corpus with:

```bash
npm run eval:local
npm run eval:fidelity
```

The live gate exercises all 50 canonical cases against the configured local Ollama model. The adversarial gate runs without a model and verifies blocked mutations plus narrowly established equivalence controls. Automated tests also generate deterministic mutation matrices for actor, action, date, quantity, motive, evidence and modality changes.

Run the complete source, package and deterministic artifact checks with:

```bash
npm run check
npm run artifacts:ci
```

Hosted CI uploads `artifacts/ci/fidelity-evaluation.json`. The Ollama-dependent live gate remains a separate local verification and never falls back to a cloud provider.
