import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifactDirectory = resolve(projectRoot, 'artifacts', 'ci');
const artifactPath = resolve(artifactDirectory, 'fidelity-evaluation.json');
const evaluation = spawnSync(process.execPath, ['--import', 'tsx', 'src/fidelity-eval-cli.ts', '--json'], {
  cwd: projectRoot,
  encoding: 'utf8',
});

if (evaluation.status !== 0) {
  if (evaluation.stderr) process.stderr.write(evaluation.stderr);
  throw new Error(`Adversarial fidelity evaluation failed with exit code ${evaluation.status ?? 'unknown'}.`);
}

const output = JSON.parse(evaluation.stdout);
if (output.schemaVersion !== 'pgs.output.v1' || output.kind !== 'fidelity-evaluation') {
  throw new Error('Adversarial fidelity evaluation returned an unexpected artifact envelope.');
}
if (output.summary?.failed !== 0 || output.summary?.passed !== output.summary?.total) {
  throw new Error('Adversarial fidelity artifact contains failed cases.');
}

mkdirSync(artifactDirectory, { recursive: true });
writeFileSync(artifactPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Wrote ${output.summary.total}-case fidelity artifact to ${artifactPath}`);
