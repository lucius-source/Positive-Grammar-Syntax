import type { PgsProposition } from '../core/types';
import { parseSentence } from './sentence';
import { classifyProtectedDomain } from '../core/domain';

export interface PropositionSeedResult {
  proposition: PgsProposition;
  requiresSemanticReview: boolean;
}

function inferSpeechAct(text: string): PgsProposition['speechAct'] {
  if (/\?\s*$/.test(text)) return 'question';
  // Specific operative speech acts take precedence over generic negative-command detection.
  if (/\b(?:i do not consent|i don't consent)\b/i.test(text)) return 'refusal';
  if (/\b(?:i consent|i agree)\b/i.test(text)) return 'consent';
  if (/\b(?:do not|don't|must not|mustn't)\b/i.test(text)) return 'command';
  if (/\b(?:i promise|i will)\b/i.test(text)) return 'promise';
  if (/\b(?:please|i request|i ask)\b/i.test(text)) return 'request';
  return 'assertion';
}

function inferEpistemic(text: string): PgsProposition['epistemicStatus'] {
  if (/\b(?:i believe|i think|in my view)\b/i.test(text)) return 'believed';
  if (/\b(?:i assume|assuming)\b/i.test(text)) return 'assumed';
  if (/\b(?:maybe|perhaps|possibly|uncertain)\b/i.test(text)) return 'uncertain';
  if (/\b(?:seems?|appears?)\b/i.test(text) || /\bcould\s+fail\b/i.test(text)) return 'uncertain';
  if (/\b(?:i intend|i plan|i will)\b/i.test(text)) return 'intended';
  if (/\b(?:allege|alleged|claims?)\b/i.test(text)) return 'alleged';
  if (/\b(?:going to|will)\s+fail\b/i.test(text)) return 'predicted';
  if (/^\s*I\s+(?:reviewed|found|sent|received|observed|saw|heard)\b/i.test(text)) return 'reported';
  return 'unknown';
}

const ACTIONS: Array<[RegExp, string]> = [
  [/\b(?:review|reviewed)\b/i, 'review'], [/\b(?:find|found)\b/i, 'find'],
  [/\b(?:send|sent)\b/i, 'send'], [/\b(?:ignore|ignored)\b/i, 'ignore'],
  [/\b(?:listen|listened)\b/i, 'listen'], [/\bconsent\b/i, 'consent'],
  [/\benergise(?:d)?\b/i, 'energise'], [/\b(?:take|took)\b/i, 'take'],
  [/\b(?:receive|received)\b/i, 'receive'], [/\bproceed(?:ed)?\b/i, 'proceed'],
  [/\b(?:serve|served)\b/i, 'serve'],
  [/\bfail(?:ed)?\b/i, 'fail'], [/\b(?:make|made)\b/i, 'make'], [/\b(?:commit|committed)\b/i, 'commit'],
  [/\b(?:complete|completed|do|done)\b/i, 'complete'],
];

function inferActor(text: string): string | null | undefined {
  if (/^\s*(?:please\s+)?(?:do\s+not|don't|do|stop|start|arrive|send|confirm|provide|remain|submit|take)\b/i.test(text)) return 'addressee';
  if (/^\s*I(?:\b|['’]m\b)/i.test(text)) return 'speaker';
  if (/^\s*We\b/i.test(text)) return 'speakers';
  if (/^\s*You\b/i.test(text)) return 'addressee';
  const role = text.match(/^\s*(?:the\s+)?(claimant|defendant|supplier|buyer|seller|employer|employee|patient)\b/i)?.[1];
  if (role) return role.toLowerCase();
  if (/^\s*(?:They|He|She|It|This|That)\b/i.test(text)) return null;
  if (/\b(?:was|were|is|are|been|be)\s+(?:\w+(?:ed|en)|made|done|sent|given|taken|known|seen|found|held|built|written|read|said|told|left|lost|paid|put|set)\b/i.test(text)) return null;
  const named = text.match(/^\s*([A-Z][a-z]+)\s+\w+/);
  return named?.[1] && !['The', 'A', 'An', 'For', 'If', 'Unless', 'Please'].includes(named[1]) ? named[1] : undefined;
}

function inferAction(text: string): { action?: string; object?: string } {
  for (const [pattern, action] of ACTIONS) {
    const match = pattern.exec(text);
    if (!match || match.index === undefined) continue;
    const passiveObject = text.match(/^\s*(.+?)\s+(?:was|were|is|are|been|be)\s+/i)?.[1];
    const tail = text.slice(match.index + match[0].length)
      .replace(/^[\s,]+|[.!?]+$/g, '')
      .replace(/\b(?:today|tomorrow|yesterday|soon|later|asap)\b.*$/i, '')
      .trim();
    const object = passiveObject ?? tail;
    return { action, ...(object ? { object } : {}) };
  }
  return {};
}

function inferTime(parsed: ReturnType<typeof parseSentence>, text: string): PgsProposition['time'] {
  const token = parsed.temporalTokens[0];
  if (!token) return undefined;
  const relative = ['soon', 'later', 'asap'].includes(token);
  return /\bby\s+/i.test(text)
    ? { deadline: token, temporalStatus: relative ? 'relative' : 'explicit' }
    : { eventTime: token, temporalStatus: relative ? 'relative' : 'explicit' };
}

export function extractPropositionSeed(text: string, id = 'P1'): PropositionSeedResult {
  const parsed = parseSentence(text);
  const speechAct = inferSpeechAct(text);
  const epistemicStatus = inferEpistemic(text);
  const domain = classifyProtectedDomain(text);
  const hasNegation = parsed.negationTokens.length > 0;
  const operativeNegation = speechAct === 'refusal' || /\b(?:must not|mustn't|do not|don't)\b/i.test(text);
  const protectedNegation = operativeNegation || (hasNegation && (domain === 'legal' || domain === 'medical' || domain === 'safety'));
  const unresolved: string[] = [];
  const actor = inferActor(text);
  const extracted = inferAction(text);
  const time = inferTime(parsed, text);
  const quantities = text.match(/[£$€]?\d+(?:[.,]\d+)*|\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\b/gi) ?? [];

  if (parsed.pronounTokens.some((p: string) => ['they', 'them', 'their', 'it', 'this', 'that'].includes(p))) unresolved.push('reference');
  if (actor === null && !unresolved.includes('reference')) unresolved.push('actor');
  if (/\b(?:deliberately|intentionally|on purpose)\b/i.test(text)) unresolved.push('motive');

  const requiresSemanticReview = unresolved.length > 0 || epistemicStatus === 'unknown';
  const negation: PgsProposition['negation'] = parsed.negationTokens.length
    ? {
        present: true,
        text: parsed.negationTokens.join(', '),
        necessary: protectedNegation,
        ...(protectedNegation ? { reason: domain ? `Material negation in the protected ${domain} domain.` : 'Potentially operative refusal, prohibition, or protected negative construction.' } : {}),
      }
    : undefined;

  const proposition: PgsProposition = {
    id,
    sourceSpan: text,
    ...(actor !== undefined ? { actor } : {}),
    ...(extracted.action ? { actionOrRelation: extracted.action } : {}),
    ...(extracted.object ? { objectOrTarget: extracted.object } : {}),
    ...(epistemicStatus === 'reported' ? { observation: text } : {}),
    ...(epistemicStatus === 'intended' ? { intention: text } : {}),
    ...(speechAct === 'request' || speechAct === 'command' ? { requestedAction: text } : {}),
    ...(time ? { time } : {}),
    ...(quantities.length ? { quantities } : {}),
    ...(/^\s*(?:if|unless)\b/i.test(text) ? { conditions: [text] } : {}),
    polarity: parsed.polarity,
    ...(negation ? { negation } : {}),
    epistemicStatus,
    speechAct,
    ...(domain ? { domain } : {}),
    modality: parsed.modalTokens.length ? 'possibility' : 'none',
    ambiguity: unresolved.length ? { present: true, unresolvedFields: unresolved } : { present: false },
    protectedContent: protectedNegation ? [operativeNegation ? 'operative_negation' : 'high_risk_negation'] : [],
    fidelityStatus: protectedNegation ? 'protected' : requiresSemanticReview ? 'review_required' : 'conditional',
    unresolved,
  };

  return { proposition, requiresSemanticReview };
}
