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

  /**
   * A conditional apology keeps its condition.
   *
   * PGS-002 forbids inventing an admission, which rules out the obvious
   * rewrite: "I am sorry that I upset you" asserts the upset as fact. Fronting
   * the condition preserves the proposition exactly and removes the reading
   * where "sorry" lands first and the condition is heard as a qualifier.
   */
  it.each([
    ["I'm sorry if that upset you.", 'If that upset you, I am sorry.'],
    ['I am sorry if the delay caused problems.', 'If the delay caused problems, I am sorry.'],
  ])('preserves the embedded condition in %s', (source, expected) => {
    const [l1] = renderFromPir(source);
    expect(l1?.text).toBe(expected);
    expect(l1?.ruleIds).toEqual(['PGS-002']);
  });

  /**
   * Impossibility becomes a claim the speaker can warrant — and nothing more.
   *
   * PGS-006 says a proposed alternative requires user-supplied context, so the
   * rewrite must not offer a way round. It is deliberately absent from
   * ruleIds: no alternative was proposed, so claiming the rule would
   * misreport what the engine did.
   */
  it.each([
    ['This is impossible.', 'I do not currently see a way to do this.'],
    ['It is impossible to deliver by Friday.', 'I do not currently see a way to deliver by Friday.'],
  ])('calibrates absolute impossibility in %s', (source, expected) => {
    const [l1] = renderFromPir(source);
    expect(l1?.text).toBe(expected);
    expect(l1?.ruleIds).toEqual(['PGS-002', 'PGS-005']);
  });

  /**
   * Present inability, and the negation that must survive it.
   *
   * "Currently" is a softener. The charter forbids softening where the
   * negation is operative, and classifyProtectedDomain treats consent as
   * legal — so "I cannot consent" keeps its words. Leaving it untouched is
   * the correct outcome, not a gap in coverage.
   */
  it.each([
    ["I can't open the file.", 'I am not currently able to open the file.'],
    ['I cannot attend on Thursday.', 'I am not currently able to attend on Thursday.'],
  ])('scopes present inability in %s', (source, expected) => {
    expect(renderFromPir(source)[0]?.text).toBe(expected);
  });

  it.each([
    'I cannot consent to this.',
    'I cannot accept liability for this.',
  ])('leaves a protected-domain negation unsoftened: %s', (source) => {
    const [l1] = renderFromPir(source);
    // Asserted as equality, not as the absence of "not currently able": these
    // sentences DO match the inability pattern, so a test that only checked
    // for the softened wording would also pass if the rule had never fired,
    // and would stop proving the guard the moment the pattern changed.
    expect(l1?.text).toBe(source);
    expect(l1?.ruleIds).toEqual([]);
  });

  /**
   * A vague evaluation names the gap rather than filling it.
   *
   * PGS-002 wants the evaluation separated from observable criteria; PGS-006
   * forbids inventing any. Naming the absence satisfies both, and matches what
   * the PGS-001 rule already does for a missing actor.
   */
  it.each([
    ['The report is bad.', 'The criteria for this evaluation of the report remain to be stated.'],
    ['This draft is really bad.', 'The criteria for this evaluation of the draft remain to be stated.'],
  ])('separates vague evaluation from criteria in %s', (source, expected) => {
    const [l1] = renderFromPir(source);
    expect(l1?.text).toBe(expected);
    expect(l1?.ruleIds).toEqual(['PGS-002']);
  });

  /**
   * An absolute generalisation is calibrated and attributed — adverb only.
   *
   * Rewriting the verb would mean changing tense, and regex surgery on a
   * predicate produces "you have interrupt me". The rule moves the adverb,
   * attributes the claim, and carries everything else through.
   */
  it.each([
    ['You always interrupt me.', 'I believe you often interrupt me.'],
    ['They never reply to my emails.', 'I believe they rarely reply to my emails.'],
    // The first-person pronoun stays capitalised when it moves out of
    // sentence-initial position. The first version of this rule lower-cased
    // every subject and produced "I believe i often...".
    ['I always get this wrong.', 'I believe I often get this wrong.'],
  ])('calibrates the absolute in %s', (source, expected) => {
    const [l1] = renderFromPir(source);
    expect(l1?.text).toBe(expected);
    expect(l1?.ruleIds).toEqual(['PGS-002', 'PGS-005']);
  });

  it('keeps the specific never-listen rule ahead of the general one', () => {
    // The structural rule is more informative than the generic calibration,
    // so order matters and is asserted rather than assumed.
    expect(renderFromPir('You never listen to me.')[0]?.text).toBe(
      'I believe my points are not being fully heard.',
    );
  });

  it.each([
    'Never energise the circuit while it is live.',
    'You never disclose the contract terms.',
  ])('does not soften an absolute that carries operative force: %s', (source) => {
    // The first has no subject, so it is an instruction rather than a report;
    // the second is legal by domain. Softening "never" to "rarely" in either
    // would invert the rule being stated.
    const [l1] = renderFromPir(source);
    expect(l1?.text).not.toMatch(/\brarely\b/);
  });

  it.each([
    ['Errors were committed.', 'The actor responsible for the errors is not identified.'],
    ["I'm not yet able to complete this.", 'I do not currently have the capability to complete this.'],
    ['It seems this could fail.', 'I assess a risk of failure.'],
  ])('renders PIR-equivalent paraphrase %s', (source, expected) => {
    expect(renderFromPir(source)[0]?.text).toBe(expected);
  });
});
