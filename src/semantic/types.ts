import type { PgsDocument, PgsProposition, Domain } from '../core/types';
import type { PropositionRelation } from '../analyser/document';

export type SemanticProviderKind = 'local' | 'cloud' | 'custom';
export type PgsLevel = 'L1' | 'L2' | 'L3-natural' | 'L3-formal';

export interface SemanticEngineCapabilities {
  propositionExtraction: boolean;
  relationResolution: boolean;
  ambiguityResolution: boolean;
  fidelityVerification: boolean;
  rendering: boolean;
  structuredOutput: boolean;
}

export interface SemanticContext {
  domain?: Domain;
  level?: PgsLevel;
  userIntent?: string;
  knownFacts?: string[];
  protectedTerms?: string[];
  preferredLanguage?: string[];
  referenceBindings?: Array<{ reference: string; entity: string }>;
  evidence?: Array<{ field: string; statement: string; propositionId?: string }>;
}

export interface SemanticRequest {
  source: string;
  deterministicDocument: PgsDocument;
  deterministicRelations: PropositionRelation[];
  context?: SemanticContext;
}

export interface SemanticDetermination {
  field: string;
  propositionId?: string;
  value?: unknown;
  status: 'determined' | 'unresolved' | 'indeterminate' | 'protected';
  basis: string;
  confidence?: number;
}

export interface SemanticResponse {
  propositions: PgsProposition[];
  relations: PropositionRelation[];
  determinations: SemanticDetermination[];
  unresolved: string[];
  providerMetadata?: Record<string, unknown>;
}

export interface RenderRequest {
  source: string;
  propositions: PgsProposition[];
  relations: PropositionRelation[];
  level: PgsLevel;
  context?: SemanticContext;
}

export interface RenderResponse {
  text: string;
  ruleTrace: string[];
  protectedContentPreserved: boolean;
}

export interface FidelityRequest {
  source: string;
  candidate: string;
  propositions: PgsProposition[];
  context?: SemanticContext;
}

export interface FidelityResponse {
  status: 'pass' | 'review_required' | 'fail';
  issues: string[];
  preservedPropositions: string[];
  changedPropositions: string[];
}

export interface SemanticEngine {
  readonly id: string;
  readonly providerKind: SemanticProviderKind;
  readonly capabilities: SemanticEngineCapabilities;
  determine(request: SemanticRequest): Promise<SemanticResponse>;
  render?(request: RenderRequest): Promise<RenderResponse>;
  verifyFidelity?(request: FidelityRequest): Promise<FidelityResponse>;
}
