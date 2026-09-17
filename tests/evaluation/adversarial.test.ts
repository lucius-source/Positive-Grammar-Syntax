import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateFidelityMutationCorpus, formatFidelityMutationSummary, type FidelityMutationCase } from '../../src/evaluation/adversarial';

const corpusUrl = new URL('../../corpus/evaluation/adversarial-fidelity.json', import.meta.url);
const corpus = JSON.parse(readFileSync(corpusUrl, 'utf8')) as { cases: FidelityMutationCase[] };

describe('adversarial fidelity evaluation', () => {
  it('passes every declared mutation invariant', () => {
    const summary = evaluateFidelityMutationCorpus(corpus.cases);
    expect(summary.total).toBe(19);
    expect(summary.failed, formatFidelityMutationSummary(summary)).toBe(0);
  });

  it('formats failed assertions for evaluation artifacts', () => {
    const summary = evaluateFidelityMutationCorpus([{
      id: 'TEST-ADV', category: 'test', source: 'Send it.', candidate: 'Send it.', expectedStatus: 'blocked', expectedCodes: ['MISSING'],
    }]);
    expect(formatFidelityMutationSummary(summary)).toContain('FAIL TEST-ADV');
    expect(formatFidelityMutationSummary(summary)).toContain('MISSING is reported.');
  });
});
