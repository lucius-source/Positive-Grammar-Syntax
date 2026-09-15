import { describe, expect, it } from 'vitest';
import { validatePgsDocument } from '../../src/core/validator';
import type { PgsDocument } from '../../src/core/types';

const base: PgsDocument = {
  source: 'I do not consent to this.',
  propositions: [{
    id: 'P1',
    sourceSpan: 'I do not consent to this',
    actor: 'speaker',
    actionOrRelation: 'consent',
    objectOrTarget: 'this',
    polarity: 'negative',
    negation: { present: true, necessary: true, reason: 'Operative refusal of consent.' },
    epistemicStatus: 'known',
    speechAct: 'refusal',
    modality: 'permission',
    protectedContent: ['explicit_non_consent'],
    fidelityStatus: 'protected',
  }],
};

describe('PGS-PIR validation', () => {
  it('accepts a protected refusal proposition', () => {
    expect(validatePgsDocument(base).valid).toBe(true);
  });

  it('rejects missing source text', () => {
    expect(validatePgsDocument({ ...base, source: '' }).valid).toBe(false);
  });

  it('rejects duplicate proposition ids', () => {
    const doc = { ...base, propositions: [base.propositions[0], { ...base.propositions[0] }] };
    const result = validatePgsDocument(doc);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.code === 'PIR_DUPLICATE_ID')).toBe(true);
  });

  it('rejects confidence outside 0..1', () => {
    const doc: PgsDocument = { ...base, propositions: [{ ...base.propositions[0], confidence: 1.2 }] };
    expect(validatePgsDocument(doc).issues.some(i => i.code === 'PIR_CONFIDENCE_RANGE')).toBe(true);
  });

  it('warns when necessary negation has no preservation reason', () => {
    const doc: PgsDocument = { ...base, propositions: [{ ...base.propositions[0], negation: { present: true, necessary: true } }] };
    expect(validatePgsDocument(doc).issues.some(i => i.code === 'PIR_NEGATION_REASON')).toBe(true);
  });
});
