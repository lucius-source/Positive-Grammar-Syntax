import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifactDirectory = resolve(projectRoot, 'artifacts', 'ci');
mkdirSync(artifactDirectory, { recursive: true });

const evaluations = [
  { source: 'src/fidelity-eval-cli.ts', kind: 'fidelity-evaluation', file: 'fidelity-evaluation.json', label: 'adversarial fidelity' },
  { source: 'src/fidelity-fuzz-cli.ts', kind: 'fidelity-fuzz-evaluation', file: 'fidelity-fuzz-evaluation.json', label: 'seeded fidelity fuzz' },
];

for (const specification of evaluations) {
  const evaluation = spawnSync(process.execPath, ['--import', 'tsx', specification.source, '--json'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  if (evaluation.status !== 0) {
    if (evaluation.stderr) process.stderr.write(evaluation.stderr);
    throw new Error(`${specification.label} evaluation failed with exit code ${evaluation.status ?? 'unknown'}.`);
  }
  const output = JSON.parse(evaluation.stdout);
  if (output.schemaVersion !== 'pgs.output.v1' || output.kind !== specification.kind) {
    throw new Error(`${specification.label} evaluation returned an unexpected artifact envelope.`);
  }
  if (output.summary?.failed !== 0 || output.summary?.passed !== output.summary?.total) {
    throw new Error(`${specification.label} artifact contains failed cases.`);
  }
  const artifactPath = resolve(artifactDirectory, specification.file);
  writeFileSync(artifactPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${output.summary.total}-case ${specification.label} artifact to ${artifactPath}`);
}
