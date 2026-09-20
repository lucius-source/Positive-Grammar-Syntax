import { describe, expect, it } from 'vitest';
import { SemanticEngineRegistry } from '../../src/semantic/registry';
import { MockSemanticEngine } from '../../src/semantic/adapters/mock';
import type { SemanticEngine } from '../../src/semantic/types';

const engine = (id: string, providerKind: 'local' | 'self_hosted' | 'cloud' | 'custom'): SemanticEngine => ({
  id,
  providerKind,
  capabilities: { propositionExtraction: true, relationResolution: true, ambiguityResolution: true, fidelityVerification: false, rendering: false, structuredOutput: true },
  async determine(request) {
    return { propositions: request.deterministicDocument.propositions, relations: [], determinations: [], unresolved: [], providerMetadata: { id } };
  },
});

const request = {
  source: 'Maybe it will work.',
  deterministicDocument: { source: 'Maybe it will work.', propositions: [] },
  deterministicRelations: [],
};

describe('semantic engine registry', () => {
  it('keeps the semantic contract vendor-neutral', async () => {
    const registry = new SemanticEngineRegistry();
    registry.register(new MockSemanticEngine());
    const result = await registry.determineLocalFirst(request);
    expect(result.engineId).toBe('mock');
  });

  it('prefers local intelligence before cloud providers', async () => {
    const registry = new SemanticEngineRegistry();
    registry.register(engine('cloud-provider', 'cloud'));
    registry.register(engine('local-qwen', 'local'));
    const result = await registry.determineLocalFirst(request);
    expect(result.engineId).toBe('local-qwen');
  });

  it('falls back from local to approved self-hosted execution', async () => {
    const registry = new SemanticEngineRegistry();
    registry.register({ ...engine('local-qwen', 'local'), async determine() { throw new Error('offline'); } });
    registry.register(engine('gaia-self-hosted', 'self_hosted'));
    registry.register(engine('cloud-provider', 'cloud'));
    const result = await registry.determineLocalFirst(request);
    expect(result.engineId).toBe('gaia-self-hosted');
  });

  it('never falls back to a cloud provider', async () => {
    let called = false;
    const registry = new SemanticEngineRegistry();
    registry.register({
      ...engine('cloud-provider', 'cloud'),
      async determine(request) {
        called = true;
        return engine('unused', 'cloud').determine(request);
      },
    });
    await expect(registry.determineLocalFirst(request)).rejects.toThrow(/No non-cloud semantic determination engine/);
    expect(called).toBe(false);
  });
});
