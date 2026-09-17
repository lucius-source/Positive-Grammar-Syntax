# Suggestion Approval and Application Boundary

**Checkpoint date:** 2026-09-17

PGS keeps recommendation generation separate from authorization and application. A recommendation cannot directly alter an email or document.

## Contract

The boundary has three explicit stages:

1. `prepareSuggestionApplication` selects an available PGS-L1 or PGS-L2 recommendation and produces a non-mutating proposal. `prepareTextChange` provides the same boundary for an already chosen source and candidate.
2. `approveSuggestionApplication` accepts only an explicit `approved: true` decision whose proposal identifier matches. It independently rebuilds the proposal and re-runs deterministic fidelity verification.
3. `applyApprovedEmailSuggestion` or `applyApprovedTextDocumentSuggestion` re-analyses the current target, verifies that its selected source is unchanged, and returns a changed copy.

No stage mutates caller-owned data. Withheld suggestions, no-op candidates, blocked fidelity results, protected document sections, unknown targets and stale source content are rejected.

## Proposal contents

Each proposal records:

- the exact selected target;
- source and candidate text;
- requested PGS level;
- a compact replacement span;
- the complete deterministic fidelity result;
- blockers and whether approval is allowed;
- relevant semantic context; and
- a deterministic proposal identifier covering the target, level, source, candidate and context.

The identifier prevents a decision for one proposal from being accidentally reused for another. It is not a cryptographic signature. Authentication, durable audit storage and access control belong to the integrating application.

## Safety properties

- Explicit approval is mandatory even when fidelity passes.
- Stored approval flags are not trusted; fidelity is recomputed at approval time.
- Application fails closed if the source changed after approval.
- Markdown wrappers and email-field surrounding whitespace are preserved.
- Only the explicitly selected email field or attachment/document section is replaced.
- The original email or document remains unchanged.
- The boundary never creates actor identity, motive, dates, quantities, evidence or certainty; the existing fidelity comparator blocks those changes.

## Intended interface flow

A user interface should display the proposal's source, candidate, replacement span and fidelity findings before enabling approval. It should retain rejection as the default, capture an authenticated approver separately, and call application only with the exact approved proposal. It must surface stale-source refusal as a request to generate and review a new proposal rather than silently rebasing the old change.
