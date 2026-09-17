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
