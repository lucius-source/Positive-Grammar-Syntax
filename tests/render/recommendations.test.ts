import { describe, expect, it } from 'vitest';
import { renderRecommendations } from '../../src/render/recommendations';
import { extractPropositionSeed } from '../../src/parser/proposition';

const renderFromPir = (source: string) => renderRecommendations(source, extractPropositionSeed(source).proposition.unresolved ?? [], undefined, [extractPropositionSeed(source).proposition]);

describe('conservative natural recommendations', () => {
  it('renders uncertainty with calibrated epistemic language', () => {
    const [l1] = renderRecommendations('Maybe it will work.', []);
    expect(l1?.text).toBe('I am uncertain whether it will work.');
    expect(l1?.ruleIds).toEqual(['PGS-005']);
    expect(l1?.supportingFields).toContain('P1.epistemicStatus');
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

  it.each([
    ['Mistakes were made.', 'The actor responsible for the errors is not identified.', ['PGS-001']],
    ['You never listen to me.', 'I believe my points are not being fully heard.', ['PGS-002', 'PGS-005']],
    ["I can't do this yet.", 'I do not currently have the capability to complete this.', ['PGS-003', 'PGS-005']],
    ['This is going to fail.', 'I assess a risk of failure.', ['PGS-005']],
  ])('renders canonical source %s conservatively', (source, expected, rules) => {
    const [l1] = renderFromPir(source as string);
    expect(l1?.text).toBe(expected);
    expect(l1?.ruleIds).toEqual(rules);
  });

  it.each([
    ['Errors were committed.', 'The actor responsible for the errors is not identified.'],
    ["I'm not yet able to complete this.", 'I do not currently have the capability to complete this.'],
    ['It seems this could fail.', 'I assess a risk of failure.'],
  ])('renders PIR-equivalent paraphrase %s', (source, expected) => {
    expect(renderFromPir(source)[0]?.text).toBe(expected);
  });
});
