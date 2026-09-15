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
  const seeds = sentences.map((sentence, index) => extractPropositionSeed(sentence, `P${index + 1}`));
  const relations: PropositionRelation[] = [];

  for (let i = 1; i < sentences.length; i++) {
    const previous = sentences[i - 1];
    const current = sentences[i];
    if (previous === undefined || current === undefined) continue;
    relations.push(relationBetween(previous, current, `P${i}`, `P${i + 1}`));
  }

  return {
    document: { source: text, propositions: seeds.map(s => s.proposition) },
    relations,
    requiresSemanticReview: seeds.some(s => s.requiresSemanticReview) || relations.some(r => r.confidence === 'candidate'),
  };
}
