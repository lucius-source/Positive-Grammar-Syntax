import type { SemanticEngine, SemanticRequest, SemanticResponse } from '../types';
import { PGS_SEMANTIC_PROTOCOL } from '../prompts';
import { validatePgsDocument } from '../../core/validator';

export interface OllamaSemanticEngineOptions {
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface OllamaGenerateResponse { response?: string; model?: string; done?: boolean }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateSemanticResponse(value: unknown): SemanticResponse {
  if (!isRecord(value) || !Array.isArray(value.propositions) || !Array.isArray(value.relations)
    || !Array.isArray(value.determinations) || !Array.isArray(value.unresolved)) {
    throw new Error('Ollama response does not conform to the PGS semantic response envelope.');
  }
  if (!value.unresolved.every(item => typeof item === 'string')) {
    throw new Error('Ollama response contains an invalid unresolved item.');
  }
  for (const determination of value.determinations) {
    if (!isRecord(determination) || typeof determination.field !== 'string'
      || typeof determination.status !== 'string' || typeof determination.basis !== 'string'
      || !['determined', 'unresolved', 'indeterminate', 'protected'].includes(determination.status)) {
      throw new Error('Ollama response contains an invalid semantic determination.');
    }
  }
  return value as unknown as SemanticResponse;
}

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
    const prompt = `${PGS_SEMANTIC_PROTOCOL}\n\nINPUT\n${JSON.stringify(request, null, 2)}\n\nReturn JSON only. Do not include thinking, analysis, commentary, or markdown. Copy the supplied propositions and relations without changing them; express all additional analysis in determinations and unresolved. In particular, never create a new enum label. Allowed epistemicStatus values are: observed, reported, known, evidenced, inferred, believed, assumed, alleged, predicted, intended, uncertain, unknown. Allowed fidelityStatus values are: pass, conditional, review_required, blocked, protected. Allowed determination status values are: determined, unresolved, indeterminate, protected. Preserve every supplied proposition id and sourceSpan exactly. Return exactly this envelope: {"propositions": PgsProposition[], "relations": PropositionRelation[], "determinations": [{"field": string, "propositionId"?: string, "value"?: unknown, "status": "determined"|"unresolved"|"indeterminate"|"protected", "basis": string, "confidence"?: number}], "unresolved": string[]}.`;
    const response = await this.fetchImpl(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(this.timeoutMs),
      body: JSON.stringify({ model: this.model, prompt, stream: false, format: 'json', think: false, options: { temperature: 0 } }),
    });
    if (!response.ok) throw new Error(`Ollama semantic request failed: HTTP ${response.status}`);
    const body = await response.json() as OllamaGenerateResponse;
    if (!body.response) throw new Error('Ollama returned no semantic response.');

    let parsed: unknown;
    try { parsed = JSON.parse(body.response) as unknown; }
    catch { throw new Error('Ollama returned malformed JSON. Determination to be made from a corrected structured response.'); }
    const validated = validateSemanticResponse(parsed);
    if (request.deterministicDocument.propositions.length > 0) {
      const pirValidation = validatePgsDocument({ source: request.source, propositions: validated.propositions });
      if (!pirValidation.valid) {
        const details = pirValidation.issues.filter(issue => issue.severity === 'error').map(issue => `${issue.propositionId ? `${issue.propositionId}:` : ''}${issue.code}`).join(', ');
        throw new Error(`Ollama response contains invalid PGS-PIR propositions${details ? ` (${details})` : ''}.`);
      }
    }
    const expectedSpans = new Map(request.deterministicDocument.propositions.map(p => [p.id, p.sourceSpan]));
    if (validated.propositions.some(p => expectedSpans.get(p.id) !== p.sourceSpan)) {
      throw new Error('Ollama response changed a proposition id or source span; semantic output rejected.');
    }
    return { ...validated, providerMetadata: { provider: 'ollama', model: body.model ?? this.model, local: true } };
  }
}
