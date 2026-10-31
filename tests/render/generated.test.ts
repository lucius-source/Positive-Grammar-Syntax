import { describe, expect, it } from 'vitest';
import { runPgsPipeline, type Recommendation } from '../../src/pipeline';
import type { RenderResponse, SemanticEngine } from '../../src/semantic/types';

/**
 * The generated PGS-L3-natural wording, exercised through the pipeline rather
 * than against `generateRecommendation` directly — the wiring is most of what
 * can go wrong, and a caller only ever sees the pipeline's result.
 */

const CAPABILITIES = {
  propositionExtraction: true,
  relationResolution: true,
  ambiguityResolution: true,
  fidelityVerification: false,
  rendering: true,
  structuredOutput: true,
};

const determine: SemanticEngine['determine'] = async request => ({
  propositions: request.deterministicDocument.propositions,
  relations: request.deterministicRelations,
  determinations: [],
  unresolved: [],
});

/** Records whether `render` was reached, which several cases turn on. */
function renderingEngine(
  response: Partial<RenderResponse> | (() => never),
  calls: string[] = [],
): SemanticEngine & { calls: string[] } {
  return {
    id: 'cloud:test',
    providerKind: 'cloud',
    capabilities: CAPABILITIES,
    determine,
    async render(request) {
      calls.push(request.source);
      if (typeof response === 'function') response();
      return { text: '', ruleTrace: [], protectedContentPreserved: true, ...response };
    },
    calls,
  };
}

const l3 = (recommendations: Recommendation[]): Recommendation | undefined =>
  recommendations.find(r => r.level === 'PGS-L3-natural');

/** A determine that returns the affirmative restatement step 2 asks for. */
const determiningDesiredState =
  (value: string): SemanticEngine['determine'] =>
  async request => ({
    propositions: request.deterministicDocument.propositions,
    relations: request.deterministicRelations,
    determinations: [
      {
        field: 'desiredState',
        propositionId: 'P1',
        value,
        status: 'determined' as const,
        basis: 'Affirmative restatement preserving the truth conditions.',
      },
    ],
    unresolved: [],
  });

describe('the affirmative wording composed from a determination', () => {
  /**
   * The feature `docs/20` exists for, and the first point a member sees it.
   *
   * `compareFidelity` blocks every affirmative restatement with
   * FIDELITY_NEGATION_REMOVED, because it keys on the negation token being
   * absent and its authorised exceptions are structural proofs. The owner's
   * decision of 2026-10-31 is to offer the wording with its issues attached
   * rather than withhold it: the member wrote the sentence and can judge
   * whether it still says what they meant.
   *
   * `calls` being empty is the other half. The wording is composed from the
   * determination, so the second model call that free-writes prose does not
   * happen — cheaper, and bounded by a field a person can read beside it.
   */
  it('offers the wording with its fidelity issues, without calling render', async () => {
    const calls: string[] = [];
    const engine = renderingEngine({ text: 'unused' }, calls);
    engine.determine = determiningDesiredState('the second item is absent from the delivery');
    const result = await runPgsPipeline('The delivery did not include the second item.', engine);
    const generated = l3(result.recommendations);
    expect(generated?.text).toBe('The second item is absent from the delivery.');
    expect(generated?.withheldReason).toBeUndefined();
    expect(generated?.ruleIds).toContain('PGS-007');
    expect(generated?.fidelityIssues?.map(i => i.code)).toContain('FIDELITY_NEGATION_REMOVED');
    expect(calls).toEqual([]);
  });

  /**
   * The safety control, and the reason this path is acceptable at all.
   *
   * `necessary` is decided deterministically — "I do not consent to this."
   * carries `necessary: true` from the protected legal domain — so consent
   * never reaches the affirmative branch and no model judgement stands between
   * a member and that protection. Render is reached instead, which is the
   * behaviour this had before.
   */
  it('never takes the affirmative path for a necessary negation', async () => {
    const calls: string[] = [];
    const engine = renderingEngine({ text: 'I consent to this.' }, calls);
    engine.determine = determiningDesiredState('consent is given');
    const result = await runPgsPipeline('I do not consent to this.', engine);
    expect(l3(result.recommendations)?.text).not.toBe('Consent is given.');
    expect(calls).toEqual(['I do not consent to this.']);
  });
});

