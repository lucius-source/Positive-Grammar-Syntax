import type { SemanticContext } from '../semantic/types';

export type FidelityIssueSeverity = 'review_required' | 'blocked';
export interface FidelityIssue { code: string; severity: FidelityIssueSeverity; message: string; evidence?: string }
export interface FidelityComparison { status: 'pass' | 'review_required' | 'blocked'; issues: FidelityIssue[] }

const NEGATION = /\b(?:not|no|never|cannot|can't|don't|doesn't|didn't|isn't|aren't|wasn't|weren't|won't|wouldn't|shouldn't|mustn't)\b/gi;
const HEDGES = /\b(?:may|might|could|maybe|perhaps|possibly|uncertain|believe|think|assume|allege)\b/gi;
const STRONG_CERTAINTY = /\b(?:will|must|definitely|certainly|obviously|undoubtedly|know|known)\b/gi;
const CONDITION = /\b(?:if|unless|provided that|only if)\b/gi;
const TEMPORAL = /\b(?:today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;
const QUANTITY = /(?:£|\$|€)?\d+(?:[.,]\d+)?|\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\b/gi;
const ACTOR = /\b(?:i|me|my|mine|we|us|our|ours|you|your|yours|he|him|his|she|her|hers|they|them|their|theirs|supplier|claimant|recipient|sender|buyer|seller|employer|employee|court)\b/gi;
const ACTION = /\b(?:send|sent|receive|received|confirm|confirmed|sign|signed|disclose|disclosed|energise|energised|take|took|pay|paid|proceed|proceeded|review|reviewed|reconcile|reconciled|submit|submitted|reply|respond|ignore|ignored)\b/gi;

function terms(text: string, pattern: RegExp): Set<string> {
  return new Set((text.match(pattern) ?? []).map(item => item.toLowerCase()));
}

function missing(required: Set<string>, candidate: Set<string>): string[] {
  return [...required].filter(item => !candidate.has(item));
}

export function compareFidelity(source: string, candidate: string, context?: SemanticContext): FidelityComparison {
  const authorised = [source, ...(context?.knownFacts ?? []), context?.userIntent ?? ''].join(' ');
  const issues: FidelityIssue[] = [];
  const add = (issue: FidelityIssue) => issues.push(issue);

  const sourceNegation = terms(source, NEGATION);
  if (sourceNegation.size && terms(candidate, NEGATION).size === 0) {
    add({ code: 'FIDELITY_NEGATION_REMOVED', severity: 'blocked', message: 'Candidate removes source negation; logical equivalence is not established.', evidence: [...sourceNegation].join(', ') });
  }

  const sourceConditions = terms(source, CONDITION);
  if (sourceConditions.size && terms(candidate, CONDITION).size === 0) {
    add({ code: 'FIDELITY_CONDITION_REMOVED', severity: 'blocked', message: 'Candidate removes a source condition.', evidence: [...sourceConditions].join(', ') });
  }

  for (const [pattern, code, label] of [[QUANTITY, 'FIDELITY_QUANTITY_REMOVED', 'quantity'], [TEMPORAL, 'FIDELITY_TIME_REMOVED', 'time']] as const) {
    const absent = missing(terms(source, pattern), terms(candidate, pattern));
    if (absent.length) add({ code, severity: 'blocked', message: `Candidate removes or changes source ${label} content.`, evidence: absent.join(', ') });
    const additions = missing(terms(candidate, pattern), terms(authorised, pattern));
    if (additions.length) add({ code: code.replace('REMOVED', 'INVENTED'), severity: 'blocked', message: `Candidate introduces unauthorised ${label} content.`, evidence: additions.join(', ') });
  }

  const sourceHedges = terms(source, HEDGES);
  if (sourceHedges.size && terms(candidate, HEDGES).size === 0 && terms(candidate, STRONG_CERTAINTY).size > 0) {
    add({ code: 'FIDELITY_CERTAINTY_UPGRADED', severity: 'blocked', message: 'Candidate upgrades hedged language to stronger certainty.' });
  }

  const authorisedActors = terms(authorised, ACTOR);
  if (/\b(?:my|me|mine)\b/i.test(source)) authorisedActors.add('i');
  if (terms(source, HEDGES).size || /\bobviously\b/i.test(source)) authorisedActors.add('i');
  const newActors = missing(terms(candidate, ACTOR), authorisedActors);
  if (newActors.length) add({ code: 'FIDELITY_ACTOR_INVENTED', severity: 'blocked', message: 'Candidate introduces an actor absent from source and verified context.', evidence: newActors.join(', ') });

  const newActions = missing(terms(candidate, ACTION), terms(authorised, ACTION));
  if (newActions.length) add({ code: 'FIDELITY_ACTION_INVENTED', severity: 'blocked', message: 'Candidate introduces an action absent from source and verified context.', evidence: newActions.join(', ') });

  const status = issues.some(issue => issue.severity === 'blocked') ? 'blocked'
    : issues.some(issue => issue.severity === 'review_required') ? 'review_required' : 'pass';
  return { status, issues };
}
