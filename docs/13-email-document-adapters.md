# Email and Text Document Analysis Adapters

**Checkpoint date:** 2026-09-17

The first channel adapters expose deterministic, analysis-only entrypoints over the universal PGS engine:

- `analyseEmail(input)` preserves an email snapshot and analyses its supplied subject and body independently.
- `analyseTextDocument(input)` preserves plain text or Markdown and analyses eligible sections with exact source offsets.

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

Protected sections are never submitted to the language analyser. Defined or otherwise protected terms can be carried in `protectedTerms` for later transformation workflows; this analysis-only adapter does not transform any text.

## Safety and authorization

The adapters never:

- invent an actor, identity, motive, date, quantity, evidential basis or certainty;
- use thread or attachment content as unstated evidence for the email;
- rewrite a subject, body, thread message or attachment;
- treat a model determination as authorization to transform content.

Recommendation and transformation workflows remain separate. A caller may explicitly pass selected source text through `suggest` and must retain the existing fidelity gate and local-only semantic-engine boundary.

## Example

```ts
import { analyseEmail, analyseTextDocument } from 'positive-grammar-syntax';

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
```
