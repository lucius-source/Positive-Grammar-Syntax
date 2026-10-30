import { describe, expect, it } from 'vitest';
import { compareFidelity } from '../../src/core/fidelity';

/**
 * EXC-009. The counterexamples are the point.
 *
 * This relaxes the single strictest rule in the comparator, so the test that
 * matters is not "does it allow the good case" — it is "does it still refuse
 * everything it refused before". A parity check that certified
 * "I have not received the payment." → "I received the payment." would be
 * worse than the blanket refusal it replaces.
 */

const codes = (source: string, candidate: string) =>
  compareFidelity(source, candidate).issues.map(i => i.code);
const status = (source: string, candidate: string) => compareFidelity(source, candidate).status;

describe('EXC-009 verified double negation', () => {
  describe('certifies an elimination it can check', () => {
    it('lets "did not fail to send" become "sent"', () => {
      const source = 'I did not fail to send it.';
      const candidate = 'I sent it.';
      expect(codes(source, candidate)).not.toContain('FIDELITY_NEGATION_REMOVED');
      expect(codes(source, candidate)).toContain('FIDELITY_NEGATION_EQUIVALENT');
    });

    it('never returns pass — verification is evidence, not a guarantee', () => {
      expect(status('I did not fail to send it.', 'I sent it.')).toBe('review_required');
    });
  });

  describe('still refuses everything that is not an elimination', () => {
    it('BLOCKS a genuine negation removal', () => {
      const source = 'I have not received the payment.';
      const candidate = 'I received the payment.';
      expect(codes(source, candidate)).toContain('FIDELITY_NEGATION_REMOVED');
      expect(status(source, candidate)).toBe('blocked');
    });

    /**
     * The trap that decides the lexicon. Not refusing is not doing: you can
     * fail to attend without refusing, and not refusing does not mean you
     * went. `refuse` is absent from NEGATIVE_VERB precisely for this.
     */
    it('BLOCKS "did not refuse to attend" becoming "attended"', () => {
      const source = 'I did not refuse to attend.';
      const candidate = 'I attended.';
      expect(codes(source, candidate)).toContain('FIDELITY_NEGATION_REMOVED');
      expect(status(source, candidate)).toBe('blocked');
    });

    it('BLOCKS a quantifier scope swap that has matching parity', () => {
      // "not all addressed" and "all not addressed" differ in meaning and
      // agree modulo two, which is exactly what the scope guard exists for.
      const source = 'Not all balances are addressed.';
      const candidate = 'All balances are not addressed.';
      expect(codes(source, candidate)).not.toContain('FIDELITY_NEGATION_EQUIVALENT');
    });

    it('BLOCKS when the two sides share parity but say different things', () => {
      const source = 'I did not fail to send it.';
      const candidate = 'I received the payment.';
      expect(codes(source, candidate)).not.toContain('FIDELITY_NEGATION_EQUIVALENT');
    });

    /**
     * An action PGS cannot see is not a verified one. Both sides here parse to
     * no action at all, and two absent actions must not compare equal — that
     * would certify any pair with matching parity.
     */
    it('refuses to certify when it cannot see the action', () => {
      const source = 'The council did not fail to ensure that no unpaid balance remains unaddressed.';
      const candidate = 'The council ensured that every unpaid balance was addressed.';
      expect(codes(source, candidate)).not.toContain('FIDELITY_NEGATION_EQUIVALENT');
      expect(status(source, candidate)).toBe('blocked');
    });
  });

  describe('parity', () => {
    it('treats two negations as cancelling and one as denying', () => {
      // Same core either way; only the parity differs.
      expect(codes('I did not fail to send it.', 'I sent it.')).toContain(
        'FIDELITY_NEGATION_EQUIVALENT',
      );
      expect(codes('I did not send it.', 'I sent it.')).toContain('FIDELITY_NEGATION_REMOVED');
    });
  });

  it('leaves an ordinary faithful rewrite untouched', () => {
    expect(codes('I sent it.', 'I sent it.')).not.toContain('FIDELITY_NEGATION_EQUIVALENT');
  });
});
