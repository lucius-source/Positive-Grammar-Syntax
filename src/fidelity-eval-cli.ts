#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { evaluateFidelityMutationCorpus, formatFidelityMutationSummary, type FidelityMutationCase } from './evaluation/adversarial';
import { fidelityEvaluationOutput, formatJsonOutput } from './output/json';

interface CorpusFile { cases?: FidelityMutationCase[] }
const corpusUrl = new URL('../corpus/evaluation/adversarial-fidelity.json', import.meta.url);
const corpus = JSON.parse(await readFile(corpusUrl, 'utf8')) as CorpusFile;
if (!Array.isArray(corpus.cases) || corpus.cases.length === 0) throw new Error('Adversarial fidelity corpus contains no cases.');
const json = process.argv.includes('--json');
const requestedIds = new Set(process.argv.slice(2).filter(argument => argument !== '--json'));
const cases = requestedIds.size ? corpus.cases.filter(testCase => requestedIds.has(testCase.id)) : corpus.cases;
if (cases.length === 0) throw new Error(`No matching adversarial cases: ${[...requestedIds].join(', ')}`);

const summary = evaluateFidelityMutationCorpus(cases);
console.log(json ? formatJsonOutput(fidelityEvaluationOutput(summary)) : formatFidelityMutationSummary(summary));
if (summary.failed > 0) process.exitCode = 1;
