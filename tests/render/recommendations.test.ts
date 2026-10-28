import { describe, expect, it } from 'vitest';
import { renderRecommendations } from '../../src/render/recommendations';
import { extractPropositionSeed } from '../../src/parser/proposition';
import { analyseDocument } from '../../src/analyser/document';

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

  it('renders a verified double-negative condition as only-if', () => {
    const source = "If payment isn't received by Friday, delivery won't proceed.";
    const analysis = analyseDocument(source);
    const [l1] = renderRecommendations(source, [], undefined, analysis.document.propositions);
    expect(l1?.text).toBe('Delivery proceeds only if payment is received by Friday.');
    expect(l1?.ruleIds).toEqual(['PGS-004', 'PGS-007']);
    expect(l1?.supportingFields).toContain('relation.condition');
  });

  it('preserves experiential status and ambiguous disagreement', () => {
    expect(renderFromPir('I feel blocked energy around this decision.')[0]?.text).toBe('I experience what I describe as blocked energy around this decision.');
    const [l1, l2] = renderFromPir("I don't disagree.");
    expect(l1?.text).toBe('I am not expressing disagreement.');
    expect(l2?.text).toBeUndefined();
  });

  /**
   * The evaluative-label rule covers the family its detector already matches.
   *
   * `evaluativeLabel` in core/rules.ts matches useless, hopeless and
   * worthless, and raises PGS-002 and PGS-005 for all three. Until 2026-10-28
   * the renderer matched the single sentence "I'm useless at this.", so the
   * engine could name the problem in "I'm hopeless at spreadsheets" and could
   * not rewrite it.
   *
   * The object is carried through verbatim. Inventing a task the speaker did
   * not name is the one failure this rule must not have.
   */
  it.each([
    ["I'm useless at this.", 'I am having difficulty with this task.'],
    ["I'm hopeless at spreadsheets.", 'I am having difficulty with spreadsheets.'],
    ['I am worthless at negotiating.', 'I am having difficulty with negotiating.'],
    ["I'm useless at it.", 'I am having difficulty with this task.'],
    [
      "I'm hopeless at remembering names.",
      'I am having difficulty with remembering names.',
    ],
  ])('calibrates the evaluative label in %s', (source, expected) => {
    const [l1] = renderFromPir(source);
    expect(l1?.text).toBe(expected);
    expect(l1?.ruleIds).toEqual(['PGS-002', 'PGS-005']);
  });

  it('does not calibrate an evaluative label about someone else', () => {
    // The rule speaks for the speaker about the speaker. Rewriting a claim
    // about a third party would change what was said about them.
    const [l1] = renderFromPir('He is useless at this.');
    expect(l1?.text).not.toBe('I am having difficulty with this task.');
  });

  it.each([
    ['Errors were committed.', 'The actor responsible for the errors is not identified.'],
    ["I'm not yet able to complete this.", 'I do not currently have the capability to complete this.'],
    ['It seems this could fail.', 'I assess a risk of failure.'],
  ])('renders PIR-equivalent paraphrase %s', (source, expected) => {
    expect(renderFromPir(source)[0]?.text).toBe(expected);
  });
});
