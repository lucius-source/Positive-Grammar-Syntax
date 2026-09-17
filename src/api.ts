import { analyseDocument, type DocumentAnalysis } from './analyser/document';
import { compareFidelity, type FidelityComparison } from './core/fidelity';
import { detectDeterministicRules, type RuleFinding } from './core/rules';
import { validatePgsDocument, type ValidationResult } from './core';
import { runPgsPipeline, type PipelineResult } from './pipeline';
import type { SemanticContext, SemanticEngine } from './semantic/types';

export interface AnalyseOperationResult {
  operation: 'analyse';
  source: string;
  deterministic: DocumentAnalysis;
  ruleFindings: RuleFinding[];
  validation: ValidationResult;
}

export interface SuggestOptions {
  engine?: SemanticEngine;
  context?: SemanticContext;
}

export interface CompareOptions {
  context?: SemanticContext;
}

export interface ExplainOperationResult {
  operation: 'explain';
  source: string;
  propositionCount: number;
  semanticReviewRequired: boolean;
  rules: RuleFinding[];
  unresolved: string[];
  protectedContent: string[];
  messages: string[];
}

function requireSource(source: string): void {
  if (!source.trim()) throw new Error('PGS source text is required.');
}

const unusedLocalEngine: SemanticEngine = {
  id: 'local:not-configured',
  providerKind: 'local',
  capabilities: {
    propositionExtraction: false,
    relationResolution: false,
    ambiguityResolution: false,
    fidelityVerification: false,
    rendering: false,
    structuredOutput: true,
  },
  async determine() {
    throw new Error('A local semantic engine is required for semantic review.');
  },
};

/** Perform deterministic document/PIR analysis without calling a model. */
export function analyse(source: string): AnalyseOperationResult {
  requireSource(source);
  const deterministic = analyseDocument(source);
  return {
    operation: 'analyse',
    source,
    deterministic,
    ruleFindings: detectDeterministicRules(source),
    validation: validatePgsDocument(deterministic.document),
  };
}

/** Run the recommendation pipeline, requiring an explicit local engine when semantic review is needed. */
export async function suggest(source: string, options: SuggestOptions = {}): Promise<PipelineResult> {
  const analysis = analyse(source);
  if (options.engine && options.engine.providerKind !== 'local') {
    throw new Error('PGS suggestions accept local semantic engines only; cloud fallback is disabled.');
  }
  if (analysis.deterministic.requiresSemanticReview && !options.engine) {
    throw new Error('A local semantic engine is required because this source needs semantic review.');
  }
  const pipelineOptions = options.context ? { context: options.context } : {};
  return runPgsPipeline(source, options.engine ?? unusedLocalEngine, pipelineOptions);
}

/** Compare a candidate against its source using deterministic fidelity invariants. */
export function compare(source: string, candidate: string, options: CompareOptions = {}): FidelityComparison {
  requireSource(source);
  if (!candidate.trim()) throw new Error('PGS candidate text is required.');
  return compareFidelity(source, candidate, options.context);
}

/** Explain deterministic findings and why semantic review or protection is required. */
export function explain(source: string): ExplainOperationResult {
  const analysis = analyse(source);
  const propositions = analysis.deterministic.document.propositions;
  const unresolved = propositions.flatMap(proposition => (proposition.unresolved ?? []).map(field => `${proposition.id}: ${field}`));
  const protectedContent = propositions.flatMap(proposition => (proposition.protectedContent ?? []).map(item => `${proposition.id}: ${item}`));
  const messages = [
    `${propositions.length} proposition${propositions.length === 1 ? '' : 's'} extracted.`,
    analysis.ruleFindings.length ? `${analysis.ruleFindings.length} deterministic rule finding${analysis.ruleFindings.length === 1 ? '' : 's'} recorded.` : 'No deterministic rule finding recorded.',
    analysis.deterministic.requiresSemanticReview ? 'Semantic review is required before unresolved meaning can be treated as determined.' : 'Deterministic analysis is sufficient for the currently extracted fields.',
    protectedContent.length ? 'Protected content must be preserved by any candidate.' : 'No protected content marker was required.',
  ];
  return {
    operation: 'explain',
    source,
    propositionCount: propositions.length,
    semanticReviewRequired: analysis.deterministic.requiresSemanticReview,
    rules: analysis.ruleFindings,
    unresolved,
    protectedContent,
    messages,
  };
}
