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

  it('detects contracted protected refusal negation', () => {
    expect(ids("I don't consent to this.")).toContain('PGS-007');
  });

  /**
   * The owner's primary case for PGS, which raised nothing until 2026-10-31:
   * stating what was absent from an order on a factual basis. Neither
   * `negativeInstruction` (an instruction or prohibition) nor
   * `PAT-007-PROTECTED` (a negation in a protected domain) matched it, so the
   * rule that says "otherwise consider an affirmative desired state" never
   * ran for it. `docs/20` §1a has the measurement.
   */
  it('detects a negative assertion that is neither instruction nor protected', () => {
    const finding = detectDeterministicRules('I did not receive the invoice with my order.').find(item => item.ruleId === 'PGS-007');
    expect(finding?.patternId).toBe('PAT-007-ASSERTION');
    expect(finding?.severity).toBe('info');
    expect(finding?.message).toMatch(/Preserve the negation when legally/i);
  });

  /**
   * The property that makes the branch above safe, asserted rather than
   * assumed: it is the last arm of an if/else chain, so a sentence that
   * already matched an earlier arm cannot reach it. If a refactor ever flattens
   * the chain, these three are what notice — a protected negation reported as
   * an ordinary assertion is a protection silently stopping applying, which is
   * the failure mode `142e835` argues is the worst of its kind.
   */
  it('leaves the instruction and protected paths where they were', () => {
    const pattern = (text: string) => detectDeterministicRules(text).find(item => item.ruleId === 'PGS-007')?.patternId;
    expect(pattern('Do not park here.')).toBe('PAT-007');
    expect(pattern('You should not have charged me £420.')).toBe('PAT-007');
    expect(pattern('I do not consent to this.')).toBe('PAT-007-PROTECTED');
  });

  /** An already-affirmative sentence has nothing to consider, and says nothing. */
  it('raises no negation finding for an affirmative sentence', () => {
    expect(ids('The building stays smoke free.')).not.toContain('PGS-007');
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

  it('calibrates experiential, spiritual and claimed legal effects', () => {
    expect(ids('I feel blocked energy around this decision.')).toContain('PGS-005');
    expect(ids("This word lowers everyone's vibration.")).toEqual(expect.arrayContaining(['PGS-002', 'PGS-005']));
    expect(ids("This grammar removes the court's jurisdiction.")).toContain('PGS-005');
  });

  it('protects ambiguous double negation and requirements', () => {
    expect(ids("I don't disagree.")).toEqual(expect.arrayContaining(['PGS-005', 'PGS-007']));
    expect(ids("You shouldn't forget to submit the form.")).toEqual(expect.arrayContaining(['PGS-003', 'PGS-004', 'PGS-007']));
  });

  it('requires evidence classification for asserted knowledge', () => {
    expect(ids('I know he stole it.')).toEqual(expect.arrayContaining(['PGS-002', 'PGS-005']));
  });
});
