# CI and Evaluation Artifacts

The repository CI workflow is intentionally deterministic and does not require a semantic model. For every push or pull request to `main`, it:

1. installs the locked dependency graph with `npm ci`;
2. runs typechecking and all automated tests;
3. builds the private ESM package and verifies its public consumer boundary;
4. executes the adversarial fidelity corpus; and
5. uploads the resulting `pgs.output.v1` JSON artifact.

Run the same checks locally with:

```bash
npm run check
npm run artifacts:ci
```

The generated artifact is written to `artifacts/ci/fidelity-evaluation.json`. The `artifacts` directory is ignored by Git because CI records are derived outputs, not source data.

The live canonical gate remains separate:

```bash
npm run eval:local
```

That command requires the configured local Ollama model and is therefore not run on ordinary hosted CI runners. Its absence from CI does not enable a cloud fallback; semantic execution remains local-only.
