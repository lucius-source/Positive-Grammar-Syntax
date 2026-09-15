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

  it('blocks an epistemic certainty upgrade', () => {
    const result = compareFidelity('I may send it Friday.', 'I will send it Friday.');
    expect(result.issues.map(item => item.code)).toContain('FIDELITY_CERTAINTY_UPGRADED');
  });

  it('blocks actors and actions absent from authorised content', () => {
    const result = compareFidelity('The actor is unknown.', 'The supplier sent it.');
    expect(result.issues.map(item => item.code)).toContain('FIDELITY_ACTOR_INVENTED');
    expect(result.issues.map(item => item.code)).toContain('FIDELITY_ACTION_INVENTED');
  });

  it('allows content explicitly supplied as verified context', () => {
    const result = compareFidelity('They ignored my email.', 'I sent the email. Please confirm receipt.', {
      knownFacts: ['I sent the email'], userIntent: 'Please confirm receipt',
    });
    expect(result.status).toBe('pass');
  });
});
