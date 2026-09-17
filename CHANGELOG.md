# Changelog

## 0.2.0 — release candidate

This internal candidate intentionally changes deterministic analysis and fidelity behavior:

- Explicit `after` and `before` clauses are aligned as two propositions only when both sides contain a verified actor and controlled action.
- Temporal relations are directed chronologically regardless of whether the temporal clause appears first or last.
- Candidate text that removes, reverses or invents an explicitly established temporal order is blocked by fidelity comparison.
- Seeded fidelity fuzz coverage increases to 350 cases across 14 invariant families, including temporal-order inversion.

Compatibility note: callers analysing supported two-clause temporal constructions may now receive two propositions and a deterministic `temporal_sequence` relation where version 0.1.0 returned one proposition. Callers must consume proposition IDs and relations from the result rather than assuming one proposition per sentence.

The package remains private. Eligibility for an internal `v0.2.0` tag required the recorded 50-case local Ollama gate.

Release gate completed on 2026-09-17: 50/50 canonical cases passed on local `qwen3.8:latest`. See `docs/releases/0.2.0-rc.md` for the evaluated commit and artifact checksum.

## 0.1.0

Initial private engine checkpoint with deterministic PGS-PIR analysis, local-only semantic determination, fidelity comparison, email/document adapters and explicit suggestion approval/application boundaries.
