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
});
