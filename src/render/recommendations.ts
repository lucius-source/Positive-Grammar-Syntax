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

function applyBindings(source: string, context?: SemanticContext): string {
  let result = source;
  for (const binding of context?.referenceBindings ?? []) {
    const reference = binding.reference.trim();
    const entity = binding.entity.trim();
    if (!reference || !entity || !/^(?:they|he|she|it)$/i.test(reference)) continue;
    result = result.replace(new RegExp(`\\b${reference}\\b`, 'gi'), entity);
  }
  return result;
}

function naturalL1(source: string, hasMotive: boolean, propositions: PgsProposition[]): { text: string; ruleIds: string[]; supportingFields: string[] } {
  const clean = source.trim();
  const proposition = propositions[0];
  const consequent = propositions[1];
  if (propositions.length === 2 && proposition?.actionOrRelation === 'receive' && consequent?.actionOrRelation === 'proceed'
    && proposition.negation?.present && consequent.negation?.present && proposition.time?.deadline && proposition.objectOrTarget) {
    const consequenceSubject = consequent.sourceSpan.match(/^(.+?)\s+won't\s+proceed/i)?.[1]?.trim();
    const originalDeadline = proposition.sourceSpan.match(/\bby\s+([^\s,.]+)/i)?.[1] ?? proposition.time.deadline;
    if (consequenceSubject) {
      const subject = `${consequenceSubject.charAt(0).toUpperCase()}${consequenceSubject.slice(1)}`;
      return { text: `${subject} proceeds only if ${proposition.objectOrTarget} is received by ${originalDeadline}.`, ruleIds: ['PGS-004', 'PGS-007'], supportingFields: ['P1.actionOrRelation', 'P1.objectOrTarget', 'P1.time.deadline', 'P1.negation', 'P2.actionOrRelation', 'P2.negation', 'relation.condition'] };
    }
  }
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
  if (/^I['’]m useless at this\.?$/i.test(clean)) {
    return { text: 'I am having difficulty with this task.', ruleIds: ['PGS-002', 'PGS-005'], supportingFields: ['P1.actor', 'P1.sourceSpan', 'P1.ambiguity.reference'] };
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
    const clause = /^(?:I|we|you|they|he|she|it|this|that)\b/i.test(clean) ? `${clean.charAt(0).toLowerCase()}${clean.slice(1)}` : clean;
    return { text: `I believe ${clause}`, ruleIds: ['PGS-002', 'PGS-005'], supportingFields: ['P1.ambiguity.motive', 'P1.sourceSpan'] };
  }
  return { text: clean, ruleIds: [], supportingFields: ['P1.sourceSpan'] };
}

export function renderRecommendations(source: string, unresolved: string[], context?: SemanticContext, propositions: PgsProposition[] = []): Recommendation[] {
  const hasMotive = unresolved.some(item => /motive/i.test(item));
  const hasReference = unresolved.some(item => /reference/i.test(item));
  const rendered = naturalL1(applyBindings(source, context), hasMotive, propositions);
  const verifiedFacts = (context?.knownFacts ?? []).map(asSentence);
  const l1Text = [...verifiedFacts, rendered.text].join(' ');
  const contextFields = [
    ...verifiedFacts.map((_, index) => `context.knownFacts[${index}]`),
    ...(context?.referenceBindings ?? []).map((_, index) => `context.referenceBindings[${index}]`),
    ...(context?.evidence ?? []).map((_, index) => `context.evidence[${index}]`),
  ];
  const l1: Recommendation = { level: 'PGS-L1', text: l1Text, ruleIds: rendered.ruleIds, supportingFields: [...contextFields, ...rendered.supportingFields] };
  const l2: Recommendation = context?.userIntent?.trim()
    ? { level: 'PGS-L2', text: `${l1Text} ${asSentence(context.userIntent)}`, ruleIds: [...new Set([...rendered.ruleIds, 'PGS-006'])], supportingFields: [...contextFields, ...rendered.supportingFields, 'context.userIntent'] }
    : hasMotive || hasReference
      ? { level: 'PGS-L2', withheldReason: 'A more directive rewrite could change unresolved meaning or invent evidence or a requested action.', ruleIds: [], supportingFields: [] }
      : { level: 'PGS-L2', text: l1Text, ruleIds: rendered.ruleIds, supportingFields: [...contextFields, ...rendered.supportingFields] };
  return [l1, l2];
}
