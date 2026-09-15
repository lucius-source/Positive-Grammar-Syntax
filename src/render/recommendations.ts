import type { SemanticContext } from '../semantic/types';
import type { PgsProposition } from '../core/types';

export interface Recommendation {
  level: 'PGS-L1' | 'PGS-L2';
  text?: string;
  withheldReason?: string;
  ruleIds: string[];
  supportingFields: string[];
}

function asSentence(text: string): string {
  const clean = text.trim();
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

function naturalL1(source: string, hasMotive: boolean, propositions: PgsProposition[]): { text: string; ruleIds: string[]; supportingFields: string[] } {
  const clean = source.trim();
  const proposition = propositions[0];
  if (proposition?.actor === null && ['make', 'commit'].includes(proposition.actionOrRelation ?? '') && /\b(?:mistakes|errors)\b/i.test(clean)) {
    return { text: 'The actor responsible for the errors is not identified.', ruleIds: ['PGS-001'], supportingFields: ['P1.actor=null', 'P1.actionOrRelation', 'P1.objectOrTarget'] };
  }
  if (proposition?.actor === 'addressee' && proposition.actionOrRelation === 'listen' && /\bnever\b/i.test(clean)) {
    return { text: 'I believe my points are not being fully heard.', ruleIds: ['PGS-002', 'PGS-005'], supportingFields: ['P1.actor', 'P1.actionOrRelation', 'P1.negation'] };
  }
  if (proposition?.actor === 'speaker' && proposition.actionOrRelation === 'complete' && proposition.negation?.present && /\byet\b/i.test(clean)) {
    return { text: 'I do not currently have the capability to complete this.', ruleIds: ['PGS-003', 'PGS-005'], supportingFields: ['P1.actor', 'P1.actionOrRelation', 'P1.negation', 'P1.objectOrTarget'] };
  }
  if (proposition?.actionOrRelation === 'fail' && ['predicted', 'uncertain'].includes(proposition.epistemicStatus)) {
    return { text: 'I assess a risk of failure.', ruleIds: ['PGS-005'], supportingFields: ['P1.actionOrRelation', 'P1.epistemicStatus'] };
  }
  if (/^I (?:do not|don't) consent to this\.?$/i.test(clean)) {
    return { text: 'I do not consent to this.', ruleIds: ['PGS-007'], supportingFields: ['P1.actor', 'P1.actionOrRelation', 'P1.negation', 'P1.speechAct'] };
  }
  const uncertainty = clean.match(/^Maybe\s+(.+?)[.]?$/i);
  if (uncertainty?.[1]) {
    return { text: `I am uncertain whether ${uncertainty[1].replace(/[.]$/, '')}.`, ruleIds: ['PGS-005'], supportingFields: ['P1.epistemicStatus', 'P1.sourceSpan'] };
  }
  const assumption = clean.match(/^Obviously\s+(.+?)[.]?$/i);
  if (assumption?.[1]) {
    return { text: `I assume ${assumption[1].replace(/[.]$/, '')}.`, ruleIds: ['PGS-002', 'PGS-005'], supportingFields: ['P1.epistemicStatus', 'P1.sourceSpan'] };
  }
  if (hasMotive) {
    return { text: `I believe ${clean.charAt(0).toLowerCase()}${clean.slice(1)}`, ruleIds: ['PGS-002', 'PGS-005'], supportingFields: ['P1.ambiguity.motive', 'P1.sourceSpan'] };
  }
  return { text: clean, ruleIds: [], supportingFields: ['P1.sourceSpan'] };
}

export function renderRecommendations(source: string, unresolved: string[], context?: SemanticContext, propositions: PgsProposition[] = []): Recommendation[] {
  const hasMotive = unresolved.some(item => /motive/i.test(item));
  const hasReference = unresolved.some(item => /reference/i.test(item));
  const rendered = naturalL1(source, hasMotive, propositions);
  const verifiedFacts = (context?.knownFacts ?? []).map(asSentence);
  const l1Text = [...verifiedFacts, rendered.text].join(' ');
  const contextFields = verifiedFacts.map((_, index) => `context.knownFacts[${index}]`);
  const l1: Recommendation = { level: 'PGS-L1', text: l1Text, ruleIds: rendered.ruleIds, supportingFields: [...contextFields, ...rendered.supportingFields] };
  const l2: Recommendation = context?.userIntent?.trim()
    ? { level: 'PGS-L2', text: `${l1Text} ${asSentence(context.userIntent)}`, ruleIds: [...new Set([...rendered.ruleIds, 'PGS-006'])], supportingFields: [...contextFields, ...rendered.supportingFields, 'context.userIntent'] }
    : hasMotive || hasReference
      ? { level: 'PGS-L2', withheldReason: 'A more directive rewrite could change unresolved actor, motive, evidence, or requested action.', ruleIds: [], supportingFields: [] }
      : { level: 'PGS-L2', text: l1Text, ruleIds: rendered.ruleIds, supportingFields: [...contextFields, ...rendered.supportingFields] };
  return [l1, l2];
}
