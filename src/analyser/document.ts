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

function relationBetween(previous: string, current: string, from: string, to: string): PropositionRelation {
  if (/^(?:if|unless|provided that)\b/i.test(current)) return { from, to, type: 'condition', marker: current.match(/^\S+/)?.[0], confidence: 'deterministic' };
  if (/^(?:because|therefore|thus|consequently)\b/i.test(current)) return { from, to, type: 'cause', marker: current.match(/^\S+/)?.[0], confidence: 'candidate' };
  if (/^(?:but|however|although|yet)\b/i.test(current)) return { from, to, type: 'contrast', marker: current.match(/^\S+/)?.[0], confidence: 'deterministic' };
  if (/^(?:so|accordingly)\b/i.test(current)) return { from, to, type: 'action', marker: current.match(/^\S+/)?.[0], confidence: 'candidate' };
  if (/\b(?:today|tomorrow|yesterday|then|after|before|next)\b/i.test(previous + ' ' + current)) return { from, to, type: 'temporal_sequence', confidence: 'candidate' };
  return { from, to, type: 'continuation', confidence: 'candidate' };
}

export function analyseDocument(text: string): DocumentAnalysis {
  const sentences = splitSentences(text);
  const seeds = sentences.map((sentence, index) => extractPropositionSeed(sentence, `P${index + 1}`));
  const relations: PropositionRelation[] = [];

  for (let i = 1; i < sentences.length; i++) {
    relations.push(relationBetween(sentences[i - 1], sentences[i], `P${i}`, `P${i + 1}`));
  }

  return {
    document: { source: text, propositions: seeds.map(s => s.proposition) },
    relations,
    requiresSemanticReview: seeds.some(s => s.requiresSemanticReview) || relations.some(r => r.confidence === 'candidate'),
  };
}
