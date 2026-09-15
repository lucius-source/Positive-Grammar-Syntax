#!/usr/bin/env node
import { OllamaSemanticEngine } from './semantic/adapters/ollama';
import { formatPgsReport, runPgsPipeline } from './pipeline';

const source = process.argv.slice(2).join(' ').trim();
if (!source) {
  console.error('Usage: npm run pgs -- "Your text"');
  process.exitCode = 1;
} else {
  const engine = new OllamaSemanticEngine();
  const result = await runPgsPipeline(source, engine);
  console.log(formatPgsReport(result));
  if (!result.validation.valid || result.fidelity.some(finding => finding.status === 'blocked')) process.exitCode = 2;
}
