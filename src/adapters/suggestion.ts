import { suggest, type SuggestOptions } from '../api';
import type { FidelityFinding, PipelineResult, Recommendation } from '../pipeline';
import type { SemanticContext } from '../semantic/types';

export type SuggestionDisposition = 'available' | 'withheld';
export type SuggestionAudit = Omit<PipelineResult, 'recommendations'>;

export interface SelectedContentSuggestion<TTarget> {
  target: TTarget;
  source: string;
  disposition: SuggestionDisposition;
  recommendations: Recommendation[];
  withheldReason?: string;
  audit: SuggestionAudit;
}

export interface SelectionSuggestionOptions extends SuggestOptions {}

function mergedContext(context: SemanticContext | undefined, protectedTerms: string[]): SemanticContext | undefined {
  const terms = [...new Set([...(context?.protectedTerms ?? []), ...protectedTerms].map(term => term.trim()).filter(Boolean))];
  if (!context && terms.length === 0) return undefined;
  return { ...(context ?? {}), ...(terms.length ? { protectedTerms: terms } : {}) };
}

export async function orchestrateSelectedSuggestion<TTarget>(
  target: TTarget,
  source: string,
  options: SelectionSuggestionOptions,
  protectedTerms: string[] = [],
): Promise<SelectedContentSuggestion<TTarget>> {
  const context = mergedContext(options.context, protectedTerms);
  const pipeline = await suggest(source, {
    ...(options.engine ? { engine: options.engine } : {}),
    ...(context ? { context } : {}),
  });
  const { recommendations, ...audit } = pipeline;
  const blocked = pipeline.fidelity.filter((finding: FidelityFinding) => finding.status === 'blocked');
  return blocked.length
    ? {
        target,
        source,
        disposition: 'withheld',
        recommendations: [],
        withheldReason: blocked.map(finding => finding.message).join(' '),
        audit,
      }
    : { target, source, disposition: 'available', recommendations, audit };
}
