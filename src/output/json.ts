import type { EvaluationSummary } from '../evaluation/local';
import type { FidelityMutationSummary } from '../evaluation/adversarial';
import type { FidelityFuzzSummary } from '../evaluation/fuzz';
import type { PipelineResult } from '../pipeline';
import type { SemanticProviderKind } from '../semantic/types';

export const PGS_JSON_SCHEMA_VERSION = 'pgs.output.v1' as const;

export interface OutputEngine {
  id: string;
  providerKind: SemanticProviderKind;
}

export interface AnalysisOutputEnvelope {
  schemaVersion: typeof PGS_JSON_SCHEMA_VERSION;
  kind: 'analysis';
  engine: OutputEngine;
  result: PipelineResult;
}

export interface EvaluationOutputEnvelope {
  schemaVersion: typeof PGS_JSON_SCHEMA_VERSION;
  kind: 'evaluation';
  engine: OutputEngine;
  summary: EvaluationSummary;
}

export interface FidelityEvaluationOutputEnvelope {
  schemaVersion: typeof PGS_JSON_SCHEMA_VERSION;
  kind: 'fidelity-evaluation';
  summary: FidelityMutationSummary;
}

export interface FidelityFuzzOutputEnvelope {
  schemaVersion: typeof PGS_JSON_SCHEMA_VERSION;
  kind: 'fidelity-fuzz-evaluation';
  summary: FidelityFuzzSummary;
}

export function analysisOutput(result: PipelineResult, engine: OutputEngine): AnalysisOutputEnvelope {
  return { schemaVersion: PGS_JSON_SCHEMA_VERSION, kind: 'analysis', engine, result };
}

export function evaluationOutput(summary: EvaluationSummary, engine: OutputEngine): EvaluationOutputEnvelope {
  return { schemaVersion: PGS_JSON_SCHEMA_VERSION, kind: 'evaluation', engine, summary };
}

export function fidelityEvaluationOutput(summary: FidelityMutationSummary): FidelityEvaluationOutputEnvelope {
  return { schemaVersion: PGS_JSON_SCHEMA_VERSION, kind: 'fidelity-evaluation', summary };
}

export function fidelityFuzzOutput(summary: FidelityFuzzSummary): FidelityFuzzOutputEnvelope {
  return { schemaVersion: PGS_JSON_SCHEMA_VERSION, kind: 'fidelity-fuzz-evaluation', summary };
}

export function formatJsonOutput(value: AnalysisOutputEnvelope | EvaluationOutputEnvelope | FidelityEvaluationOutputEnvelope | FidelityFuzzOutputEnvelope): string {
  return JSON.stringify(value, null, 2);
}
