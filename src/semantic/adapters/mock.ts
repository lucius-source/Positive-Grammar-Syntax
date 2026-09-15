import type { SemanticEngine, SemanticRequest, SemanticResponse } from '../types';

/** Test-only provider proving that PGS depends on the SemanticEngine contract, not a vendor SDK. */
export class MockSemanticEngine implements SemanticEngine {
  readonly id = 'mock';
  readonly providerKind = 'custom' as const;
  readonly capabilities = {
    propositionExtraction: true,
    relationResolution: true,
    ambiguityResolution: true,
    fidelityVerification: false,
    rendering: false,
    structuredOutput: true,
  };

  async determine(request: SemanticRequest): Promise<SemanticResponse> {
    return {
      propositions: request.deterministicDocument.propositions,
      relations: request.deterministicRelations,
      determinations: request.deterministicDocument.propositions.flatMap(p =>
        (p.unresolved ?? []).map(field => ({
          field,
          propositionId: p.id,
          status: 'unresolved' as const,
          basis: 'Mock adapter preserves unresolved deterministic findings.',
        }))
      ),
      unresolved: request.deterministicDocument.propositions.flatMap(p => p.unresolved ?? []),
      providerMetadata: { provider: 'mock' },
    };
  }
}
