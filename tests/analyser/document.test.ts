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

  it('models an intra-sentence conditional as two protected propositions', () => {
    const result = analyseDocument("If payment isn't received by Friday, delivery won't proceed.");
    expect(result.document.propositions).toHaveLength(2);
    expect(result.relations).toContainEqual({ from: 'P1', to: 'P2', type: 'condition', marker: 'If', confidence: 'deterministic' });
    expect(result.document.propositions[0]?.negation).toMatchObject({ necessary: true });
    expect(result.document.propositions[0]).toMatchObject({ actor: null, actionOrRelation: 'receive', objectOrTarget: 'payment' });
    expect(result.document.propositions[1]?.conditions).toEqual(['P1 via if']);
    expect(result.document.propositions.every(item => item.protectedContent?.includes('conditional_negation'))).toBe(true);
  });

  it('preserves unless as the conditional marker', () => {
    const result = analyseDocument("Unless payment is received, delivery won't proceed.");
    expect(result.relations[0]).toMatchObject({ type: 'condition', marker: 'Unless' });
  });

  it('normalizes only-if order into antecedent then consequent PIR', () => {
    const result = analyseDocument('Delivery proceeds only if payment is received by Friday.');
    expect(result.document.propositions.map(item => item.actionOrRelation)).toEqual(['receive', 'proceed']);
    expect(result.relations[0]).toEqual({ from: 'P1', to: 'P2', type: 'condition', marker: 'Only if', confidence: 'deterministic' });
  });
});
