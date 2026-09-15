import { analyseDocument, type DocumentAnalysis } from './analyser/document';
import { detectDeterministicRules, type RuleFinding } from './core/rules';
import { validatePgsDocument, type ValidationResult } from './core';
import type { SemanticDetermination, SemanticEngine, SemanticResponse } from './semantic/types';

export interface Recommendation { level: 'PGS-L1' | 'PGS-L2'; text?: string; withheldReason?: string }
export interface FidelityFinding { status: 'pass' | 'review_required' | 'blocked'; message: string }
export interface PipelineResult {
  source: string;
  deterministic: DocumentAnalysis;
  ruleFindings: RuleFinding[];
  semantic?: SemanticResponse;
  semanticError?: string;
  validation: ValidationResult;
  unresolved: string[];
  recommendations: Recommendation[];
  fidelity: FidelityFinding[];
}

function unique(items: string[]): string[] { return [...new Set(items.filter(Boolean))]; }

function unresolvedLabels(analysis: DocumentAnalysis, semantic?: SemanticResponse): string[] {
  const deterministic = analysis.document.propositions.flatMap(p => (p.unresolved ?? []).map(field => `${p.id}: ${field}`));
  const determinations = semantic?.determinations
    .filter(d => d.status !== 'determined')
    .map(d => `${d.propositionId ? `${d.propositionId}: ` : ''}${d.field}`) ?? [];
  const namedFields = new Set([...deterministic, ...determinations].map(item => item.replace(/^P\d+:\s*/, '').toLowerCase()));
  const additional = (semantic?.unresolved ?? []).filter(item => !namedFields.has(item.toLowerCase()));
  return unique([...deterministic, ...determinations, ...additional]);
}

function recommendationsFor(source: string, unresolved: string[]): Recommendation[] {
  const hasMotive = unresolved.some(item => /motive/i.test(item));
  const hasReference = unresolved.some(item => /reference/i.test(item));
  const clean = source.trim();
  const l1Text = hasMotive ? `I believe ${clean.charAt(0).toLowerCase()}${clean.slice(1)}` : clean;
  const l1: Recommendation = { level: 'PGS-L1', text: l1Text };
  const l2: Recommendation = hasMotive || hasReference
    ? { level: 'PGS-L2', withheldReason: 'A more directive rewrite could change unresolved actor, motive, evidence, or requested action.' }
    : { level: 'PGS-L2', text: clean };
  return [l1, l2];
}

function verifyFidelity(source: string, recommendations: Recommendation[], unresolved: string[]): FidelityFinding[] {
  const findings: FidelityFinding[] = [];
  for (const recommendation of recommendations) {
    if (!recommendation.text) continue;
    if (/\b\d{1,4}(?:[-/:]\d{1,2})?\b/.test(recommendation.text) && !/\b\d{1,4}(?:[-/:]\d{1,2})?\b/.test(source)) {
      findings.push({ status: 'blocked', message: `${recommendation.level} introduces a date or quantity absent from the source.` });
    }
  }
  if (unresolved.some(item => /motive/i.test(item))) findings.push({ status: 'review_required', message: 'Motive remains an interpretation and is not promoted to fact.' });
  if (unresolved.some(item => /reference/i.test(item))) findings.push({ status: 'review_required', message: 'Actor/reference identity remains unresolved and is not invented.' });
  if (!findings.length) findings.push({ status: 'pass', message: 'No initial fidelity conflict detected.' });
  if (!findings.some(f => f.status === 'blocked')) findings.push({ status: 'pass', message: 'No actor, date, quantity, evidence, or certainty was added.' });
  return findings;
}

export async function runPgsPipeline(source: string, engine: SemanticEngine): Promise<PipelineResult> {
  const deterministic = analyseDocument(source);
  const ruleFindings = detectDeterministicRules(source);
  const validation = validatePgsDocument(deterministic.document);
  let semantic: SemanticResponse | undefined;
  let semanticError: string | undefined;
  if (deterministic.requiresSemanticReview && validation.valid) {
    try {
      if (engine.providerKind !== 'local') throw new Error('PGS CLI permits local semantic engines only; cloud fallback is disabled.');
      const response = await engine.determine({ source, deterministicDocument: deterministic.document, deterministicRelations: deterministic.relations });
      semantic = response;
    } catch (error) { semanticError = error instanceof Error ? error.message : String(error); }
  }
  const unresolved = unresolvedLabels(deterministic, semantic);
  const recommendations = recommendationsFor(source, unresolved);
  const fidelity = verifyFidelity(source, recommendations, unresolved);
  return { source, deterministic, ruleFindings, ...(semantic ? { semantic } : {}), ...(semanticError ? { semanticError } : {}), validation, unresolved, recommendations, fidelity };
}

function lines(items: string[], empty = 'None'): string { return items.length ? items.map(item => `- ${item}`).join('\n') : empty; }
function determinationLine(item: SemanticDetermination): string {
  const id = item.propositionId ? `${item.propositionId} ` : '';
  const value = item.value === undefined ? '' : ` — ${typeof item.value === 'string' ? item.value : JSON.stringify(item.value)}`;
  return `- ${id}${item.field}: ${item.status}${value} (${item.basis})`;
}

export function formatPgsReport(result: PipelineResult): string {
  const propositions = result.deterministic.document.propositions.map(p => `${p.id}: epistemic=${p.epistemicStatus}; speech-act=${p.speechAct}; ambiguity=${p.ambiguity?.present ? (p.ambiguity.unresolvedFields ?? []).join(', ') : 'none'}`);
  const rules = result.ruleFindings.map(f => `${f.ruleId}: ${f.message}`);
  const semantic = result.semantic
    ? result.semantic.determinations.map(determinationLine)
    : [result.semanticError ? `Semantic review unavailable: ${result.semanticError}` : 'Not required.'];
  const recommendations = result.recommendations.flatMap(r => [r.level, r.text ?? `Withheld: ${r.withheldReason ?? 'Fidelity could not be established.'}`]);
  return [
    'SOURCE', result.source,
    '', 'DETERMINISTIC ANALYSIS', lines([...propositions, ...rules]), `Semantic review required: ${result.deterministic.requiresSemanticReview ? 'Yes' : 'No'}`,
    '', 'SEMANTIC DETERMINATION', semantic.join('\n'),
    '', 'UNRESOLVED', lines(result.unresolved),
    '', ...recommendations,
    '', 'FIDELITY', lines(result.fidelity.map(f => `[${f.status}] ${f.message}`)),
  ].join('\n');
}
