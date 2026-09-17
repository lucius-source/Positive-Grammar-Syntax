import { readFileSync } from 'node:fs';

function readJson(url) {
  return JSON.parse(readFileSync(url, 'utf8'));
}

const contract = readJson(new URL('../config/release-contract.json', import.meta.url));
const packageManifest = readJson(new URL('../package.json', import.meta.url));
const packageLock = readJson(new URL('../package-lock.json', import.meta.url));
const adversarial = readJson(new URL('../artifacts/ci/fidelity-evaluation.json', import.meta.url));
const fuzz = readJson(new URL('../artifacts/ci/fidelity-fuzz-evaluation.json', import.meta.url));

if (packageManifest.version !== contract.packageVersion || packageLock.version !== contract.packageVersion || packageLock.packages?.['']?.version !== contract.packageVersion) {
  throw new Error(`Package version does not match release contract ${contract.packageVersion}.`);
}
if (contract.visibility !== 'private' || packageManifest.private !== true) {
  throw new Error('Release contract requires the package to remain private.');
}
if (contract.liveGate?.providerKind !== 'local' || contract.liveGate?.cloudFallback !== false) {
  throw new Error('Release contract must retain a local-only live semantic gate with cloud fallback disabled.');
}

for (const [artifact, kind, minimum] of [
  [adversarial, 'fidelity-evaluation', contract.evaluationMinimums.adversarialCases],
  [fuzz, 'fidelity-fuzz-evaluation', contract.evaluationMinimums.seededFuzzCases],
]) {
  if (artifact.schemaVersion !== contract.jsonSchemaVersion || artifact.kind !== kind) {
    throw new Error(`Unexpected ${kind} release artifact envelope.`);
  }
  if (artifact.summary?.failed !== 0 || artifact.summary?.passed !== artifact.summary?.total || artifact.summary?.total < minimum) {
    throw new Error(`${kind} does not satisfy its release minimum of ${minimum} passing cases.`);
  }
}
if (fuzz.summary.families < contract.evaluationMinimums.seededFuzzFamilies) {
  throw new Error(`Seeded fuzz artifact does not satisfy its ${contract.evaluationMinimums.seededFuzzFamilies}-family release minimum.`);
}

console.log(`Verified deterministic release candidate ${contract.packageVersion}.`);
console.log(`Manual live gate remains required: ${contract.evaluationMinimums.canonicalLiveCases} cases on local ${contract.liveGate.defaultModel}.`);
