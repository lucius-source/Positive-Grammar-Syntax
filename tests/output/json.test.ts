import { describe, expect, it } from 'vitest';
import { analysisOutput, evaluationOutput, fidelityEvaluationOutput, formatJsonOutput, PGS_JSON_SCHEMA_VERSION } from '../../src/output/json';

describe('versioned JSON output', () => {
  const engine = { id: 'ollama:test', providerKind: 'local' as const };

  it('wraps analysis results in a stable versioned envelope', () => {
    const result = { source: 'Test.', deterministic: { document: { source: 'Test.', propositions: [] }, relations: [], requiresSemanticReview: false }, ruleFindings: [], validation: { valid: true, issues: [] }, unresolved: [], resolutionLedger: [], recommendations: [], fidelity: [] };
    const parsed = JSON.parse(formatJsonOutput(analysisOutput(result, engine)));
    expect(parsed).toMatchObject({ schemaVersion: PGS_JSON_SCHEMA_VERSION, kind: 'analysis', engine, result: { source: 'Test.' } });
  });

  it('wraps evaluation summaries without timestamps or non-repeatable metadata', () => {
    const summary = { passed: 0, failed: 0, total: 0, results: [] };
    const output = evaluationOutput(summary, engine);
    expect(output).toEqual({ schemaVersion: PGS_JSON_SCHEMA_VERSION, kind: 'evaluation', engine, summary });
    expect(formatJsonOutput(output)).not.toContain('generatedAt');
  });

  it('wraps adversarial fidelity summaries in the same schema version', () => {
    const summary = { passed: 0, failed: 0, total: 0, results: [] };
    expect(fidelityEvaluationOutput(summary)).toEqual({ schemaVersion: PGS_JSON_SCHEMA_VERSION, kind: 'fidelity-evaluation', summary });
  });
});
