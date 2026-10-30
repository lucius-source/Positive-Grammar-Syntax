import { describe, expect, it } from 'vitest';
import { analyseDocument } from '../../src/analyser/document';
import { compareFidelity } from '../../src/core/fidelity';

/**
 * Auxiliary `do` is not the verb `do`.
 *
 * The action table's last entry mapped a bare `do` to `complete`. Being last,
 * it only won when nothing else matched — and "like" is not in the table. So
 * two spellings of the same sentence parsed differently:
 *
 *   "I dont like it."    -> no action
 *   "I do not like it."  -> action `complete`
 *
 * and the fidelity comparator, correctly applying its own rule to a wrong
 * input, blocked the rewrite for INVENTING an action. Expanding a
 * contraction is about the plainest clarity edit there is, and it could not
 * be made. Found 2026-10-30 from a member's own sentence.
 */

const action = (text: string) =>
  analyseDocument(text).document.propositions[0]?.actionOrRelation;

describe('auxiliary do carries no action', () => {
  it('parses both spellings of the same sentence the same way', () => {
    // The asymmetry WAS the bug; equality here is the whole fix.
    expect(action('I do not like it.')).toBe(action('I dont like it.'));
    expect(action('I do not like it.')).toBeUndefined();
  });

  it('lets a contraction be expanded without inventing an action', () => {
    const result = compareFidelity('I dont like it.', 'I do not like it.');
    expect(result.issues.map(i => i.code)).not.toContain('FIDELITY_ACTION_INVENTED');
    expect(result.status).toBe('pass');
  });

  describe('the lexical verb still counts', () => {
    it.each([
      ['future', 'I will do it.'],
      ['passive', 'It is done.'],
      ['explicit', 'I have not completed the form.'],
    ])('%s', (_name, text) => {
      expect(action(text)).toBe('complete');
    });
  });

  it('does not shadow a real verb that appears with do not', () => {
    // `consent` is earlier in the table, so it wins regardless. This guards
    // the ordering rather than the lookahead.
    expect(action('I do not consent to this.')).toBe('consent');
  });

  /**
   * Recorded so the limit is known rather than assumed. The lookahead
   * excludes `do not` and nothing else; question and emphatic auxiliaries
   * are equally not the verb `do` and are still mapped to `complete`.
   * Telling those from the lexical verb needs more than a lookahead.
   */
  it('still mishandles the question auxiliary, which is not what this fixed', () => {
    expect(action('Do you agree with the decision?')).toBe('complete');
  });
});
