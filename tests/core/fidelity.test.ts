import { describe, expect, it } from 'vitest';
import { compareFidelity } from '../../src/core/fidelity';

describe('deterministic fidelity comparison', () => {
  it('blocks removed operative negation and changed quantity', () => {
    const result = compareFidelity('Do not take more than two tablets in 24 hours.', 'Take three tablets.');
    expect(result.status).toBe('blocked');
    expect(result.issues.map(item => item.code)).toEqual(expect.arrayContaining(['FIDELITY_NEGATION_REMOVED', 'FIDELITY_QUANTITY_REMOVED', 'FIDELITY_QUANTITY_INVENTED']));
  });

  it('blocks removal of a condition', () => {
    const result = compareFidelity("If payment isn't received by Friday, delivery won't proceed.", 'Delivery will proceed Friday.');
    expect(result.issues.map(item => item.code)).toContain('FIDELITY_CONDITION_REMOVED');
  });

  it('recognizes a structurally equivalent only-if contraposition without allowing ordinary negation removal', () => {
    const result = compareFidelity("If payment isn't received by Friday, delivery won't proceed.", 'Delivery proceeds only if payment is received by Friday.');
    expect(result.issues.map(item => item.code)).toContain('FIDELITY_CONDITION_EQUIVALENT');
    expect(result.issues.map(item => item.code)).not.toContain('FIDELITY_NEGATION_REMOVED');
    expect(result.status).toBe('review_required');
  });

  it('blocks an epistemic certainty upgrade', () => {
    const result = compareFidelity('I may send it Friday.', 'I will send it Friday.');
    expect(result.issues.map(item => item.code)).toContain('FIDELITY_CERTAINTY_UPGRADED');
  });

  it('blocks actors and actions absent from authorised content', () => {
    const result = compareFidelity('The actor is unknown.', 'The supplier sent it.');
    expect(result.issues.map(item => item.code)).toContain('FIDELITY_ACTOR_INVENTED');
    expect(result.issues.map(item => item.code)).toContain('FIDELITY_ACTION_INVENTED');
  });

  it('lets an elliptical apology restore the subject its ellipsis dropped', () => {
    // "Sorry if you were offended." is the same speech act as "I am sorry
    // if…", so PGS-L1's documented fronting is not inventing an actor. Both
    // actor checks need the authorisation: the surface one keys on `i`, the
    // PIR one on the parser's `speaker`, which is no word in the source.
    const result = compareFidelity(
      'Sorry if you were offended.',
      'If you were offended, I am sorry.',
    );
    expect(result.issues.filter(i => i.code === 'FIDELITY_ACTOR_INVENTED')).toEqual([]);
    expect(result.issues.some(i => i.severity === 'blocked')).toBe(false);
  });

  it('still blocks a first-person subject where no apology licenses one', () => {
    // The authorisation is scoped to the apology construction, not to every
    // source that happens to omit its subject.
    const result = compareFidelity('The second item was missing.', 'I lost the second item.');
    expect(result.issues.map(i => i.code)).toContain('FIDELITY_ACTOR_INVENTED');
  });

  it('does not call a source word promoted to subject an invented actor', () => {
    // The owner's own case. The parser reads `two` and `contents` as actors of
    // the rewrite and neither as an actor of the source, so the PIR check
    // reported both as fabricated and withheld the wording. Both words are in
    // the source, so neither was invented.
    const result = compareFidelity(
      'I did not receive two of the items, and the contents were wrong.',
      'Two of the contents are absent from the delivery.',
    );
    const invented = result.issues.filter(item => item.code === 'FIDELITY_ACTOR_INVENTED');
    expect(invented.map(item => item.evidence)).not.toContain('two, contents');
    expect(invented).toEqual([]);
  });

  it('still blocks an actor the source never mentions', () => {
    // The safety property the filter has to keep: presence in the source is
    // what excuses a promoted subject, and a role nobody mentioned has none.
    const result = compareFidelity('Two of the items are absent.', 'Couriers lost two of the items.');
    expect(result.issues.map(item => item.code)).toContain('FIDELITY_ACTOR_INVENTED');
    expect(result.status).toBe('blocked');
  });

  it('allows verified context while reviewing an omitted source action', () => {
    const result = compareFidelity('They ignored my email.', 'I sent the email. Please confirm receipt.', {
      knownFacts: ['I sent the email'], userIntent: 'Please confirm receipt',
    });
    expect(result.status).toBe('review_required');
    expect(result.issues.every(item => item.severity !== 'blocked')).toBe(true);
  });

  it('allows a canonical observation-before-interpretation recast', () => {
    expect(compareFidelity('You never listen to me.', 'I believe my points are not being fully heard.').status).toBe('review_required');
  });

  it('marks an omitted PIR action for review', () => {
    const result = compareFidelity('I sent the document. I found a discrepancy.', 'I sent the document.');
    expect(result.status).toBe('review_required');
    expect(result.issues.map(item => item.code)).toContain('FIDELITY_PIR_ACTION_OMITTED');
  });

  it('marks an omitted known actor for review', () => {
    const result = compareFidelity('Maria sent the file.', 'The file was sent.');
    expect(result.status).toBe('review_required');
    expect(result.issues.map(item => item.code)).toContain('FIDELITY_PIR_ACTOR_OMITTED');
  });

  it('blocks reversal or removal of an explicitly aligned temporal order', () => {
    const reversed = compareFidelity(
      'I sent the report after Maria reviewed the file.',
      'I sent the report before Maria reviewed the file.',
    );
    expect(reversed.status).toBe('blocked');
    expect(reversed.issues.map(issue => issue.code)).toContain('FIDELITY_TEMPORAL_ORDER_CHANGED');

    const removed = compareFidelity(
      'After Maria reviewed the file, I sent the report.',
      'Maria reviewed the file and I sent the report.',
    );
    expect(removed.issues.map(issue => issue.code)).toContain('FIDELITY_TEMPORAL_ORDER_CHANGED');
  });

  it('accepts equivalent leading and trailing expressions of the same temporal order', () => {
    const result = compareFidelity(
      'After Maria reviewed the file, I sent the report.',
      'I sent the report after Maria reviewed the file.',
    );
    expect(result.issues.map(issue => issue.code)).not.toContain('FIDELITY_TEMPORAL_ORDER_CHANGED');
    expect(result.issues.map(issue => issue.code)).not.toContain('FIDELITY_TEMPORAL_ORDER_INVENTED');
  });

  it('blocks an explicit temporal order invented by a candidate', () => {
    const result = compareFidelity(
      'Maria reviewed the file. I sent the report.',
      'I sent the report after Maria reviewed the file.',
    );
    expect(result.status).toBe('blocked');
    expect(result.issues.map(issue => issue.code)).toContain('FIDELITY_TEMPORAL_ORDER_INVENTED');
  });
});
