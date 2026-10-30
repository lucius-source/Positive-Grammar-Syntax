import { describe, expect, it } from 'vitest';
import { compareFidelity } from '../../src/core/fidelity';

/**
 * `preserve_necessary_negation` — invariant two — against the contractions
 * people actually type.
 *
 * Found on 2026-10-30 from a member's own sentence. The lexicon required
 * apostrophes and omitted `haven't` and `couldn't` entirely, so a negation it
 * could not see was a negation it could not protect:
 *
 *   "I dont like government interference."  ->  "I like government interference."
 *
 * returned `pass`. Measured over 34 pairs that each reverse the meaning, 22
 * were not blocked.
 *
 * These are not style tests. Every pair below INVERTS the source, and a
 * `pass` on any of them is the comparator telling someone their meaning
 * survived when it was reversed.
 */

const status = (source: string, candidate: string) =>
  compareFidelity(source, candidate).status;
const codes = (source: string, candidate: string) =>
  compareFidelity(source, candidate).issues.map(i => i.code);

describe('negation survives both spellings', () => {
  describe('a reversal is blocked however the contraction is typed', () => {
    it.each([
      ['do', "I don't like it.", 'I dont like it.', 'I like it.'],
      ['does', "It doesn't apply.", 'It doesnt apply.', 'It does apply.'],
      ['did', "I didn't agree.", 'I didnt agree.', 'I did agree.'],
      ['is', "It isn't settled.", 'It isnt settled.', 'It is settled.'],
      ['are', "They aren't liable.", 'They arent liable.', 'They are liable.'],
      ['was', "It wasn't sent.", 'It wasnt sent.', 'It was sent.'],
      ['were', "They weren't told.", 'They werent told.', 'They were told.'],
      ['wo', "I won't sign it.", 'I wont sign it.', 'I will sign it.'],
      ['would', "I wouldn't agree.", 'I wouldnt agree.', 'I would agree.'],
      ['should', "I shouldn't sign.", 'I shouldnt sign.', 'I should sign.'],
      ['must', "You mustn't sign.", 'You mustnt sign.', 'You must sign.'],
      ['could', "I couldn't attend.", 'I couldnt attend.', 'I could attend.'],
      ['have', "I haven't signed it.", 'I havent signed it.', 'I have signed it.'],
      ['has', "It hasn't arrived.", 'It hasnt arrived.', 'It has arrived.'],
      ['had', "I hadn't agreed.", 'I hadnt agreed.', 'I had agreed.'],
    ])('%s', (_stem, withApostrophe, without, reversed) => {
      expect(status(withApostrophe, reversed)).toBe('blocked');
      expect(status(without, reversed)).toBe('blocked');
    });

    /**
     * `can't` is `ca` + `n't`, not `can` + `n't`. The first version of this
     * fix wrote `can`, which spells `cann't` and silently dropped the one
     * contraction that already worked. It is its own test because the
     * regression was invisible to every other case.
     */
    it("can't and cant, where the stem is not the whole word", () => {
      expect(status("I can't pay the balance.", 'I can pay the balance.')).toBe('blocked');
      expect(status('I cant pay the balance.', 'I can pay the balance.')).toBe('blocked');
    });
  });

  /**
   * The other half of the same defect, and the one the member actually hit.
   * An invisible source negation made RESTORING it look like invention, so a
   * faithful rewrite was withheld.
   */
  it('does not call a restored apostrophe an invented negation', () => {
    expect(codes('I dont like it.', 'I do not like it.')).not.toContain(
      'FIDELITY_NEGATION_INVENTED',
    );
    expect(codes('I havent signed it.', 'I have not signed it.')).not.toContain(
      'FIDELITY_NEGATION_INVENTED',
    );
  });

  it('leaves a rewrite that keeps the negation alone', () => {
    expect(codes('I dont like it.', 'I do not like it.')).not.toContain(
      'FIDELITY_NEGATION_REMOVED',
    );
  });

  /**
   * The accepted cost, recorded as a test so it is a decision rather than a
   * surprise. `cant` and `wont` are real English words, and this reads them
   * as negations. A legitimate rewrite gets blocked and read by a person;
   * the alternative was a reversed meaning delivered as "your meaning
   * survived". Not comparable.
   */
  it('treats the real words cant and wont as negations, knowingly', () => {
    expect(status('It is his wont to be late.', 'It is his habit to be late.')).toBe('blocked');
  });
});
