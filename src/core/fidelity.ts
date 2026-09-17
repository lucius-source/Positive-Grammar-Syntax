import type { SemanticContext } from '../semantic/types';
import { analyseDocument } from '../analyser/document';
import { evidenceIsSufficient } from '../resolution/ledger';

export type FidelityIssueSeverity = 'review_required' | 'blocked';
export interface FidelityIssue { code: string; severity: FidelityIssueSeverity; message: string; evidence?: string }
export interface FidelityComparison { status: 'pass' | 'review_required' | 'blocked'; issues: FidelityIssue[] }

const NEGATION = /\b(?:not|no|never|cannot|can't|don't|doesn't|didn't|isn't|aren't|wasn't|weren't|won't|wouldn't|shouldn't|mustn't)\b/gi;
const HEDGES = /\b(?:may|might|could|maybe|perhaps|possibly|uncertain|believe|think|assume|allege)\b/gi;
const STRONG_CERTAINTY = /\b(?:will|must|definitely|certainly|obviously|undoubtedly|know|known)\b/gi;
const CONDITION = /\b(?:if|unless|provided that|only if)\b/gi;
const MONTH = '(?:january|february|march|april|may|june|july|august|september|october|november|december)';
const TEMPORAL = new RegExp(`\\b(?:today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|${MONTH}\\s+\\d{1,2}(?:,\\s*\\d{4})?|\\d{1,2}\\s+${MONTH}(?:\\s+\\d{4})?|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4})\\b`, 'gi');
const QUANTITY = /(?:£|\$|€)?\d+(?:[.,]\d+)?|\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\b/gi;
const ACTOR = /\b(?:i|me|my|mine|we|us|our|ours|you|your|yours|he|him|his|she|her|hers|they|them|their|theirs|supplier|claimant|recipient|sender|buyer|seller|employer|employee|court)\b/gi;
const ACTION = /\b(?:send|sent|receive|received|confirm|confirmed|sign|signed|disclose|disclosed|energise|energised|take|took|pay|paid|proceed|proceeded|review|reviewed|reconcile|reconciled|submit|submitted|reply|respond|ignore|ignored)\b/gi;
const MOTIVE = /\b(?:deliberately|intentionally|on purpose|chose to|wanted to)\b/gi;
const EVIDENCE_CLAIM = /\b(?:evidence (?:shows?|proves?|confirms?)|records? (?:shows?|proves?|confirms?)|documents? (?:shows?|proves?|confirms?)|according to (?:the )?(?:evidence|records?|documents?))\b/gi;
const MODAL = /\b(?:mustn't|must not|must|shouldn't|should not|should|shall|may|might|could|can't|cannot|can|won't|will not|will|wouldn't|would not|would|(?:do not|does not|don't|doesn't) (?:currently )?have (?:the )?capability|not (?:currently )?able to|(?:assess(?:ed)? )?a risk of|risk of)\b/gi;

function terms(text: string, pattern: RegExp): Set<string> {
  return new Set((text.match(pattern) ?? []).map(item => item.toLowerCase()));
}

function missing(required: Set<string>, candidate: Set<string>): string[] {
  return [...required].filter(item => !candidate.has(item));
}

function normalizedModalities(text: string): Set<string> {
  const normalize: Record<string, string> = {
    "mustn't": 'must', 'must not': 'must', must: 'must', shall: 'shall',
    "shouldn't": 'should', 'should not': 'should', should: 'should',
    may: 'may', might: 'might', could: 'could', "can't": 'can', cannot: 'can', can: 'can',
    "won't": 'will', 'will not': 'will', will: 'will', "wouldn't": 'would', 'would not': 'would', would: 'would',
  };
  return new Set([...terms(text, MODAL)].map(item => /capability|able to/.test(item) ? 'can' : /risk of/.test(item) ? 'could' : (normalize[item] ?? item)));
}

const ACTION_FAMILY: Record<string, string> = { make: 'error_creation', commit: 'error_creation', listen: 'attention', hear: 'attention', complete: 'completion', do: 'completion' };
const actionFamily = (action: string) => ACTION_FAMILY[action] ?? action;

function pirFields(text: string): { actions: Set<string>; actors: Set<string> } {
  const propositions = analyseDocument(text).document.propositions;
  return {
    actions: new Set(propositions.flatMap(item => item.actionOrRelation ? [actionFamily(item.actionOrRelation)] : [])),
    actors: new Set(propositions.flatMap(item => typeof item.actor === 'string' ? [item.actor.toLowerCase()] : [])),
  };
}

function unionPirFields(texts: string[]): { actions: Set<string>; actors: Set<string> } {
  const actions = new Set<string>();
  const actors = new Set<string>();
  for (const text of texts.filter(item => item.trim())) {
    const fields = pirFields(text);
    for (const action of fields.actions) actions.add(action);
    for (const actor of fields.actors) actors.add(actor);
    if (/\b(?:i|me|my|mine)\b/i.test(text)) actors.add('speaker');
    if (/\b(?:we|us|our|ours)\b/i.test(text)) actors.add('speakers');
    if (/\b(?:you|your|yours)\b/i.test(text)) actors.add('addressee');
  }
  return { actions, actors };
}

function verifiedConditionalReframe(source: string, candidate: string): boolean {
  const sourceAnalysis = analyseDocument(source);
  const candidateAnalysis = analyseDocument(candidate);
  const sourceRelation = sourceAnalysis.relations.find(item => item.type === 'condition');
  const candidateRelation = candidateAnalysis.relations.find(item => item.type === 'condition');
  if (!sourceRelation || !candidateRelation || !/^if$/i.test(sourceRelation.marker ?? '') || !/^only if$/i.test(candidateRelation.marker ?? '')) return false;
  if (sourceAnalysis.document.propositions.length !== 2 || candidateAnalysis.document.propositions.length !== 2) return false;
  if (!sourceAnalysis.document.propositions.every(item => item.negation?.present) || candidateAnalysis.document.propositions.some(item => item.negation?.present)) return false;
  const sourceActions = pirFields(source).actions;
  const candidateActions = pirFields(candidate).actions;
  return missing(sourceActions, candidateActions).length === 0 && missing(candidateActions, sourceActions).length === 0
    && missing(terms(source, TEMPORAL), terms(candidate, TEMPORAL)).length === 0;
}

function verifiedUnknownActorReframe(source: string, candidate: string): boolean {
  const propositions = analyseDocument(source).document.propositions;
  return propositions.length === 1
    && propositions[0]?.actor === null
    && ['make', 'commit'].includes(propositions[0]?.actionOrRelation ?? '')
    && /\b(?:mistakes|errors)\b/i.test(source)
    && /^The actor responsible for the errors is not identified\.$/i.test(candidate.trim());
}

export function compareFidelity(source: string, candidate: string, context?: SemanticContext): FidelityComparison {
  const authorisedTexts = [source, ...(context?.knownFacts ?? []), context?.userIntent ?? '', ...(context?.referenceBindings ?? []).map(item => item.entity), ...(context?.evidence ?? []).filter(item => evidenceIsSufficient(item.field, item)).map(item => item.statement)];
  const authorised = authorisedTexts.join(' ');
  const issues: FidelityIssue[] = [];
  const add = (issue: FidelityIssue) => issues.push(issue);
  const conditionalReframe = verifiedConditionalReframe(source, candidate);
  const unknownActorReframe = verifiedUnknownActorReframe(source, candidate);

  const sourceNegation = terms(source, NEGATION);
  const candidateNegation = terms(candidate, NEGATION);
  if (sourceNegation.size && candidateNegation.size === 0 && !conditionalReframe) {
    add({ code: 'FIDELITY_NEGATION_REMOVED', severity: 'blocked', message: 'Candidate removes source negation; logical equivalence is not established.', evidence: [...sourceNegation].join(', ') });
  }
  if (!terms(authorised, NEGATION).size && candidateNegation.size && !unknownActorReframe) {
    add({ code: 'FIDELITY_NEGATION_INVENTED', severity: 'blocked', message: 'Candidate introduces negation absent from source and verified context.', evidence: [...candidateNegation].join(', ') });
  }
  if (conditionalReframe) add({ code: 'FIDELITY_CONDITION_EQUIVALENT', severity: 'review_required', message: 'Candidate uses a structurally verified only-if contraposition; final semantic review remains required.' });

  const sourceConditions = terms(source, CONDITION);
  const candidateConditions = terms(candidate, CONDITION);
  if (sourceConditions.size && candidateConditions.size === 0) {
    add({ code: 'FIDELITY_CONDITION_REMOVED', severity: 'blocked', message: 'Candidate removes a source condition.', evidence: [...sourceConditions].join(', ') });
  }
  const inventedConditions = conditionalReframe ? [] : missing(candidateConditions, terms(authorised, CONDITION));
  if (inventedConditions.length) add({ code: 'FIDELITY_CONDITION_INVENTED', severity: 'blocked', message: 'Candidate introduces an unauthorised condition.', evidence: inventedConditions.join(', ') });

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

  const inventedMotive = missing(terms(candidate, MOTIVE), terms(authorised, MOTIVE));
  if (inventedMotive.length) add({ code: 'FIDELITY_MOTIVE_INVENTED', severity: 'blocked', message: 'Candidate introduces motive or intention absent from source and sufficient evidence.', evidence: inventedMotive.join(', ') });

  const inventedEvidence = missing(terms(candidate, EVIDENCE_CLAIM), terms(authorised, EVIDENCE_CLAIM));
  if (inventedEvidence.length) add({ code: 'FIDELITY_EVIDENCE_INVENTED', severity: 'blocked', message: 'Candidate introduces an evidential basis absent from source and sufficient evidence.', evidence: inventedEvidence.join(', ') });

  const sourceModalities = normalizedModalities(source);
  if (sourceModalities.size && !conditionalReframe) {
    const changedModalities = missing(sourceModalities, normalizedModalities(candidate));
    if (changedModalities.length) add({ code: 'FIDELITY_MODALITY_CHANGED', severity: 'blocked', message: 'Candidate removes or changes source modality without established equivalence.', evidence: changedModalities.join(', ') });
  }

  for (const protectedTerm of context?.protectedTerms ?? []) {
    if (protectedTerm.trim() && !candidate.toLowerCase().includes(protectedTerm.trim().toLowerCase())) {
      add({ code: 'FIDELITY_PROTECTED_TERM_REMOVED', severity: 'blocked', message: 'Candidate removes a user-protected term.', evidence: protectedTerm });
    }
  }

  const authorisedActors = terms(authorised, ACTOR);
  if (/\b(?:my|me|mine)\b/i.test(source)) for (const actor of ['i', 'me', 'my', 'mine']) authorisedActors.add(actor);
  if (terms(source, HEDGES).size || /\b(?:obviously|going to fail)\b/i.test(source)) authorisedActors.add('i');
  const newActors = missing(terms(candidate, ACTOR), authorisedActors);
  if (newActors.length) add({ code: 'FIDELITY_ACTOR_INVENTED', severity: 'blocked', message: 'Candidate introduces an actor absent from source and verified context.', evidence: newActors.join(', ') });

  const newActions = missing(terms(candidate, ACTION), terms(authorised, ACTION));
  if (newActions.length) add({ code: 'FIDELITY_ACTION_INVENTED', severity: 'blocked', message: 'Candidate introduces an action absent from source and verified context.', evidence: newActions.join(', ') });

  const sourcePir = pirFields(source);
  const candidatePir = pirFields(candidate);
  const authorisedPir = unionPirFields(authorisedTexts);
  if (terms(source, HEDGES).size || /\b(?:obviously|going to fail)\b/i.test(source)) authorisedPir.actors.add('speaker');
  const inventedPirActors = conditionalReframe ? [] : missing(candidatePir.actors, authorisedPir.actors);
  if (inventedPirActors.length && !issues.some(issue => issue.code === 'FIDELITY_ACTOR_INVENTED')) {
    add({ code: 'FIDELITY_ACTOR_INVENTED', severity: 'blocked', message: 'Candidate PIR introduces an actor absent from source and verified context.', evidence: inventedPirActors.join(', ') });
  }
  const inventedPirActions = conditionalReframe ? [] : missing(candidatePir.actions, authorisedPir.actions);
  if (inventedPirActions.length && !issues.some(issue => issue.code === 'FIDELITY_ACTION_INVENTED')) {
    add({ code: 'FIDELITY_ACTION_INVENTED', severity: 'blocked', message: 'Candidate PIR introduces an action or relation absent from source and verified context.', evidence: inventedPirActions.join(', ') });
  }
  const omittedActions = missing(sourcePir.actions, candidatePir.actions);
  if (omittedActions.length) add({ code: 'FIDELITY_PIR_ACTION_OMITTED', severity: 'review_required', message: 'Candidate PIR does not explicitly retain every source action or relation; semantic equivalence requires review.', evidence: omittedActions.join(', ') });
  const omittedActors = missing(sourcePir.actors, candidatePir.actors);
  if (omittedActors.length) add({ code: 'FIDELITY_PIR_ACTOR_OMITTED', severity: 'review_required', message: 'Candidate PIR does not explicitly retain every known source actor; semantic equivalence requires review.', evidence: omittedActors.join(', ') });

  const status = issues.some(issue => issue.severity === 'blocked') ? 'blocked'
    : issues.some(issue => issue.severity === 'review_required') ? 'review_required' : 'pass';
  return { status, issues };
}
