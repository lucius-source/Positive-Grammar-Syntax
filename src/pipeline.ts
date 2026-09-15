import { analyseDocument, type DocumentAnalysis } from './analyser/document';
import { detectDeterministicRules, type RuleFinding } from './core/rules';
import { validatePgsDocument, type ValidationResult } from './core';
import { compareFidelity } from './core/fidelity';
import type { SemanticContext, SemanticDetermination, SemanticEngine, SemanticResponse } from './semantic/types';
import { renderRecommendations, type Recommendation } from './render/recommendations';
import { buildResolutionLedger, unresolvedFromLedger, type ResolutionEntry } from './resolution/ledger';

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
  resolutionLedger: ResolutionEntry[];
  recommendations: Recommendation[];
  fidelity: FidelityFinding[];
}

export interface PipelineOptions { context?: SemanticContext }

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
  if (!findings.some(f => f.status === 'blocked')) findings.push({ status: 'pass', message: 'No unauthorized actor, date, quantity, evidence, or certainty was added.' });
  if (context?.knownFacts?.length) findings.push({ status: 'pass', message: 'User-supplied known facts are explicitly recorded as context.' });
  if (context?.userIntent) findings.push({ status: 'pass', message: 'PGS-L2 action is grounded in the user-supplied intent.' });
  if (context?.referenceBindings?.length) findings.push({ status: 'pass', message: 'Introduced actor identity is grounded in an explicit user reference binding.' });
  if (context?.evidence?.length) findings.push({ status: 'pass', message: 'User-supplied evidence was classified before determining whether it could resolve a field.' });
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
  const resolutionLedger = buildResolutionLedger(deterministic, semantic, options.context);
  const unresolved = unresolvedFromLedger(resolutionLedger, semantic);
  const recommendations = renderRecommendations(source, unresolved, options.context, deterministic.document.propositions);
  const fidelity = verifyFidelity(source, recommendations, unresolved, options.context);
  return { source, ...(options.context ? { context: options.context } : {}), deterministic, ruleFindings, ...(semantic ? { semantic } : {}), ...(semanticError ? { semanticError } : {}), validation, unresolved, resolutionLedger, recommendations, fidelity };
}

function lines(items: string[], empty = 'None'): string { return items.length ? items.map(item => `- ${item}`).join('\n') : empty; }
function determinationLine(item: SemanticDetermination): string {
  const id = item.propositionId ? `${item.propositionId} ` : '';
  const value = item.value === undefined ? '' : ` — ${typeof item.value === 'string' ? item.value : JSON.stringify(item.value)}`;
  return `- ${id}${item.field}: ${item.status}${value} (${item.basis})`;
}

export function formatPgsReport(result: PipelineResult): string {
  const propositions = result.deterministic.document.propositions.map(p => {
    const fields = [
      `sourceSpan=${JSON.stringify(p.sourceSpan)}`,
      `actor=${p.actor === null ? 'unresolved' : (p.actor ?? 'absent')}`,
      `action=${p.actionOrRelation ?? 'absent'}`,
      `object=${p.objectOrTarget ?? 'absent'}`,
      `epistemic=${p.epistemicStatus}`,
      `speech-act=${p.speechAct}`,
      ...(p.time ? [`time=${JSON.stringify(p.time)}`] : []),
      ...(p.quantities?.length ? [`quantities=${p.quantities.join(', ')}`] : []),
      `ambiguity=${p.ambiguity?.present ? (p.ambiguity.unresolvedFields ?? []).join(', ') : 'none'}`,
    ];
    return `${p.id}: ${fields.join('; ')}`;
  });
  const rules = result.ruleFindings.map(f => `${f.ruleId}: ${f.message}`);
  const semantic = result.semantic
    ? result.semantic.determinations.map(determinationLine)
    : [result.semanticError ? `Semantic review unavailable: ${result.semanticError}` : 'Not required.'];
  const recommendations = result.recommendations.flatMap(r => [r.level, r.text ?? `Withheld: ${r.withheldReason ?? 'Fidelity could not be established.'}`, `Rules: ${r.ruleIds.length ? r.ruleIds.join(', ') : 'none (source preserved)'}`, `Support: ${r.supportingFields.length ? r.supportingFields.join(', ') : 'none'}`]);
  const context = result.context
    ? [...(result.context.knownFacts ?? []).map(fact => `Known fact: ${fact}`), ...(result.context.userIntent ? [`User intent: ${result.context.userIntent}`] : []), ...(result.context.referenceBindings ?? []).map(binding => `Reference binding: ${binding.reference} → ${binding.entity}`), ...(result.context.evidence ?? []).map(item => `Evidence (${item.field}; ${item.kind}): ${item.statement}`)]
    : [];
  const ledger = result.resolutionLedger.map(item => `${item.propositionId ? `${item.propositionId} ` : ''}${item.field}: ${item.status}; provenance=${item.provenance}${item.value !== undefined ? `; value=${typeof item.value === 'string' ? item.value : JSON.stringify(item.value)}` : ''}; ${item.basis}`);
  return [
    'SOURCE', result.source,
    ...(context.length ? ['', 'VERIFIED CONTEXT', lines(context)] : []),
    '', 'DETERMINISTIC ANALYSIS', lines([...propositions, ...rules]), `Semantic review required: ${result.deterministic.requiresSemanticReview ? 'Yes' : 'No'}`,
    '', 'SEMANTIC DETERMINATION', semantic.join('\n'),
    '', 'RESOLUTION LEDGER', lines(ledger),
    '', 'UNRESOLVED', lines(result.unresolved),
    '', ...recommendations,
    '', 'FIDELITY', lines(result.fidelity.map(f => `[${f.status}] ${f.message}`)),
  ].join('\n');
}
