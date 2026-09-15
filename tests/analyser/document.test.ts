import { describe, expect, it } from 'vitest';
import { analyseDocument, splitSentences } from '../../src/analyser/document';

describe('multi-proposition document analyser', () => {
  it('splits a multi-sentence communication into proposition seeds', () => {
    const text = 'I reviewed the figures. I found a £500 discrepancy. I will send the transaction list today.';
    const result = analyseDocument(text);
    expect(result.document.propositions).toHaveLength(3);
    expect(result.document.propositions.map(p => p.id)).toEqual(['P1', 'P2', 'P3']);
  });

  it('preserves legitimate past-time sentences', () => {
    const result = analyseDocument('I sent the document yesterday.');
    const proposition = result.document.propositions[0];
    expect(proposition).toBeDefined();
    expect(proposition?.polarity).toBe('affirmative');
  });

  it('keeps uncertainty explicit', () => {
    const result = analyseDocument('Maybe it will work.');
    const proposition = result.document.propositions[0];
    expect(proposition).toBeDefined();
    expect(proposition?.epistemicStatus).toBe('uncertain');
  });

  it('requires semantic review for motive and ambiguous reference', () => {
    expect(analyseDocument('They deliberately ignored my email.').requiresSemanticReview).toBe(true);
  });

  it('identifies contrast relations between propositions', () => {
    const result = analyseDocument('I requested the records. However, the records have not arrived.');
    const relation = result.relations[0];
    expect(relation).toBeDefined();
    expect(relation?.type).toBe('contrast');
  });

  it('does not split ordinary sentence-internal punctuation as separate propositions', () => {
    expect(splitSentences('I reviewed the figures, found the discrepancy, and sent the list.')).toHaveLength(1);
  });
});
