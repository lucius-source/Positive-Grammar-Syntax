# Email and Text Document Analysis Adapters

**Checkpoint date:** 2026-09-17

The first channel adapters expose deterministic analysis, explicitly selected suggestion entrypoints and an approval-gated application boundary over the universal PGS engine:

- `analyseEmail(input)` preserves an email snapshot and analyses its supplied subject and body independently.
- `analyseTextDocument(input)` preserves plain text or Markdown and analyses eligible sections with exact source offsets.
- `suggestEmail(input, options)` suggests only for explicitly selected subject, body or text-attachment sections.
- `suggestTextDocument(input, options)` suggests only for explicitly selected, non-protected document sections.
- `prepareSuggestionApplication(suggestion, level)` converts one available recommendation into a deterministic diff proposal.
- `approveSuggestionApplication(proposal, decision)` requires an explicit matching approval and re-runs fidelity verification.
- `applyApprovedEmailSuggestion` and `applyApprovedTextDocumentSuggestion` return changed copies only when the approved source still matches.

These adapters do not add email- or document-specific grammar. They provide structure and provenance around the same `analyse` operation exported by the core engine.

## Email boundary

`analyseEmail` accepts optional sender, recipient, thread and attachment metadata, but requires non-empty subject or body text. The returned snapshot is copied from the caller's input so later caller mutations cannot change the analysis record.

Subject and body are analysed independently. Thread messages remain preserved context and are not silently merged into either analysis. Attachments are also preserved independently; only an explicitly supplied `plain_text` or `markdown` attachment document is sent through `analyseTextDocument`.

References to an attachment filename are reported as resolved dependencies. A generic phrase such as `the attached document` is resolved only when exactly one attachment was supplied. With zero or multiple attachments, the dependency remains unresolved rather than selecting or inventing a target.

## Document boundary

Plain text is retained as one source section. Markdown is scanned into source-aligned sections with exact `[start, end)` offsets:

- headings and ordinary text lines are analysed;
- block quotations are protected;
- fenced code markers and fenced code content are protected;
- blank lines remain in the immutable source even though they do not create analysis sections.

Protected sections are never submitted to the language analyser or suggestion pipeline. Defined or otherwise protected terms are carried in `protectedTerms` and enforced by the existing fidelity comparison.

## Selected-content suggestions

Suggestion entrypoints require an explicit selection: `targets` for email and `sectionIds` for a text document. They never infer that the whole email, document, thread or attachment should be changed. Duplicate, missing, unknown and protected selections are rejected before suggestion work begins.

Each selected source is routed through the same public `suggest` pipeline as a direct engine request. Semantic review therefore requires an explicitly supplied local engine, cloud providers remain rejected, model output remains untrusted, and all recommendations pass through deterministic fidelity verification. If any blocked fidelity finding remains for a selected source, that source returns a `withheld` disposition with no exposed recommendation text and retains the analysis and fidelity audit.

Thread messages remain context snapshots only. Attachment text is eligible only when supplied as a text document and when a specific non-protected section is selected. No selection causes text from one channel field to become evidence for another.

## Safety and authorization

The adapters never:

- invent an actor, identity, motive, date, quantity, evidential basis or certainty;
- use thread or attachment content as unstated evidence for the email;
- produce recommendations for unselected or protected content;
- treat a model determination as authorization to transform content.

The suggestion adapters return recommendations and audit data without mutation. Application is a separate three-stage operation: prepare, approve, then apply. Preparation exposes a compact replacement span and all fidelity findings. Approval re-computes the proposal fingerprint and fidelity decision rather than trusting mutable status fields. Application re-analyses the current content and refuses stale, unknown or protected targets. Successful application returns a copy and never mutates the caller's value.

The deterministic proposal identifier correlates an approval with its target, source, candidate, level and semantic context. It is an integrity guard inside the application contract, not a cryptographic signature or identity system. A product integration remains responsible for authenticating the approver and persisting its own audit record.

## Example

```ts
import {
  analyseEmail,
  analyseTextDocument,
  applyApprovedEmailSuggestion,
  approveSuggestionApplication,
  prepareSuggestionApplication,
  suggestEmail,
  suggestTextDocument,
} from 'positive-grammar-syntax';

const email = analyseEmail({
  subject: 'Status update',
  body: 'Please review the attached notice.',
  attachments: [{
    id: 'notice',
    name: 'notice.md',
    document: { format: 'markdown', text: '> Operative quoted text.\n' },
  }],
});

const document = analyseTextDocument({
  format: 'markdown',
  text: '# Status\nI sent the report.\n',
});

const emailSuggestions = await suggestEmail(email.email, {
  targets: [{ kind: 'body' }],
});

const documentSuggestions = await suggestTextDocument(document.document, {
  sectionIds: ['S2'],
});

const selected = emailSuggestions.suggestions[0];
if (selected?.disposition === 'available') {
  const proposal = prepareSuggestionApplication(selected, 'PGS-L1');
  const approved = approveSuggestionApplication(proposal, {
    proposalId: proposal.proposalId,
    approved: true,
  });
  const updatedEmail = applyApprovedEmailSuggestion(email.email, approved);
}
```
