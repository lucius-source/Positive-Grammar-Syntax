import { describe, expect, it } from 'vitest';
import { analyse, analyseRules, compare, explain, suggest, type SemanticEngine } from '../src/index';

const localEngine: SemanticEngine = {
  id: 'local:api-test',
  providerKind: 'local',
  capabilities: {
    propositionExtraction: true,
    relationResolution: true,
    ambiguityResolution: true,
    fidelityVerification: false,
    rendering: false,
    structuredOutput: true,
  },
  async determine(request) {
    return {
      propositions: request.deterministicDocument.propositions,
      relations: request.deterministicRelations,
      determinations: request.deterministicDocument.propositions.flatMap(proposition =>
        (proposition.unresolved ?? []).map(field => ({ field, propositionId: proposition.id, status: 'unresolved' as const, basis: 'API test preserves unresolved fields.' }))),
      unresolved: request.deterministicDocument.propositions.flatMap(proposition => proposition.unresolved ?? []),
    };
  },
};

describe('public PGS engine API', () => {
  it('analyses complete deterministic PIR without calling a model', () => {
    const result = analyse("If payment isn't received by Friday, delivery won't proceed.");
    expect(result.operation).toBe('analyse');
    expect(result.source).toBe("If payment isn't received by Friday, delivery won't proceed.");
    expect(result.deterministic.document.propositions).toHaveLength(2);
    expect(result.deterministic.relations[0]?.type).toBe('condition');
    expect(result.validation.valid).toBe(true);
  });

  it('exposes bounded contrast and causal alignment through the public API', () => {
    const contrast = analyse('I reviewed the figures, but Maria found a discrepancy.');
    expect(contrast.deterministic.document.propositions).toHaveLength(2);
    expect(contrast.deterministic.relations).toEqual([
      expect.objectContaining({ from: 'P1', to: 'P2', type: 'contrast', confidence: 'deterministic' }),
    ]);

    const cause = analyse('I sent the report because Maria requested it.');
    expect(cause.deterministic.document.propositions).toHaveLength(2);
    expect(cause.deterministic.relations).toEqual([
      expect.objectContaining({ from: 'P2', to: 'P1', type: 'cause', confidence: 'candidate' }),
    ]);
  });

  it('retains the legacy rule-only operation under an explicit name', () => {
    expect(analyseRules('Respond soon.').findings.map(finding => finding.ruleId)).toContain('PGS-004');
  });

  it('suggests without an engine when deterministic analysis is sufficient', async () => {
    const result = await suggest('I sent the document yesterday.');
    expect(result.semantic).toBeUndefined();
    expect(result.recommendations[0]?.text).toBe('I sent the document yesterday.');
  });

  it('requires an explicit local engine for semantic review', async () => {
    await expect(suggest('They deliberately ignored my email.')).rejects.toThrow(/local semantic engine is required/i);
    const result = await suggest('They deliberately ignored my email.', { engine: localEngine });
    expect(result.semantic).toBeDefined();
    expect(result.unresolved).toEqual(expect.arrayContaining(['P1: reference', 'P1: motive']));
  });

  it('rejects cloud engines at the public boundary', async () => {
    const cloudEngine = { ...localEngine, id: 'cloud:api-test', providerKind: 'cloud' as const };
    await expect(suggest('I sent the document yesterday.', { engine: cloudEngine })).rejects.toThrow(/cloud fallback is disabled/i);
  });

  it('compares candidates using deterministic fidelity invariants', () => {
    const result = compare('Send the report.', 'Send the report by 2026-10-01.');
    expect(result.status).toBe('blocked');
    expect(result.issues.map(issue => issue.code)).toContain('FIDELITY_TIME_INVENTED');
  });

  it('explains unresolved and protected content without inventing resolution', () => {
    const ambiguity = explain('They deliberately ignored my email.');
    expect(ambiguity.unresolved).toEqual(expect.arrayContaining(['P1: reference', 'P1: motive']));
    expect(ambiguity.semanticReviewRequired).toBe(true);

    const protectedResult = explain('Do not energise the circuit.');
    expect(protectedResult.protectedContent).toContain('P1: operative_negation');
    expect(protectedResult.messages.join(' ')).toMatch(/must be preserved/i);
  });

  it('rejects empty source and candidate inputs', async () => {
    expect(() => analyse('   ')).toThrow(/source text is required/i);
    expect(() => compare('Source.', '   ')).toThrow(/candidate text is required/i);
    await expect(suggest('')).rejects.toThrow(/source text is required/i);
  });
});
