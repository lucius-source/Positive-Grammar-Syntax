#!/usr/bin/env node
import { evaluateFidelityFuzz, formatFidelityFuzzSummary, type FidelityFuzzOptions } from './evaluation/fuzz';
import { fidelityFuzzOutput, formatJsonOutput } from './output/json';

function parseIntegerFlag(arguments_: string[], name: string): number | undefined {
  const index = arguments_.indexOf(name);
  if (index === -1) return undefined;
  const raw = arguments_[index + 1];
  if (raw === undefined || !/^\d+$/.test(raw)) throw new Error(`${name} requires a non-negative integer.`);
  return Number(raw);
}

const arguments_ = process.argv.slice(2);
const allowed = new Set(['--json', '--seed', '--iterations']);
for (let index = 0; index < arguments_.length; index += 1) {
  const argument = arguments_[index];
  if (!allowed.has(argument ?? '')) throw new Error(`Unknown argument: ${argument}`);
  if (argument === '--seed' || argument === '--iterations') index += 1;
}

const options: FidelityFuzzOptions = {};
const seed = parseIntegerFlag(arguments_, '--seed');
const iterationsPerFamily = parseIntegerFlag(arguments_, '--iterations');
if (seed !== undefined) options.seed = seed;
if (iterationsPerFamily !== undefined) options.iterationsPerFamily = iterationsPerFamily;

const summary = evaluateFidelityFuzz(options);
console.log(arguments_.includes('--json') ? formatJsonOutput(fidelityFuzzOutput(summary)) : formatFidelityFuzzSummary(summary));
if (summary.failed > 0) process.exitCode = 1;
