import { describe, expect, it } from 'vitest';
import { OllamaSemanticEngine } from '../../src/semantic/adapters/ollama';

const request = { source: 'Maybe it will work.', deterministicDocument: { source: 'Maybe it will work.', propositions: [] }, deterministicRelations: [] };

describe('Ollama semantic adapter', () => {
  it('uses the configured local model and structured JSON mode', async () => {
    let sent: any;
    const fakeFetch = async (_url: any, init?: any) => {
      sent = JSON.parse(init.body);
      return new Response(JSON.stringify({ model: 'qwen3.8:latest', response: JSON.stringify({ propositions: [], relations: [], determinations: [], unresolved: [] }), done: true }), { status: 200 });
    };
    const engine = new OllamaSemanticEngine({ model: 'qwen3.8:latest', fetchImpl: fakeFetch as typeof fetch });
    const result = await engine.determine(request);
    expect(sent.model).toBe('qwen3.8:latest');
    expect(sent.format).toBe('json');
    expect(sent.think).toBe(false);
    expect(sent.options.temperature).toBe(0);
    expect(sent.prompt).toContain('never create a new enum label');
    expect(sent.prompt).toContain('Belief, inference, or unclassified evidence does not resolve a field');
    expect(result.providerMetadata?.local).toBe(true);
  });

  it('rejects malformed structured output rather than guessing', async () => {
    const fakeFetch = async () => new Response(JSON.stringify({ response: 'not-json' }), { status: 200 });
    const engine = new OllamaSemanticEngine({ fetchImpl: fakeFetch as typeof fetch });
    await expect(engine.determine(request)).rejects.toThrow(/malformed JSON/);
  });

  it('rejects incomplete PGS response envelopes', async () => {
    const fakeFetch = async () => new Response(JSON.stringify({ response: JSON.stringify({ propositions: [] }) }), { status: 200 });
    const engine = new OllamaSemanticEngine({ fetchImpl: fakeFetch as typeof fetch });
    await expect(engine.determine(request)).rejects.toThrow(/does not conform/);
  });

  it('rejects invalid determination records', async () => {
    const fakeFetch = async () => new Response(JSON.stringify({ response: JSON.stringify({ propositions: [], relations: [], determinations: [{ field: 'motive' }], unresolved: [] }) }), { status: 200 });
    const engine = new OllamaSemanticEngine({ fetchImpl: fakeFetch as typeof fetch });
    await expect(engine.determine(request)).rejects.toThrow(/invalid semantic determination/);
  });
});
