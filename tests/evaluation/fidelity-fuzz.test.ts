import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FIDELITY_FUZZ_ITERATIONS,
  evaluateFidelityFuzz,
  formatFidelityFuzzSummary,
  generateFidelityFuzzCases,
} from '../../src/evaluation/fuzz';

describe('seeded fidelity fuzz evaluation', () => {
  it('blocks every generated invariant violation in the default corpus', () => {
    const summary = evaluateFidelityFuzz();
    expect(summary.iterationsPerFamily).toBe(DEFAULT_FIDELITY_FUZZ_ITERATIONS);
    expect(summary.families).toBe(14);
    expect(summary.total).toBe(350);
    expect(summary.failed).toBe(0);
    expect(summary.passed).toBe(summary.total);
  });

  it('reproduces exactly the same cases for the same seed', () => {
    expect(generateFidelityFuzzCases({ seed: 42, iterationsPerFamily: 3 }))
      .toEqual(generateFidelityFuzzCases({ seed: 42, iterationsPerFamily: 3 }));
  });

  it('varies generated inputs when the seed changes', () => {
    const first = generateFidelityFuzzCases({ seed: 42, iterationsPerFamily: 3 });
    const second = generateFidelityFuzzCases({ seed: 43, iterationsPerFamily: 3 });
    expect(first.map(item => [item.source, item.candidate])).not.toEqual(second.map(item => [item.source, item.candidate]));
  });

  it.each([
    [{ seed: -1 }, 'seed'],
    [{ seed: 0x1_0000_0000 }, 'seed'],
    [{ iterationsPerFamily: 0 }, 'iterations'],
    [{ iterationsPerFamily: 10_001 }, 'iterations'],
  ])('rejects unsafe fuzz options: %j', (options, expected) => {
    expect(() => generateFidelityFuzzCases(options)).toThrow(expected);
  });

  it('reports the reproduction seed and exact failing inputs in human output', () => {
    const summary = evaluateFidelityFuzz({ seed: 7, iterationsPerFamily: 1 });
    const forcedFailure = { ...summary.results[0]!, pass: false };
    const output = formatFidelityFuzzSummary({ ...summary, passed: summary.passed - 1, failed: 1, results: [forcedFailure, ...summary.results.slice(1)] });
    expect(output).toContain('Seed: 7');
    expect(output).toContain(`Source: ${forcedFailure.source}`);
    expect(output).toContain(`Candidate: ${forcedFailure.candidate}`);
  });
});
