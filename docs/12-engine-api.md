# PGS Engine API and Package Boundary

The private package boundary exports four primary operations plus the local Ollama adapter from the package root:

- `analyse(source)` performs deterministic document/PIR analysis, rule detection and validation without calling a model.
- `suggest(source, options)` runs the verified recommendation pipeline. When semantic review is required, `options.engine` must be an explicitly supplied local semantic engine.
- `compare(source, candidate, options)` applies deterministic fidelity invariants to a proposed transformation.
- `explain(source)` returns deterministic rule, ambiguity and protected-content explanations without inventing resolution.

The earlier rule-only operation remains available as `analyseRules(source)`.

## Example

```ts
import {
  OllamaSemanticEngine,
  analyse,
  compare,
  explain,
  suggest,
} from 'positive-grammar-syntax';

const analysis = analyse('Maybe it will work.');
const explanation = explain('Maybe it will work.');

const suggestion = await suggest('They deliberately ignored my email.', {
  engine: new OllamaSemanticEngine(),
});

const fidelity = compare(
  'Send the report.',
  'Send the report by 2026-10-01.',
);
```

## Safety contract

- Empty source or candidate values are rejected.
- `analyse`, `compare` and `explain` are deterministic and do not call a model.
- `suggest` does not silently continue through unresolved semantic review without an engine.
- Supplied semantic engines must report `providerKind: 'local'`; cloud engines are rejected even when deterministic review would otherwise be sufficient.
- Model output remains untrusted and is validated through the existing PGS-PIR, resolution-ledger and fidelity pipeline.
- User context remains explicitly typed and provenance-bearing; it is not merged into the source.

## Build and verification

```bash
npm run build
npm run verify:package
```

The build emits ESM JavaScript, source maps, declarations and declaration maps into `dist`. A narrow `src/public.ts` entrypoint controls the package's runtime surface. Package verification imports the emitted JavaScript through Node, type-checks a consumer importing by package name, and confirms that only `analyse`, `suggest`, `compare`, `explain`, and `OllamaSemanticEngine` are runtime exports.

The repository remains private and the package is not published. The compiled boundary is an internal integration artifact for adapter and application development.
