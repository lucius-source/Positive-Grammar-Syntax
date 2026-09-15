import { describe, expect, it } from 'vitest';
import type { SemanticEngine } from '../src/semantic/types';
import { formatPgsReport, runPgsPipeline } from '../src/pipeline';

const localEngine: SemanticEngine = {
  id: 'local:test', providerKind: 'local',
  capabilities: { propositionExtraction: true, relationResolution: true, ambiguityResolution: true, fidelityVerification: false, rendering: false, structuredOutput: true },
  async determine(request) {
    return {
      propositions: request.deterministicDocument.propositions,
      relations: request.deterministicRelations,
      determinations: [
        { field: 'reference', propositionId: 'P1', status: 'unresolved', basis: 'No antecedent is supplied.' },
        { field: 'motive', propositionId: 'P1', status: 'unresolved', basis: 'Intent is asserted without supporting evidence.' },
      ], unresolved: ['Identity of “they”', 'Evidence supporting deliberate intent'],
    };
  },
};

describe('PGS executable pipeline', () => {
  it('keeps unresolved identity and motive out of factual recommendations', async () => {
    const result = await runPgsPipeline('They deliberately ignored my email.', localEngine);
    expect(result.recommendations[0]?.text).toBe('I believe they deliberately ignored my email.');
    expect(result.recommendations[1]?.text).toBeUndefined();
    expect(result.fidelity.map(f => f.message).join(' ')).toMatch(/not invented/);
  });

  it('prints every required report section', async () => {
    const report = formatPgsReport(await runPgsPipeline('They deliberately ignored my email.', localEngine));
    for (const heading of ['SOURCE', 'DETERMINISTIC ANALYSIS', 'SEMANTIC DETERMINATION', 'UNRESOLVED', 'PGS-L1', 'PGS-L2', 'FIDELITY']) expect(report).toContain(heading);
  });

  it('rejects non-local semantic engines without falling back', async () => {
    let called = false;
    const cloudEngine = { ...localEngine, id: 'cloud:test', providerKind: 'cloud' as const, async determine(request: Parameters<SemanticEngine['determine']>[0]) { called = true; return localEngine.determine(request); } };
    const result = await runPgsPipeline('They deliberately ignored my email.', cloudEngine);
    expect(called).toBe(false);
    expect(result.semantic).toBeUndefined();
    expect(result.semanticError).toMatch(/cloud fallback is disabled/);
  });

  it('grounds richer recommendations in explicit facts and intent', async () => {
    const result = await runPgsPipeline('They deliberately ignored my email.', localEngine, {
      context: {
        knownFacts: ['I sent the email', 'I have not received a response'],
        userIntent: 'Please confirm receipt and review',
      },
    });
    expect(result.recommendations[0]?.text).toBe('I sent the email. I have not received a response. I believe they deliberately ignored my email.');
    expect(result.recommendations[1]?.text).toContain('Please confirm receipt and review.');
    expect(result.fidelity.map(item => item.message).join(' ')).toMatch(/user-supplied intent/);
    expect(formatPgsReport(result)).toContain('VERIFIED CONTEXT');
  });
});
