# Suggestion Review Interface Contract

**Checkpoint date:** 2026-09-17

The first review-interface layer is framework-neutral. It converts an existing suggestion application proposal into a safe view model and records one explicit approval or rejection. It does not render a browser screen, mutate an email or document, authenticate a user, or persist an audit record.

## Prepare a review

`prepareSuggestionReview(proposal)` independently rebuilds the proposal before returning display data. If the source, candidate, target, level or semantic context no longer matches the proposal identifier, preparation fails.

The returned review contains:

- exact source and candidate text;
- the selected target and PGS recommendation level;
- a compact diff with common prefix/suffix, removed/inserted text and source/candidate ranges;
- the recomputed fidelity status and complete findings;
- blocking reasons;
- `approveEnabled`, which is false whenever deterministic approval is blocked;
- an always-available reject control; and
- `defaultDecision: 'reject'`.

Review data is returned as a snapshot. A UI may annotate or transform its own view without mutating the underlying application proposal.

## Record a decision

`decideSuggestionReview(proposal, decision)` accepts only:

- the exact proposal identifier;
- an explicit `approve` or `reject` value; and
- a non-empty reviewer identity supplied by the integrating application.

Approval re-runs proposal and fidelity validation through the existing approval boundary. A successful approval returns an `ApprovedSuggestionApplication`, which remains non-mutating until an application adapter receives it.

Rejection returns `application: null`, including for blocked proposals. An optional reason is trimmed and retained in the outcome.

## Example

```ts
const proposal = prepareTextChange(
  { kind: 'body' },
  'Maybe it will work.',
  'I am uncertain whether it will work.',
  'PGS-L1',
);

const review = prepareSuggestionReview(proposal);

const outcome = decideSuggestionReview(proposal, {
  proposalId: review.proposalId,
  decision: 'approve',
  reviewedBy: authenticatedPrincipal.id,
});
```

## Trust boundary

The engine requires a reviewer identifier but does not authenticate it. The integrating application must derive `reviewedBy` from an authenticated principal rather than editable form input. It must also persist the proposal, decision, reviewer, reason and application result if durable auditability is required.

The view model is not authorization. Only `decideSuggestionReview` can produce an approved application, and the existing application functions still refuse stale source content.

## Remaining interface work

- Implement a visual component over this contract with accessible diff semantics and keyboard-safe controls.
- Preserve rejection as the initial state in every client.
- Display all blocked and review-required fidelity findings without collapsing their severity.
- Surface stale-source failure as a request for a fresh proposal.
- Add persistent, authenticated audit records outside the linguistic engine.
