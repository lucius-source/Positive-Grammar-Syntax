import { describe, expect, it } from 'vitest';
import { evaluateLocalCase, formatEvaluationSummary, type LocalEvaluationCase } from '../../src/evaluation/local';
import { MockSemanticEngine } from '../../src/semantic/adapters/mock';

describe('local evaluation gate', () => {
  it('passes invariant checks for an unresolved motive and actor', async () => {
    const testCase: LocalEvaluationCase = {
      id: 'TEST-001', category: 'ambiguity', source: 'They deliberately ignored my email.',
      expectedUnresolved: ['reference', 'motive'], requireL2Withheld: true,
    };
    const result = await evaluateLocalCase(testCase, Object.assign(new MockSemanticEngine(), { providerKind: 'local' as const }));
    expect(result.pass).toBe(true);
  });

  it('fails when expected deterministic behaviour is absent', async () => {
    const testCase: LocalEvaluationCase = { id: 'TEST-002', category: 'time', source: 'Respond soon.', expectedRules: ['PGS-001'] };
    const result = await evaluateLocalCase(testCase, Object.assign(new MockSemanticEngine(), { providerKind: 'local' as const }));
    expect(result.pass).toBe(false);
    expect(formatEvaluationSummary({ passed: 0, failed: 1, total: 1, results: [result] })).toContain('FAIL TEST-002');
  });

  it('evaluates context-supported L2 content', async () => {
    const testCase: LocalEvaluationCase = {
      id: 'TEST-003', category: 'context', source: 'They deliberately ignored my email.',
      context: { knownFacts: ['I sent the email'], userIntent: 'Please confirm receipt' },
      expectedL2Fragments: ['Please confirm receipt'],
    };
    const result = await evaluateLocalCase(testCase, Object.assign(new MockSemanticEngine(), { providerKind: 'local' as const }));
    expect(result.pass).toBe(true);
  });
});
