import { describe, expect, it } from 'vitest';
import { renderRecommendations } from '../../src/render/recommendations';

describe('conservative natural recommendations', () => {
  it('renders uncertainty with calibrated epistemic language', () => {
    const [l1] = renderRecommendations('Maybe it will work.', []);
    expect(l1?.text).toBe('I am uncertain whether it will work.');
    expect(l1?.ruleIds).toEqual(['PGS-005']);
  });

  it('renders unsupported obviousness as an assumption', () => {
    const [l1, l2] = renderRecommendations("Obviously they know what they're doing.", ['P1: reference']);
    expect(l1?.text).toBe("I assume they know what they're doing.");
    expect(l1?.ruleIds).toEqual(['PGS-002', 'PGS-005']);
    expect(l2?.text).toBeUndefined();
  });

  it('preserves operative refusal directly', () => {
    const [l1] = renderRecommendations("I don't consent to this.", []);
    expect(l1?.text).toBe('I do not consent to this.');
    expect(l1?.ruleIds).toEqual(['PGS-007']);
  });
});
