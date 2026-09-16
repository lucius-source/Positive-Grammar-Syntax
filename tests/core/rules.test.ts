import { describe, expect, it } from 'vitest';
import { detectDeterministicRules } from '../../src/core/rules';

const ids = (text: string) => detectDeterministicRules(text).map(f => f.ruleId);

describe('deterministic PGS rule detection', () => {
  it('detects vague temporal language', () => {
    expect(ids("I'll get back to you soon.")).toContain('PGS-004');
  });

  it('detects negative instructions without deciding that negation is invalid', () => {
    const findings = detectDeterministicRules('Do not energise the circuit.');
    expect(findings.map(f => f.ruleId)).toContain('PGS-007');
    expect(findings.find(f => f.ruleId === 'PGS-007')?.message).toMatch(/Preserve/i);
  });

  it('detects and protects factual legal negation', () => {
    const finding = detectDeterministicRules('The claimant did not serve the notice.').find(item => item.ruleId === 'PGS-007');
    expect(finding?.patternId).toBe('PAT-007-PROTECTED');
  });

  it('detects absolute generalisation candidates', () => {
    expect(ids('You never listen to me.')).toContain('PGS-002');
  });

  it('detects strong certainty markers', () => {
    expect(ids('Obviously they know what they are doing.')).toContain('PGS-005');
  });

  it('detects a passive-agency candidate', () => {
    expect(ids('Mistakes were made.')).toContain('PGS-001');
  });

  it('does not force findings onto a strong positive-control statement', () => {
    const text = 'I reviewed the figures and found a £500 discrepancy. I want the accounts reconciled by Friday. I will send the transaction list today.';
    expect(detectDeterministicRules(text)).toEqual([]);
  });

  it('calibrates uncertainty, inability and failure predictions', () => {
    expect(ids('Maybe it will work.')).toContain('PGS-005');
    expect(ids("I can't do this yet.")).toEqual(expect.arrayContaining(['PGS-003', 'PGS-005']));
    expect(ids('This is going to fail.')).toContain('PGS-005');
  });

  it('flags labels and vague evaluations without inventing criteria', () => {
    expect(ids("I'm useless at this.")).toEqual(expect.arrayContaining(['PGS-002', 'PGS-005']));
    expect(ids('This report is bad.')).toEqual(expect.arrayContaining(['PGS-002', 'PGS-006']));
    expect(ids('That price is impossible.')).toEqual(expect.arrayContaining(['PGS-002', 'PGS-005', 'PGS-006']));
  });

  it('recognizes a conditional apology without treating impact as admitted', () => {
    expect(ids('Sorry if you were offended.')).toEqual(expect.arrayContaining(['PGS-001', 'PGS-002']));
  });
});
