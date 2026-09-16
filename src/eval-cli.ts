#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { OllamaSemanticEngine } from './semantic/adapters/ollama';
import { evaluateLocalCorpus, formatEvaluationSummary, type LocalEvaluationCase } from './evaluation/local';
import { evaluationOutput, formatJsonOutput } from './output/json';

interface CorpusFile { cases?: LocalEvaluationCase[] }
const corpusUrl = new URL('../corpus/evaluation/local-gate.json', import.meta.url);
const corpus = JSON.parse(await readFile(corpusUrl, 'utf8')) as CorpusFile;
if (!Array.isArray(corpus.cases) || corpus.cases.length === 0) throw new Error('Local evaluation corpus contains no cases.');
const json = process.argv.includes('--json');
const requestedIds = new Set(process.argv.slice(2).filter(arg => arg !== '--json'));
const cases = requestedIds.size ? corpus.cases.filter(testCase => requestedIds.has(testCase.id)) : corpus.cases;
if (cases.length === 0) throw new Error(`No matching evaluation cases: ${[...requestedIds].join(', ')}`);

const engine = new OllamaSemanticEngine();
const summary = await evaluateLocalCorpus(cases, engine, (testCase, index) => {
  console.error(`Running ${index + 1}/${cases.length}: ${testCase.id} ${testCase.category}`);
});
console.log(json ? formatJsonOutput(evaluationOutput(summary, { id: engine.id, providerKind: engine.providerKind })) : formatEvaluationSummary(summary));
if (summary.failed > 0) process.exitCode = 1;
