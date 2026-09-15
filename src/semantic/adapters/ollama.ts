import type { SemanticEngine, SemanticRequest, SemanticResponse } from '../types';
import { PGS_SEMANTIC_PROTOCOL } from '../prompts';

export interface OllamaSemanticEngineOptions {
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface OllamaGenerateResponse { response?: string; model?: string; done?: boolean }

export class OllamaSemanticEngine implements SemanticEngine {
  readonly id: string;
  readonly providerKind = 'local' as const;
  readonly capabilities = {
    propositionExtraction: true,
    relationResolution: true,
    ambiguityResolution: true,
    fidelityVerification: false,
    rendering: false,
    structuredOutput: true,
  };

  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OllamaSemanticEngineOptions = {}) {
    this.model = options.model ?? process.env.PGS_OLLAMA_MODEL ?? 'qwen3.8:latest';
    this.baseUrl = (options.baseUrl ?? process.env.PGS_OLLAMA_URL ?? 'http://127.0.0.1:11434').replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.id = `ollama:${this.model}`;
  }

  async health(): Promise<boolean> {
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(Math.min(this.timeoutMs, 5000)) });
      return response.ok;
    } catch { return false; }
  }

  async determine(request: SemanticRequest): Promise<SemanticResponse> {
    const prompt = `${PGS_SEMANTIC_PROTOCOL}\n\nINPUT\n${JSON.stringify(request, null, 2)}\n\nReturn JSON only with keys: propositions, relations, determinations, unresolved.`;
    const response = await this.fetchImpl(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(this.timeoutMs),
      body: JSON.stringify({ model: this.model, prompt, stream: false, format: 'json', options: { temperature: 0 } }),
    });
    if (!response.ok) throw new Error(`Ollama semantic request failed: HTTP ${response.status}`);
    const body = await response.json() as OllamaGenerateResponse;
    if (!body.response) throw new Error('Ollama returned no semantic response.');

    let parsed: Partial<SemanticResponse>;
    try { parsed = JSON.parse(body.response) as Partial<SemanticResponse>; }
    catch { throw new Error('Ollama returned malformed JSON. Determination to be made from a corrected structured response.'); }

    if (!Array.isArray(parsed.propositions) || !Array.isArray(parsed.relations) || !Array.isArray(parsed.determinations) || !Array.isArray(parsed.unresolved)) {
      throw new Error('Ollama response does not conform to the PGS semantic response envelope.');
    }
    return { propositions: parsed.propositions, relations: parsed.relations, determinations: parsed.determinations, unresolved: parsed.unresolved, providerMetadata: { provider: 'ollama', model: body.model ?? this.model, local: true } };
  }
}
