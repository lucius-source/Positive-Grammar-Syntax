# PGS Engine API and Package Boundary

The private package boundary exports five primary operations, four channel-adapter operations, and the local Ollama adapter from the package root:

- `analyse(source)` performs deterministic document/PIR analysis, rule detection and validation without calling a model.
- `score(source)` returns a deterministic 0–100 analysis-readiness score with every deduction exposed. It does not score truth, writing quality, morality or the speaker.
- `suggest(source, options)` runs the verified recommendation pipeline. When semantic review is required, `options.engine` must be an explicitly supplied local semantic engine.
- `compare(source, candidate, options)` applies deterministic fidelity invariants to a proposed transformation.
- `explain(source)` returns deterministic rule, ambiguity and protected-content explanations without inventing resolution.
- `analyseEmail(input)` preserves and independently analyses supplied subject, body, thread and attachment structure.
- `analyseTextDocument(input)` preserves and analyses supplied plain text or Markdown with source-aligned protected sections.
- `suggestEmail(input, options)` runs suggestions only for explicitly selected email fields or attachment sections.
- `suggestTextDocument(input, options)` runs suggestions only for explicitly selected, non-protected document sections.

The earlier rule-only operation remains available as `analyseRules(source)`.

## Example

```ts
import {
  OllamaSemanticEngine,
  analyse,
  analyseEmail,
  analyseTextDocument,
  compare,
  explain,
  score,
  suggest,
  suggestEmail,
  suggestTextDocument,
} from 'positive-grammar-syntax';

const analysis = analyse('Maybe it will work.');
const readiness = score('Maybe it will work.');
const explanation = explain('Maybe it will work.');

const suggestion = await suggest('They deliberately ignored my email.', {
  engine: new OllamaSemanticEngine(),
});

const fidelity = compare(
  'Send the report.',
  'Send the report by 2026-10-01.',
);

const email = analyseEmail({ subject: 'Status', body: 'I sent the report.' });
const document = analyseTextDocument({
  format: 'markdown',
  text: '# Status\nI sent the report.\n',
});
const emailSuggestion = await suggestEmail(
  { body: 'I sent the report yesterday.' },
  { targets: [{ kind: 'body' }] },
);
const documentSuggestion = await suggestTextDocument(
  { format: 'markdown', text: '# Status\nI sent the report yesterday.\n' },
  { sectionIds: ['S2'] },
);
```

## Safety contract

- Empty source or candidate values are rejected.
- `analyse`, `score`, `compare`, `explain`, `analyseEmail` and `analyseTextDocument` are deterministic and do not call a model.
- A score is provisional whenever review is required or analysis is invalid. Protected content is reported but never penalised.
- Score deductions are bounded, machine-readable and traceable to validation errors, unresolved fields, rule findings or candidate relations.
- Email thread and attachment content is preserved but never silently merged into subject or body analysis context.
- Quoted Markdown and fenced code are protected from analysis; attachment references remain unresolved when their target is ambiguous.
- `suggest`, `suggestEmail` and `suggestTextDocument` do not silently continue through unresolved semantic review without an engine.
- Adapter suggestions require explicit, unique selections and reject protected sections.
- A selected source with any blocked fidelity finding is withheld rather than exposing recommendation text.
- Supplied semantic engines must report `providerKind: 'local'`; cloud engines are rejected even when deterministic review would otherwise be sufficient.
- Model output remains untrusted and is validated through the existing PGS-PIR, resolution-ledger and fidelity pipeline.
- User context remains explicitly typed and provenance-bearing; it is not merged into the source.

## Build and verification

```bash
npm run build
npm run verify:package
```

The build emits ESM JavaScript, source maps, declarations and declaration maps into `dist`. A narrow `src/public.ts` entrypoint controls the package's runtime surface. Package verification imports the emitted JavaScript through Node, type-checks a consumer importing by package name, and confirms the exact supported runtime export list, including `analyse`, `score`, `suggest`, `compare`, `explain`, the email/document adapters, approval/application operations and `OllamaSemanticEngine`.

The repository remains private and the package is not published. The compiled boundary is an internal integration artifact for application development. See `docs/13-email-document-adapters.md` for the adapter contract.
