# Private Package Release and Versioning Contract

The PGS engine package remains private and unpublished. A “release” currently means a traceable internal integration checkpoint: the compiled package, its public TypeScript boundary, deterministic evaluation artifacts and a recorded local-model gate all agree on one versioned contract.

The machine-readable baseline is `config/release-contract.json`. Changing it is an explicit compatibility decision, not an incidental build step.

## Version policy before 1.0

PGS uses Semantic Versioning with a deliberately stricter pre-1.0 policy:

- Patch (`0.1.x`) covers compatible fixes, additional tests, documentation and internal implementation changes that preserve public runtime exports, public types, output schema and established safety behavior.
- Minor (`0.x.0`) covers a new public operation or type, an intentional public signature change, a changed fidelity or approval contract, or removal/renaming of a public export. Breaking changes require migration notes even though the major version remains zero.
- Major (`1.0.0`) is reserved for a supported external package contract. It requires an explicit publication, support and migration policy; the current repository does not meet that criterion.

The package version and JSON envelope version are independent. A compatible engine change updates the package version only. A breaking machine-readable envelope change introduces a new `pgs.output.vN` schema; it must not silently reinterpret the existing schema identifier.

## Deterministic candidate gate

Run:

```bash
npm run release:check
```

This command verifies:

1. typechecking, all automated tests, build output and the package consumer boundary;
2. the exact runtime export list recorded in the release contract;
3. package and lockfile version agreement;
4. private-package status and the local-only/no-cloud semantic policy;
5. passing adversarial and seeded-fuzz artifacts at or above their recorded minimum case counts; and
6. the expected `pgs.output.v1` artifact envelopes.

A passing deterministic command creates a release candidate, not a completed release.

## Required live gate

Before tagging an internal checkpoint, run all canonical cases against the exact local model recorded in the contract:

```bash
npm run eval:local:preflight
npm run eval:local
```

The record must include the commit, package version, model identifier, canonical case totals and resulting versioned JSON artifact. No cloud credential or fallback is permitted. A model change is a new evaluation baseline even when the package version is unchanged.

## Compatibility review

Every candidate must classify changes to:

- runtime exports and public TypeScript declarations;
- operation inputs, results and error behavior;
- `pgs.output.v1` envelopes;
- fidelity blocking, review and approval behavior;
- deterministic corpus and seeded-fuzz minimums; and
- local semantic-provider requirements.

Any weakening of fidelity, provenance, explicit approval, protected-content handling or the local-only boundary blocks release regardless of version number or test totals.

## Tagging and publication

No automated publish step is authorized while `private: true` remains in `package.json`. After both gates pass, an internal tag may use `v<package-version>` and should point to the exact evaluated commit. Publishing to a registry, changing package visibility or declaring 1.0 requires a separate explicit decision.
