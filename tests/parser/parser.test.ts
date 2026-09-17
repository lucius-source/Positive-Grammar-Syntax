import { describe, expect, it } from 'vitest';
import { parseSentence } from '../../src/parser/sentence';
import { extractPropositionSeed } from '../../src/parser/proposition';

describe('deterministic sentence parser', () => {
  it('identifies protected negative command surface features', () => {
    const parsed = parseSentence('Do not energise the circuit.');
    expect(parsed.sentenceType).toBe('command');
    expect(parsed.polarity).toBe('negative');
    expect(parsed.negationTokens).toContain('not');
  });

  it('extracts explicit temporal tokens without inventing a normalized date', () => {
    expect(parseSentence('Please send the file by Friday.').temporalTokens).toContain('friday');
  });

  it('preserves accurate past-language surface form without classifying it as an error', () => {
    const parsed = parseSentence('I sent the document yesterday.');
    expect(parsed.temporalTokens).toContain('yesterday');
    expect(parsed.polarity).toBe('affirmative');
  });

  it('detects contracted copular negation', () => {
    expect(parseSentence("Payment isn't received.").negationTokens).toContain("isn't");
  });

  it('classifies a bare imperative as a command', () => {
    expect(parseSentence('Stop talking.').sentenceType).toBe('command');
  });
});

describe('proposition seed extraction', () => {
  it('protects explicit non-consent', () => {
    const { proposition } = extractPropositionSeed("I don't consent to this.");
    expect(proposition.speechAct).toBe('refusal');
    expect(proposition.fidelityStatus).toBe('protected');
    expect(proposition.protectedContent).toContain('operative_negation');
  });

  it('requires semantic review for ambiguous reference and motive', () => {
    const result = extractPropositionSeed('They deliberately ignored my email.');
    expect(result.requiresSemanticReview).toBe(true);
    expect(result.proposition.unresolved).toEqual(expect.arrayContaining(['reference', 'motive']));
  });

  it('marks uncertainty rather than upgrading certainty', () => {
    const { proposition } = extractPropositionSeed('Maybe it will work.');
    expect(proposition.epistemicStatus).toBe('uncertain');
  });

  it('extracts known PIR fields without filling unknown actors', () => {
    const { proposition } = extractPropositionSeed('They deliberately ignored my email.');
    expect(proposition.actor).toBeNull();
    expect(proposition.actionOrRelation).toBe('ignore');
    expect(proposition.objectOrTarget).toBe('my email');
  });

  it('extracts explicit time and quantities', () => {
    const { proposition } = extractPropositionSeed('Do not take more than two tablets in 24 hours.');
    expect(proposition.actor).toBe('addressee');
    expect(proposition.actionOrRelation).toBe('take');
    expect(proposition.quantities).toEqual(['two', '24']);
  });

  it('marks a passive actor as unresolved', () => {
    const { proposition } = extractPropositionSeed('Errors were committed.');
    expect(proposition.actor).toBeNull();
    expect(proposition.objectOrTarget).toBe('Errors');
    expect(proposition.unresolved).toContain('actor');
  });

  it('does not mistake a capitalized article for a named actor', () => {
    expect(extractPropositionSeed('The file was sent.').proposition.actor).toBeNull();
  });

  it('protects material legal negation even when it is not a command', () => {
    const { proposition } = extractPropositionSeed('The claimant did not serve the notice.');
    expect(proposition.domain).toBe('legal');
    expect(proposition.actor).toBe('claimant');
    expect(proposition.actionOrRelation).toBe('serve');
    expect(proposition.negation).toMatchObject({ present: true, necessary: true });
    expect(proposition.protectedContent).toContain('high_risk_negation');
    expect(proposition.fidelityStatus).toBe('protected');
  });

  it('extracts the action and speech act from a bare imperative', () => {
    const { proposition } = extractPropositionSeed('Stop talking.');
    expect(proposition.actor).toBe('addressee');
    expect(proposition.actionOrRelation).toBe('stop');
    expect(proposition.objectOrTarget).toBe('talking');
    expect(proposition.speechAct).toBe('command');
  });

  it('distinguishes future intention from an explicit promise', () => {
    const future = extractPropositionSeed('I will send the document tomorrow.').proposition;
    const promise = extractPropositionSeed("I promise I won't let you down.").proposition;
    expect(future).toMatchObject({ speechAct: 'assertion', epistemicStatus: 'intended' });
    expect(promise).toMatchObject({ speechAct: 'promise', epistemicStatus: 'intended' });
    expect(promise.negation).toMatchObject({ necessary: true });
    expect(promise.protectedContent).toContain('operative_negation');
    expect(future.modality).toBe('intention');
    expect(promise.modality).toBe('commitment');
  });

  it('distinguishes ability and uncertain possibility modalities', () => {
    expect(extractPropositionSeed("I can't do this yet.").proposition.modality).toBe('ability');
    expect(extractPropositionSeed('Maybe it will work.').proposition.modality).toBe('possibility');
  });

  it('preserves an embedded conditional without inventing an admission', () => {
    expect(extractPropositionSeed('Sorry if you were offended.').proposition.conditions).toEqual(['if you were offended']);
  });

  it('preserves experiential status in the spiritual domain', () => {
    expect(extractPropositionSeed('I feel blocked energy around this decision.').proposition).toMatchObject({
      actor: 'speaker', actionOrRelation: 'feel', epistemicStatus: 'reported', domain: 'spiritual',
    });
  });

  it('keeps negated disagreement ambiguous rather than upgrading it to agreement', () => {
    expect(extractPropositionSeed("I don't disagree.").proposition).toMatchObject({
      actor: 'speaker', actionOrRelation: 'disagree', speechAct: 'assertion', unresolved: ['epistemic position'],
    });
  });

  it('extracts obligation, relative timing and unresolved action detail from a null chain', () => {
    expect(extractPropositionSeed('The party shall immediately and hereby be proceeding.').proposition).toMatchObject({
      actor: 'party', actionOrRelation: 'proceed', modality: 'obligation',
      time: { eventTime: 'immediately', temporalStatus: 'relative' }, unresolved: ['action detail'],
    });
  });

  it('keeps asserted knowledge unresolved pending evidence classification', () => {
    expect(extractPropositionSeed('I know he stole it.').proposition).toMatchObject({
      actor: 'speaker', actionOrRelation: 'know', unresolved: expect.arrayContaining(['reference', 'evidence']),
    });
  });

  it('extracts explicit request actions used by causal alignment', () => {
    expect(extractPropositionSeed('Maria requested the report.').proposition).toMatchObject({ actor: 'Maria', actionOrRelation: 'request', objectOrTarget: 'the report' });
  });

  it('extracts an explicit desired state without promoting it to fact', () => {
    expect(extractPropositionSeed('I want the accounts reconciled by Friday.').proposition).toMatchObject({
      actor: 'speaker', desiredState: 'the accounts reconciled by Friday', epistemicStatus: 'intended', speechAct: 'expression',
      time: { deadline: 'friday' },
    });
  });
});
