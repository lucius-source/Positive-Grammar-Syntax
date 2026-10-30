import { describe, expect, it } from 'vitest';
import { compareFidelity } from '../../src/core/fidelity';

/**
 * `preserve_evidential_framing`, accepted 2026-10-30 at review_required.
 *
 * The rule exists because `compareFidelity` returned a clean `pass` for
 *
 *   "It has been decided that your application will not be progressed."
 *   -> "Your application will not be progressed at this time."
 *
 * which is reachable today through the live rewrite check, not only through
 * the generator. docs/18 has the measurement.
 *
 * The counterexamples carry the weight. A frame detector that fired on the
 * bare verb would flag "we decided to close the account" — an ordinary
 * assertion by a named actor — and the rule would cost more than it protects.
 */

const codes = (source: string, candidate: string) =>
  compareFidelity(source, candidate).issues.map(i => i.code);
const status = (source: string, candidate: string) => compareFidelity(source, candidate).status;

const FRAMED = 'It has been decided that your application will not be progressed at this time.';
const FLATTENED = 'Your application will not be progressed at this time.';

describe('preserve_evidential_framing', () => {
  describe('catches a frame the candidate drops', () => {
    it('flags the case that prompted the rule, which used to pass clean', () => {
      expect(codes(FRAMED, FLATTENED)).toContain('FIDELITY_FRAMING_REMOVED');
    });

    it('quotes the frame it found, so the reader can see what moved', () => {
      const issue = compareFidelity(FRAMED, FLATTENED).issues.find(
        i => i.code === 'FIDELITY_FRAMING_REMOVED',
      );
      expect(issue?.evidence?.toLowerCase()).toContain('has been decided that');
    });

    it.each([
      ['reported speech', 'I am told that the payment was never received.', 'The payment was never received.'],
      ['decision taken', 'A decision has been taken to close the account.', 'The account will be closed.'],
      ['impersonal belief', 'It is believed that the form was lost in transit.', 'The form was lost in transit.'],
      ['agreement', 'It was agreed that the balance would be written off.', 'The balance would be written off.'],
    ])('%s', (_name, source, candidate) => {
      expect(codes(source, candidate)).toContain('FIDELITY_FRAMING_REMOVED');
    });
  });

  describe('review_required, never blocked', () => {
    it('does not block a rewrite on framing alone', () => {
      expect(status(FRAMED, FLATTENED)).toBe('review_required');
    });

    it('leaves a genuinely blocked rewrite blocked', () => {
      // Invents "we" as the decider. Blocked by the actor rule, and framing
      // must not soften that to review_required.
      expect(status(FRAMED, 'We will not progress your application at this time.')).toBe('blocked');
    });
  });

  describe('does not fire where there is no frame to lose', () => {
    it('spares a named actor asserting their own decision', () => {
      // The trap the detector is shaped around: the bare verb is not a frame.
      expect(codes('We decided to close the account.', 'We closed the account.')).not.toContain(
        'FIDELITY_FRAMING_REMOVED',
      );
    });

    it('spares a rewrite that keeps the frame', () => {
      expect(
        codes(FRAMED, 'It was decided that your application will not be progressed at this time.'),
      ).not.toContain('FIDELITY_FRAMING_REMOVED');
    });

    it.each([
      ['ordinary correspondence', 'I am writing to complain about the way my case has been handled.', 'I am writing to complain about how my case was handled.'],
      ['a hedge, not a frame', 'It may be that the form was never received.', 'The form may never have been received.'],
      ['a removed negation', 'I have not received the payment.', 'I received the payment.'],
      ['unchanged text', FRAMED, FRAMED],
    ])('%s', (_name, source, candidate) => {
      expect(codes(source, candidate)).not.toContain('FIDELITY_FRAMING_REMOVED');
    });
  });

  /**
   * The regex carries no `g` flag deliberately. A global regex keeps
   * `lastIndex` between calls, so the same comparison would answer
   * differently depending on what was compared before it — a bug that only
   * shows up in sequences and never in a single assertion.
   */
  it('gives the same answer however many times it is asked', () => {
    for (let i = 0; i < 5; i++) {
      expect(codes(FRAMED, FLATTENED)).toContain('FIDELITY_FRAMING_REMOVED');
      expect(codes('We decided to close the account.', 'We closed the account.')).not.toContain(
        'FIDELITY_FRAMING_REMOVED',
      );
    }
  });
});
