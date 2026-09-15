#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { OllamaSemanticEngine } from './semantic/adapters/ollama';
import { evaluateLocalCorpus, formatEvaluationSummary, type LocalEvaluationCase } from './evaluation/local';

interface CorpusFile { cases?: LocalEvaluationCase[] }
const corpusUrl = new URL('../corpus/evaluation/local-gate.json', import.meta.url);
const corpus = JSON.parse(await readFile(corpusUrl, 'utf8')) as CorpusFile;
if (!Array.isArray(corpus.cases) || corpus.cases.length === 0) throw new Error('Local evaluation corpus contains no cases.');
const requestedIds = new Set(process.argv.slice(2));
const cases = requestedIds.size ? corpus.cases.filter(testCase => requestedIds.has(testCase.id)) : corpus.cases;
if (cases.length === 0) throw new Error(`No matching evaluation cases: ${[...requestedIds].join(', ')}`);

const summary = await evaluateLocalCorpus(cases, new OllamaSemanticEngine(), (testCase, index) => {
  console.error(`Running ${index + 1}/${cases.length}: ${testCase.id} ${testCase.category}`);
});
console.log(formatEvaluationSummary(summary));
if (summary.failed > 0) process.exitCode = 1;
