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

Foundation/specification phase. See `AGENTS.md`, `docs/` and `specification/` before implementing transformation behaviour.

## Local CLI

With Ollama running and `qwen3.8:latest` installed, run the local analysis pipeline with:

```bash
npm run pgs -- "They deliberately ignored my email."
```

The CLI performs deterministic PGS-PIR analysis first, requests semantic determination only when review is required, validates the model's JSON response, and applies an initial fidelity gate before displaying recommendations. The semantic adapter accepts local engines only; it has no cloud fallback. Configure another local Ollama model or endpoint with `PGS_OLLAMA_MODEL` and `PGS_OLLAMA_URL`.

Supply facts and intended action only when they are known:

```bash
npm run pgs -- "They deliberately ignored my email." \
  --fact "I sent the email" \
  --fact "I have not received a response" \
  --intent "Please confirm receipt and review"
```

Facts and intent are recorded separately in the report and are the only additional content allowed into context-aware recommendations.

Each recommendation also passes through a deterministic source-to-candidate comparator. It blocks removed negation or conditions, changed or invented quantities and times, upgraded certainty, and actors or actions absent from the source and verified context.

Conservative PGS-L1 rendering currently covers explicit non-consent, stated uncertainty, unsupported certainty markers, and motive attribution. Every changed recommendation reports the governing PGS rule IDs; unrecognised or unsafe constructions preserve the source instead of forcing a rewrite.

Run the executable local fidelity corpus with:

```bash
npm run eval:local
```

This gate exercises ambiguity, motive attribution, safety and medical negation, vague timing, unsupported certainty, operative refusal, quantities, and a positive control against the configured local Ollama model.
