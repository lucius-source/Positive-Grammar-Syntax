import { analyseDocument, type DocumentAnalysis } from './analyser/document';
import { detectDeterministicRules, type RuleFinding } from './core/rules';
import { validatePgsDocument, type ValidationResult } from './core';
import { compareFidelity } from './core/fidelity';
import type { SemanticContext, SemanticDetermination, SemanticEngine, SemanticResponse } from './semantic/types';
import { renderRecommendations, type Recommendation } from './render/recommendations';

export type { Recommendation } from './render/recommendations';
export interface FidelityFinding { status: 'pass' | 'review_required' | 'blocked'; message: string }
export interface PipelineResult {
  source: string;
  context?: SemanticContext;
  deterministic: DocumentAnalysis;
  ruleFindings: RuleFinding[];
  semantic?: SemanticResponse;
  semanticError?: string;
  validation: ValidationResult;
  unresolved: string[];
  recommendations: Recommendation[];
  fidelity: FidelityFinding[];
}

export interface PipelineOptions { context?: SemanticContext }

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

function verifyFidelity(source: string, recommendations: Recommendation[], unresolved: string[], context?: SemanticContext): FidelityFinding[] {
  const findings: FidelityFinding[] = [];
  for (const recommendation of recommendations) {
    if (!recommendation.text) continue;
    const comparison = compareFidelity(source, recommendation.text, context);
    findings.push(...comparison.issues.map(issue => ({ status: issue.severity, message: `${recommendation.level} ${issue.code}: ${issue.message}${issue.evidence ? ` (${issue.evidence})` : ''}` })));
  }
  if (unresolved.some(item => /motive/i.test(item))) findings.push({ status: 'review_required', message: 'Motive remains an interpretation and is not promoted to fact.' });
  if (unresolved.some(item => /reference/i.test(item))) findings.push({ status: 'review_required', message: 'Actor/reference identity remains unresolved and is not invented.' });
  if (!findings.length) findings.push({ status: 'pass', message: 'No initial fidelity conflict detected.' });
  if (!findings.some(f => f.status === 'blocked')) findings.push({ status: 'pass', message: 'No actor, date, quantity, evidence, or certainty was added.' });
  if (context?.knownFacts?.length) findings.push({ status: 'pass', message: 'User-supplied known facts are explicitly recorded as context.' });
  if (context?.userIntent) findings.push({ status: 'pass', message: 'PGS-L2 action is grounded in the user-supplied intent.' });
  return findings;
}

export async function runPgsPipeline(source: string, engine: SemanticEngine, options: PipelineOptions = {}): Promise<PipelineResult> {
  const deterministic = analyseDocument(source);
  const ruleFindings = detectDeterministicRules(source);
  const validation = validatePgsDocument(deterministic.document);
  let semantic: SemanticResponse | undefined;
  let semanticError: string | undefined;
  if (deterministic.requiresSemanticReview && validation.valid) {
    try {
      if (engine.providerKind !== 'local') throw new Error('PGS CLI permits local semantic engines only; cloud fallback is disabled.');
      const response = await engine.determine({ source, deterministicDocument: deterministic.document, deterministicRelations: deterministic.relations, ...(options.context ? { context: options.context } : {}) });
      semantic = response;
    } catch (error) { semanticError = error instanceof Error ? error.message : String(error); }
  }
  const unresolved = unresolvedLabels(deterministic, semantic);
  const recommendations = renderRecommendations(source, unresolved, options.context);
  const fidelity = verifyFidelity(source, recommendations, unresolved, options.context);
  return { source, ...(options.context ? { context: options.context } : {}), deterministic, ruleFindings, ...(semantic ? { semantic } : {}), ...(semanticError ? { semanticError } : {}), validation, unresolved, recommendations, fidelity };
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
  const recommendations = result.recommendations.flatMap(r => [r.level, r.text ?? `Withheld: ${r.withheldReason ?? 'Fidelity could not be established.'}`, `Rules: ${r.ruleIds.length ? r.ruleIds.join(', ') : 'none (source preserved)'}`]);
  const context = result.context
    ? [...(result.context.knownFacts ?? []).map(fact => `Known fact: ${fact}`), ...(result.context.userIntent ? [`User intent: ${result.context.userIntent}`] : [])]
    : [];
  return [
    'SOURCE', result.source,
    ...(context.length ? ['', 'VERIFIED CONTEXT', lines(context)] : []),
    '', 'DETERMINISTIC ANALYSIS', lines([...propositions, ...rules]), `Semantic review required: ${result.deterministic.requiresSemanticReview ? 'Yes' : 'No'}`,
    '', 'SEMANTIC DETERMINATION', semantic.join('\n'),
    '', 'UNRESOLVED', lines(result.unresolved),
    '', ...recommendations,
    '', 'FIDELITY', lines(result.fidelity.map(f => `[${f.status}] ${f.message}`)),
  ].join('\n');
}
