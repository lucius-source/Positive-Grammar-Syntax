#!/usr/bin/env node
import { OllamaSemanticEngine } from './semantic/adapters/ollama';
import { formatPgsReport, runPgsPipeline } from './pipeline';

const args = process.argv.slice(2);
const knownFacts: string[] = [];
let userIntent: string | undefined;
const sourceParts: string[] = [];
for (let index = 0; index < args.length; index++) {
  const arg = args[index];
  if (arg === '--fact' || arg === '--intent') {
    const value = args[++index]?.trim();
    if (!value) throw new Error(`${arg} requires a value.`);
    if (arg === '--fact') knownFacts.push(value);
    else userIntent = value;
  } else if (arg !== undefined) sourceParts.push(arg);
}
const source = sourceParts.join(' ').trim();
if (!source) {
  console.error('Usage: npm run pgs -- "Your text" [--fact "Verified fact"] [--intent "Requested action"]');
  process.exitCode = 1;
} else {
  const engine = new OllamaSemanticEngine();
  const context = knownFacts.length || userIntent ? { knownFacts, ...(userIntent ? { userIntent } : {}) } : undefined;
  const result = await runPgsPipeline(source, engine, context ? { context } : {});
  console.log(formatPgsReport(result));
  if (!result.validation.valid || result.fidelity.some(finding => finding.status === 'blocked')) process.exitCode = 2;
}