describe('generated PGS-L3-natural wording', () => {
  it('offers nothing at all when the engine cannot render', async () => {
    const engine: SemanticEngine = {
      id: 'local:test',
      providerKind: 'local',
      capabilities: { ...CAPABILITIES, rendering: false },
      determine,
    };
    const result = await runPgsPipeline('I am writing to complain about the way my case has been handled.', engine);
    expect(result.recommendations).toHaveLength(2);
    expect(l3(result.recommendations)).toBeUndefined();
  });

  it('offers a wording that survives the fidelity comparison', async () => {
    const engine = renderingEngine({
      text: 'I am writing to complain about how my case has been handled.',
      ruleTrace: ['PGS-002'],
    });
    const result = await runPgsPipeline('I am writing to complain about the way my case has been handled.', engine);
    const generated = l3(result.recommendations);
    expect(generated?.text).toBe('I am writing to complain about how my case has been handled.');
    expect(generated?.withheldReason).toBeUndefined();
    expect(generated?.supportingFields).toContain('engine:cloud:test');
  });

  describe('EXC-008 — correspondence only, not instruments', () => {
    it('withholds a wording for instrument text', async () => {
      const engine = renderingEngine({ text: 'The settlor gives the fund to the trustees.' });
      const result = await runPgsPipeline(
        'The Settlor hereby declares that the Trustees shall hold the Trust Fund upon trust.',
        engine,
      );
      const generated = l3(result.recommendations);
      expect(generated?.text).toBeUndefined();
      expect(generated?.ruleIds).toContain('EXC-008');
      expect(generated?.withheldReason).toMatch(/operative text of a legal instrument/);
    });

    /** The point of the ordering: a deed is never sent anywhere to be rewritten. */
    it('does not call the engine at all for instrument text', async () => {
      const engine = renderingEngine({ text: 'anything' });
      await runPgsPipeline('IN WITNESS WHEREOF the parties have executed this Deed.', engine);
      expect(engine.calls).toEqual([]);
    });

    it('names the markers that caused the withholding', async () => {
      const engine = renderingEngine({ text: 'anything' });
      const result = await runPgsPipeline('IN WITNESS WHEREOF the parties have executed this Deed.', engine);
      expect(l3(result.recommendations)?.withheldReason).toMatch(/IN WITNESS WHEREOF/i);
    });

    it('still generates for correspondence about a legal matter', async () => {
      const engine = renderingEngine({ text: 'I do not consent to this.' });
      const result = await runPgsPipeline('I do not consent to this.', engine);
      expect(engine.calls).toHaveLength(1);
      expect(l3(result.recommendations)?.ruleIds).not.toContain('EXC-008');
    });
  });

  describe('fidelity gate', () => {
    it('withholds a wording that changed the meaning, and says what changed', async () => {
      const engine = renderingEngine({ text: 'I received the payment on 3 September.' });
      const result = await runPgsPipeline('I have not received the payment.', engine);
      const generated = l3(result.recommendations);
      expect(generated?.text).toBeUndefined();
      expect(generated?.withheldReason).toMatch(/changed the meaning/);
      expect(generated?.fidelityIssues?.length).toBeGreaterThan(0);
    });

    it('believes the engine when it reports protected content was lost', async () => {
      const engine = renderingEngine({
        text: 'I am writing to complain about how my case has been handled.',
        protectedContentPreserved: false,
      });
      const result = await runPgsPipeline('I am writing to complain about the way my case has been handled.', engine);
      const generated = l3(result.recommendations);
      expect(generated?.text).toBeUndefined();
      expect(generated?.withheldReason).toMatch(/protected content was not preserved/);
    });

    it('withholds an empty wording rather than offering a blank', async () => {
      const engine = renderingEngine({ text: '   ' });
      const result = await runPgsPipeline('I am writing to complain about the way my case has been handled.', engine);
      expect(l3(result.recommendations)?.withheldReason).toMatch(/no wording/);
    });
  });

  describe('when rendering fails', () => {
    it('reports the error without losing the analysis', async () => {
      const engine = renderingEngine(() => {
        throw new Error('render timed out');
      });
      const result = await runPgsPipeline('I am writing to complain about the way my case has been handled.', engine);
      expect(result.renderError).toMatch(/render timed out/);
      expect(l3(result.recommendations)).toBeUndefined();
      expect(result.recommendations).toHaveLength(2);
      expect(result.deterministic.document.propositions.length).toBeGreaterThan(0);
    });
  });

  it('leaves the deterministic L1 and L2 exactly where they were', async () => {
    const engine = renderingEngine({ text: 'I believe they deliberately ignored my email.' });
    const result = await runPgsPipeline('They deliberately ignored my email.', engine);
    expect(result.recommendations[0]?.level).toBe('PGS-L1');
    expect(result.recommendations[1]?.level).toBe('PGS-L2');
    expect(result.recommendations[2]?.level).toBe('PGS-L3-natural');
  });
});
