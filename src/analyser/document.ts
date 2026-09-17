import type { PgsDocument } from '../core/types';
import { extractPropositionSeed } from '../parser/proposition';

export type PropositionRelationType = 'condition' | 'cause' | 'contrast' | 'evidence' | 'intention' | 'action' | 'temporal_sequence' | 'continuation';

export interface PropositionRelation {
  from: string;
  to: string;
  type: PropositionRelationType;
  marker?: string;
  confidence: 'deterministic' | 'candidate';
}

export interface DocumentAnalysis {
  document: PgsDocument;
  relations: PropositionRelation[];
  requiresSemanticReview: boolean;
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9“"'])/)
    .map(s => s.trim())
    .filter(Boolean);
}

function leadingMarker(text: string): string | undefined {
  return text.match(/^\S+/)?.[0];
}

function hasExplicitClauseActor(text: string): boolean {
  return /^(?:i|we|you|they|he|she|it|this|that|the\s+\w+)\b/i.test(text) || /^[A-Z][a-z]+\b/.test(text);
}

function relationWithMarker(
  from: string,
  to: string,
  type: PropositionRelationType,
  current: string,
  confidence: PropositionRelation['confidence'],
): PropositionRelation {
  const marker = leadingMarker(current);
  return marker ? { from, to, type, marker, confidence } : { from, to, type, confidence };
}

function relationBetween(previous: string, current: string, from: string, to: string): PropositionRelation {
  if (/^(?:if|unless|provided that)\b/i.test(current)) return relationWithMarker(from, to, 'condition', current, 'deterministic');
  if (/^(?:because|therefore|thus|consequently)\b/i.test(current)) return relationWithMarker(from, to, 'cause', current, 'candidate');
  if (/^(?:but|however|although|yet)\b/i.test(current)) return relationWithMarker(from, to, 'contrast', current, 'deterministic');
  if (/^(?:so|accordingly)\b/i.test(current)) return relationWithMarker(from, to, 'action', current, 'candidate');
  if (/\b(?:today|tomorrow|yesterday|then|after|before|next)\b/i.test(previous + ' ' + current)) return { from, to, type: 'temporal_sequence', confidence: 'candidate' };
  return { from, to, type: 'continuation', confidence: 'candidate' };
}

export function analyseDocument(text: string): DocumentAnalysis {
  const sentences = splitSentences(text);
  const seeds: ReturnType<typeof extractPropositionSeed>[] = [];
  const relations: PropositionRelation[] = [];
  const sentenceRanges: Array<{ first: string; last: string }> = [];

  for (const sentence of sentences) {
    const conditional = sentence.match(/^\s*(If|Unless)\s+(.+?),\s+(.+)$/i);
    const onlyIf = sentence.match(/^\s*(.+?)\s+only if\s+(.+)$/i);
    const coordinatedAction = sentence.match(/^\s*(.+?),\s+(so)\s+(.+)$/i);
    const firstId = `P${seeds.length + 1}`;
    const marker = conditional?.[1] ?? (onlyIf ? 'Only if' : undefined);
    const antecedentText = conditional?.[2] ?? onlyIf?.[2];
    const consequentText = conditional?.[3] ?? onlyIf?.[1];
    if (marker && antecedentText && consequentText) {
      const antecedent = extractPropositionSeed(antecedentText.replace(/[.]$/, ''), firstId);
      const consequentId = `P${seeds.length + 2}`;
      const consequent = extractPropositionSeed(consequentText.replace(/[.]$/, ''), consequentId);
      for (const seed of [antecedent, consequent]) {
        if (seed.proposition.negation?.present) {
          seed.proposition.negation = { ...seed.proposition.negation, necessary: true, reason: 'Negation is material to the stated conditional relationship.' };
          seed.proposition.protectedContent = [...new Set([...(seed.proposition.protectedContent ?? []), 'conditional_negation'])];
          seed.proposition.fidelityStatus = 'protected';
        }
      }
      consequent.proposition.conditions = [`${antecedent.proposition.id} via ${marker.toLowerCase()}`];
      seeds.push(antecedent, consequent);
      relations.push({ from: antecedent.proposition.id, to: consequent.proposition.id, type: 'condition', marker, confidence: 'deterministic' });
      sentenceRanges.push({ first: antecedent.proposition.id, last: consequent.proposition.id });
    } else if (coordinatedAction?.[1] && coordinatedAction[2] && coordinatedAction[3]
      && hasExplicitClauseActor(coordinatedAction[3])) {
      const premise = extractPropositionSeed(coordinatedAction[1].replace(/[.]$/, ''), firstId);
      const actionId = `P${seeds.length + 2}`;
      const action = extractPropositionSeed(coordinatedAction[3].replace(/[.]$/, ''), actionId);
      seeds.push(premise, action);
      relations.push({ from: premise.proposition.id, to: action.proposition.id, type: 'action', marker: coordinatedAction[2], confidence: 'candidate' });
      sentenceRanges.push({ first: premise.proposition.id, last: action.proposition.id });
    } else {
      const seed = extractPropositionSeed(sentence, firstId);
      seeds.push(seed);
      sentenceRanges.push({ first: seed.proposition.id, last: seed.proposition.id });
    }
  }

  for (let i = 1; i < sentences.length; i++) {
    const previous = sentences[i - 1];
    const current = sentences[i];
    const previousRange = sentenceRanges[i - 1];
    const currentRange = sentenceRanges[i];
    if (previous === undefined || current === undefined || !previousRange || !currentRange) continue;
    relations.push(relationBetween(previous, current, previousRange.last, currentRange.first));
  }

  return {
    document: { source: text, propositions: seeds.map(s => s.proposition) },
    relations,
    requiresSemanticReview: seeds.some(s => s.requiresSemanticReview) || relations.some(r => r.confidence === 'candidate'),
  };
}
