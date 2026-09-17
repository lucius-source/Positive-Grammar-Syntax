# CI and Evaluation Artifacts

The repository CI workflow is intentionally deterministic and does not require a semantic model. For every push or pull request to `main`, it:

1. installs the locked dependency graph with `npm ci`;
2. runs typechecking and all automated tests;
3. builds the private ESM package and verifies its public consumer boundary;
4. executes the adversarial fidelity corpus and the reproducible seeded fuzz gate; and
5. uploads both resulting `pgs.output.v1` JSON artifacts.

Run the same checks locally with:

```bash
npm run check
npm run artifacts:ci
```

The generated artifacts are written to `artifacts/ci/fidelity-evaluation.json` and `artifacts/ci/fidelity-fuzz-evaluation.json`. The fuzz artifact records its seed, iteration count and exact generated inputs so any failure can be replayed locally. The `artifacts` directory is ignored by Git because CI records are derived outputs, not source data.

Run the seeded gate directly with:

```bash
npm run eval:fuzz
npm run eval:fuzz -- --seed 5261139 --iterations 25
```

The live canonical gate remains separate:

```bash
npm run eval:local
```

That command requires the configured local Ollama model and is therefore not run on ordinary hosted CI runners. Its absence from CI does not enable a cloud fallback; semantic execution remains local-only.

## Explicit self-hosted live workflow

`.github/workflows/live-evaluation.yml` provides a separate manual workflow. It never runs for a push or pull request and its job is refused unless the dispatch uses `main`. The job requires a self-hosted runner carrying the custom `pgs-ollama` label; ordinary GitHub-hosted runners cannot satisfy it.

Provision that runner with:

- network access to GitHub Actions for checkout, dependency installation and artifact upload;
- Node.js setup support;
- Ollama listening only at `http://127.0.0.1:11434`;
- the exact model selected at dispatch time, initially `qwen3.8:latest`; and
- the `self-hosted` and `pgs-ollama` runner labels.

Before evaluation, the workflow runs the complete deterministic check and `npm run eval:local:preflight`. The preflight calls Ollama's local tags endpoint and fails unless the exact configured model is present. The live command then writes a versioned JSON result to `artifacts/live/local-evaluation.json`, which the workflow retains for 30 days. An optional space-separated case-ID input permits a narrow diagnostic run; leaving it blank executes all 50 canonical cases.

The workflow passes no cloud credential to PGS. `PGS_OLLAMA_URL` is fixed to loopback, and the semantic registry continues to reject non-local providers.
