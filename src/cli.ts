#!/usr/bin/env node
import { OllamaSemanticEngine } from './semantic/adapters/ollama';
import { formatPgsReport, runPgsPipeline } from './pipeline';
import type { EvidenceItem, EvidenceKind } from './semantic/types';
import { analysisOutput, formatJsonOutput } from './output/json';

const args = process.argv.slice(2);
const knownFacts: string[] = [];
let userIntent: string | undefined;
const referenceBindings: Array<{ reference: string; entity: string }> = [];
const evidence: EvidenceItem[] = [];
const evidenceKinds = new Set<EvidenceKind>(['direct_observation', 'documented', 'attributed_admission', 'inference', 'belief', 'unclassified']);
const sourceParts: string[] = [];
let json = false;
for (let index = 0; index < args.length; index++) {
  const arg = args[index];
  if (arg === '--json') json = true;
  else if (arg === '--fact' || arg === '--intent' || arg === '--bind' || arg === '--evidence') {
    const value = args[++index]?.trim();
    if (!value) throw new Error(`${arg} requires a value.`);
    if (arg === '--fact') knownFacts.push(value);
    else if (arg === '--intent') userIntent = value;
    else {
      const separator = value.indexOf('=');
      if (separator < 1 || !value.slice(separator + 1).trim()) throw new Error(`${arg} requires field=value.`);
      const key = value.slice(0, separator).trim();
      const supplied = value.slice(separator + 1).trim();
      if (arg === '--bind') referenceBindings.push({ reference: key, entity: supplied });
      else {
        const [field, requestedKind] = key.split(':');
        if (!field) throw new Error('--evidence requires field:kind=statement.');
        const kind = (requestedKind ?? 'unclassified') as EvidenceKind;
        if (!evidenceKinds.has(kind)) throw new Error(`Unknown evidence kind: ${kind}.`);
        evidence.push({ field, kind, statement: supplied });
      }
    }
  } else if (arg !== undefined) sourceParts.push(arg);
}
const source = sourceParts.join(' ').trim();
if (!source) {
  console.error('Usage: npm run pgs -- "Your text" [--json] [--fact "Verified fact"] [--intent "Requested action"] [--bind "reference=entity"] [--evidence "field:kind=statement"]');
  process.exitCode = 1;
} else {
  const engine = new OllamaSemanticEngine();
  const context = knownFacts.length || userIntent || referenceBindings.length || evidence.length
    ? { knownFacts, ...(userIntent ? { userIntent } : {}), ...(referenceBindings.length ? { referenceBindings } : {}), ...(evidence.length ? { evidence } : {}) }
    : undefined;
  const result = await runPgsPipeline(source, engine, context ? { context } : {});
  console.log(json ? formatJsonOutput(analysisOutput(result, { id: engine.id, providerKind: engine.providerKind })) : formatPgsReport(result));
  if (!result.validation.valid || result.fidelity.some(finding => finding.status === 'blocked')) process.exitCode = 2;
}
