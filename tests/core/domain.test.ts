import { describe, expect, it } from 'vitest';
import { classifyProtectedDomain } from '../../src/core/domain';

describe('protected domain classification', () => {
  it.each([
    ['The claimant did not serve the notice.', 'legal'],
    ['Do not take more than two tablets.', 'medical'],
    ['Do not energise the circuit.', 'safety'],
    ['I feel blocked energy around this decision.', 'spiritual'],
  ])('classifies %s as %s', (source, domain) => expect(classifyProtectedDomain(source)).toBe(domain));

  it('does not force a domain for ordinary language', () => {
    expect(classifyProtectedDomain('I sent the document yesterday.')).toBeUndefined();
  });
});
