import type { SemanticContext } from '../semantic/types';

export interface Recommendation {
  level: 'PGS-L1' | 'PGS-L2';
  text?: string;
  withheldReason?: string;
  ruleIds: string[];
}

function asSentence(text: string): string {
  const clean = text.trim();
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

function naturalL1(source: string, hasMotive: boolean): { text: string; ruleIds: string[] } {
  const clean = source.trim();
  if (/^Mistakes were made\.?$/i.test(clean)) {
    return { text: 'The actor responsible for the errors is not identified.', ruleIds: ['PGS-001'] };
  }
  if (/^You never listen to me\.?$/i.test(clean)) {
    return { text: 'I believe my points are not being fully heard.', ruleIds: ['PGS-002', 'PGS-005'] };
  }
  if (/^I (?:cannot|can't) do this yet\.?$/i.test(clean)) {
    return { text: 'I do not currently have the capability to complete this.', ruleIds: ['PGS-003', 'PGS-005'] };
  }
  if (/^This is going to fail\.?$/i.test(clean)) {
    return { text: 'I assess a risk of failure.', ruleIds: ['PGS-005'] };
  }
  if (/^I (?:do not|don't) consent to this\.?$/i.test(clean)) {
    return { text: 'I do not consent to this.', ruleIds: ['PGS-007'] };
  }
  const uncertainty = clean.match(/^Maybe\s+(.+?)[.]?$/i);
  if (uncertainty?.[1]) {
    return { text: `I am uncertain whether ${uncertainty[1].replace(/[.]$/, '')}.`, ruleIds: ['PGS-005'] };
  }
  const assumption = clean.match(/^Obviously\s+(.+?)[.]?$/i);
  if (assumption?.[1]) {
    return { text: `I assume ${assumption[1].replace(/[.]$/, '')}.`, ruleIds: ['PGS-002', 'PGS-005'] };
  }
  if (hasMotive) {
    return { text: `I believe ${clean.charAt(0).toLowerCase()}${clean.slice(1)}`, ruleIds: ['PGS-002', 'PGS-005'] };
  }
  return { text: clean, ruleIds: [] };
}

export function renderRecommendations(source: string, unresolved: string[], context?: SemanticContext): Recommendation[] {
  const hasMotive = unresolved.some(item => /motive/i.test(item));
  const hasReference = unresolved.some(item => /reference/i.test(item));
  const rendered = naturalL1(source, hasMotive);
  const verifiedFacts = (context?.knownFacts ?? []).map(asSentence);
  const l1Text = [...verifiedFacts, rendered.text].join(' ');
  const l1: Recommendation = { level: 'PGS-L1', text: l1Text, ruleIds: rendered.ruleIds };
  const l2: Recommendation = context?.userIntent?.trim()
    ? { level: 'PGS-L2', text: `${l1Text} ${asSentence(context.userIntent)}`, ruleIds: [...new Set([...rendered.ruleIds, 'PGS-006'])] }
    : hasMotive || hasReference
      ? { level: 'PGS-L2', withheldReason: 'A more directive rewrite could change unresolved actor, motive, evidence, or requested action.', ruleIds: [] }
      : { level: 'PGS-L2', text: l1Text, ruleIds: rendered.ruleIds };
  return [l1, l2];
}
