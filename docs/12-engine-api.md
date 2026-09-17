# PGS Engine API

The source-level engine boundary exports four primary operations from `src/index.ts`:

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
} from './src/index';

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

The repository remains private and source-based. This API is an internal stable boundary for the next packaging milestone, not yet a compiled or published npm package.
