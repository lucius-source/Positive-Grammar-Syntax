# Positive Grammar Syntax — Development Roadmap

## Current checkpoint — 2026-09-17

The local CLI and private engine API foundation now span parts of Phases 2–6: all 50 canonical cases in an executable local corpus, typed deterministic PGS-PIR, bounded conditional, action, contrast and causal proposition alignment, conservative rendering and fidelity comparison, a validated local Ollama semantic adapter, 19 deterministic adversarial fidelity mutations, 24 property-style mutation cases, and analysis-only email and plain-text/Markdown adapters. This is a verified vertical slice rather than completion of those phases. See `docs/11-local-cli-milestone.md` and `docs/13-email-document-adapters.md`.

## Phase 0 — Foundation

Define project purpose, terminology, governing hierarchy, seven rules, protected exceptions, architecture and Codex instructions.

**Exit condition:** the project can explain what PGS is, what it is not, and which sources are normative.

## Phase 1 — Language Specification

Expand each rule into testable definitions covering detection, transformation, counterexamples, protected exceptions, severity and interaction with other rules.

Deliverables include `patterns.yaml`, `exceptions.yaml`, terminology, examples and rule interaction policy.

**Exit condition:** two independent implementers can interpret the rules with substantially consistent outcomes.

## Phase 2 — Corpus and Evaluation Harness

Create a versioned corpus containing ordinary English, email, professional writing, legal/formal examples, negative constructions, ambiguous cases and adversarial counterexamples.

Define scoring and semantic-fidelity tests before optimising transformation behaviour.

**Exit condition:** rule changes can be evaluated against repeatable fixtures and regression tests.

## Phase 3 — Core PGS Engine

Implement a TypeScript package exposing structured operations:

- analyse
- score
- suggest
- transform
- compare
- explain

Separate deterministic detectors from model-assisted components.

**Exit condition:** a text input can produce typed PGS findings with rule IDs and fidelity checks.

## Phase 4 — Model-Assisted Language Layer

Add pluggable LLM providers for context-sensitive classification and transformation. Providers must implement the PGS specification rather than becoming the source of the specification.

Support local/private models as a first-class architectural requirement alongside cloud providers.

**Exit condition:** model providers can be changed without changing the PGS output contract.

## Phase 5 — Email Adapter

Implement the procedure in `docs/07-email-procedure.md`, including thread context, subject/body handling, attachments, analysis, recommendations, transformation and fidelity comparison.

**Exit condition:** PGS can review an arbitrary email through the universal engine without email-specific rules altering the core language standard.

## Phase 6 — Document Adapters

Support plain text and Markdown first, followed by DOCX/PDF ingestion and document-aware analysis. Preserve structural elements, quotations, defined terms and protected text.

**Exit condition:** documents and email attachments can be processed through the same rule engine with appropriate structural context.

## Phase 7 — API and Web Application

Provide a typed Node.js API and React/Next.js interface suitable for Vercel deployment. The UI should support source, findings, rule explanations, proposed transformation, diff/comparison and training modes.

Wix Headless may be integrated for authentication, subscriptions, CMS, CRM and database capabilities where product requirements call for them.

**Exit condition:** users can interact with PGS without direct repository or CLI access.

## Phase 8 — Ubiquitous Integrations

Develop adapters/integrations for messaging, browser workflows, AI prompts, productivity tools and other channels. Explore real-time speech/transcription only after text behaviour is validated.

**Exit condition:** the PGS specification operates consistently across multiple communication surfaces.

## Change-control principle

Language behaviour is product behaviour. Changes to normative PGS rules require specification changes, corpus/test updates and documented rationale before release.
