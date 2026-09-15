import type { SemanticEngine, SemanticRequest, SemanticResponse } from './types';

export class SemanticEngineRegistry {
  private engines = new Map<string, SemanticEngine>();

  register(engine: SemanticEngine): void {
    if (this.engines.has(engine.id)) throw new Error(`Semantic engine already registered: ${engine.id}`);
    this.engines.set(engine.id, engine);
  }

  get(id: string): SemanticEngine {
    const engine = this.engines.get(id);
    if (!engine) throw new Error(`Semantic engine not registered: ${id}`);
    return engine;
  }

  list(): SemanticEngine[] {
    return [...this.engines.values()];
  }

  preferred(): SemanticEngine[] {
    const rank = { local: 0, custom: 1, cloud: 2 } as const;
    return this.list().sort((a, b) => rank[a.providerKind] - rank[b.providerKind]);
  }

  async determineLocalFirst(request: SemanticRequest): Promise<{ engineId: string; response: SemanticResponse }> {
    const candidates = this.preferred().filter(e => e.capabilities.propositionExtraction || e.capabilities.ambiguityResolution || e.capabilities.relationResolution);
    if (!candidates.length) throw new Error('No semantic determination engine is registered.');

    let lastError: unknown;
    for (const engine of candidates) {
      try {
        return { engineId: engine.id, response: await engine.determine(request) };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('All semantic determination engines failed.');
  }
}
