import { analyseDocument, type DocumentAnalysis } from './analyser/document';
import { detectDeterministicRules, type RuleFinding } from './core/rules';
import { validatePgsDocument, type ValidationResult } from './core';
import { compareFidelity } from './core/fidelity';
import { isApprovedSemanticProviderKind } from './semantic/policy';
import type { SemanticContext, SemanticDetermination, SemanticEngine, SemanticResponse } from './semantic/types';
import { renderRecommendations, type Recommendation } from './render/recommendations';
import { generateRecommendation } from './render/generated';
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
  /**
   * Set when the engine's `render` threw. Separate from `semanticError`
   * because determination and generation fail independently: a wording can be
   * lost while every determination succeeded.
   */
  renderError?: string;
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
      if (!isApprovedSemanticProviderKind(engine.providerKind)) throw new Error('PGS permits an explicitly configured local, self-hosted or cloud semantic engine; an unclassified provider is refused.');
      const response = await engine.determine({ source, deterministicDocument: deterministic.document, deterministicRelations: deterministic.relations, ...(options.context ? { context: options.context } : {}) });
      semantic = response;
    } catch (error) { semanticError = error instanceof Error ? error.message : String(error); }
  }
  const resolutionLedger = buildResolutionLedger(deterministic, semantic, options.context);
  const unresolved = unresolvedFromLedger(resolutionLedger, semantic);
  const recommendations = renderRecommendations(source, unresolved, options.context, deterministic.document.propositions);
  /**
   * The generated wording, when the engine can author one. Appended rather
   * than substituted: L1 and L2 stay deterministic, so a caller can always
   * tell which wording the engine derived and which a model wrote.
   *
   * Its own gates live in `render/generated.ts`. It is then verified again
   * here alongside L1 and L2, so `fidelity` reports every wording on offer by
   * the same measure.
   */
  const generated = await generateRecommendation({
    source,
    engine,
    propositions: semantic?.propositions ?? deterministic.document.propositions,
    relations: semantic?.relations ?? deterministic.relations,
    ...(options.context ? { context: options.context } : {}),
    /*
      The determinations, for the affirmative path. `desiredState` is returned
      here and never on a proposition — the determination prompt instructs the
      model to copy propositions unchanged — and nothing bridges the two, so
      without this the field the renderer needs is unreachable from it.
    */
    ...(semantic?.determinations ? { determinations: semantic.determinations } : {}),
  });
  if (generated.recommendation) recommendations.push(generated.recommendation);
  const fidelity = verifyFidelity(source, recommendations, unresolved, options.context);
  return { source, ...(options.context ? { context: options.context } : {}), deterministic, ruleFindings, ...(semantic ? { semantic } : {}), ...(semanticError ? { semanticError } : {}), ...(generated.error ? { renderError: generated.error } : {}), validation, unresolved, resolutionLedger, recommendations, fidelity };
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
      ...(p.domain ? [`domain=${p.domain}`] : []),
      ...(p.protectedContent?.length ? [`protected=${p.protectedContent.join(', ')}`] : []),
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
  const recommendations = [
    ...result.recommendations.flatMap(r => [r.level, r.text ?? `Withheld: ${r.withheldReason ?? 'Fidelity could not be established.'}`, `Rules: ${r.ruleIds.length ? r.ruleIds.join(', ') : 'none (source preserved)'}`, `Support: ${r.supportingFields.length ? r.supportingFields.join(', ') : 'none'}`, ...(r.fidelityIssues?.length ? [`Read carefully: ${r.fidelityIssues.map(i => i.message).join(' ')}`] : [])]),
    // A render that threw leaves no recommendation to print, so the reason is
    // printed in its place rather than the level silently going missing.
    ...(result.renderError ? ['PGS-L3-natural', `Unavailable: ${result.renderError}`] : []),
  ];
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
