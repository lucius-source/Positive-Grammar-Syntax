import { describe, expect, it } from 'vitest';
import { analyseDocument } from '../../src/analyser/document';
import { buildResolutionLedger, unresolvedFromLedger } from '../../src/resolution/ledger';

describe('evidence-grounded resolution ledger', () => {
  const analysis = analyseDocument('They deliberately ignored my email.');

  it('resolves a reference only from an explicit user binding', () => {
    const ledger = buildResolutionLedger(analysis, undefined, { referenceBindings: [{ reference: 'they', entity: 'Acme support team' }] });
    expect(ledger.find(item => item.field === 'reference')).toMatchObject({ status: 'resolved', value: 'Acme support team', provenance: 'user_context' });
    expect(unresolvedFromLedger(ledger)).toEqual(['P1: motive']);
  });

  it('resolves motive only from field-specific evidence', () => {
    const ledger = buildResolutionLedger(analysis, undefined, { evidence: [{ field: 'motive', statement: 'The recipient confirmed choosing not to reply.' }] });
    expect(ledger.find(item => item.field === 'motive')).toMatchObject({ status: 'resolved', provenance: 'user_context' });
    expect(unresolvedFromLedger(ledger)).toEqual(['P1: reference']);
  });

  it('does not allow a model determination to resolve deterministic ambiguity', () => {
    const semantic = {
      propositions: analysis.document.propositions, relations: analysis.relations, unresolved: [],
      determinations: [{ field: 'reference', propositionId: 'P1', status: 'determined' as const, value: 'Acme', basis: 'Model inference.' }],
    };
    const ledger = buildResolutionLedger(analysis, semantic);
    expect(ledger.find(item => item.field === 'reference')?.status).toBe('unresolved');
  });
});
