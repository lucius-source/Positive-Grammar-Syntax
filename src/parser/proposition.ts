import type { PgsProposition } from '../core/types';
import { parseSentence } from './sentence';

export interface PropositionSeedResult {
  proposition: PgsProposition;
  requiresSemanticReview: boolean;
}

function inferSpeechAct(text: string): PgsProposition['speechAct'] {
  if (/\?\s*$/.test(text)) return 'question';
  if (/\b(?:do not|don't|must not|mustn't)\b/i.test(text)) return 'command';
  if (/\b(?:i do not consent|i don't consent)\b/i.test(text)) return 'refusal';
  if (/\b(?:i consent|i agree)\b/i.test(text)) return 'consent';
  if (/\b(?:i promise|i will)\b/i.test(text)) return 'promise';
  if (/\b(?:please|i request|i ask)\b/i.test(text)) return 'request';
  return 'assertion';
}

function inferEpistemic(text: string): PgsProposition['epistemicStatus'] {
  if (/\b(?:i believe|i think|in my view)\b/i.test(text)) return 'believed';
  if (/\b(?:i assume|assuming)\b/i.test(text)) return 'assumed';
  if (/\b(?:maybe|perhaps|possibly|uncertain)\b/i.test(text)) return 'uncertain';
  if (/\b(?:i intend|i plan|i will)\b/i.test(text)) return 'intended';
  if (/\b(?:allege|alleged|claims?)\b/i.test(text)) return 'alleged';
  return 'unknown';
}

export function extractPropositionSeed(text: string, id = 'P1'): PropositionSeedResult {
  const parsed = parseSentence(text);
  const speechAct = inferSpeechAct(text);
  const epistemicStatus = inferEpistemic(text);
  const operativeNegation = speechAct === 'refusal' || /\b(?:must not|mustn't|do not|don't)\b/i.test(text);
  const unresolved: string[] = [];

  // Surface parsing deliberately does not guess actor identity from ambiguous pronouns,
  // motives, evidential basis, desired state, or logical equivalence.
  if (parsed.pronounTokens.some(p => ['they', 'them', 'their', 'it', 'this', 'that'].includes(p))) unresolved.push('reference');
  if (/\b(?:deliberately|intentionally|on purpose)\b/i.test(text)) unresolved.push('motive');

  const requiresSemanticReview = unresolved.length > 0 || epistemicStatus === 'unknown';
  const proposition: PgsProposition = {
    id,
    sourceSpan: text,
    polarity: parsed.polarity,
    negation: parsed.negationTokens.length ? {
      present: true,
      text: parsed.negationTokens.join(', '),
      necessary: operativeNegation,
      reason: operativeNegation ? 'Potentially operative refusal, prohibition, or protected negative construction.' : undefined,
    } : undefined,
    epistemicStatus,
    speechAct,
    modality: parsed.modalTokens.length ? 'possibility' : 'none',
    ambiguity: unresolved.length ? { present: true, unresolvedFields: unresolved } : { present: false },
    protectedContent: operativeNegation ? ['operative_negation'] : [],
    fidelityStatus: operativeNegation ? 'protected' : requiresSemanticReview ? 'review_required' : 'conditional',
    unresolved,
  };

  return { proposition, requiresSemanticReview };
}
