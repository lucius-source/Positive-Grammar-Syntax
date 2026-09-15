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
});
