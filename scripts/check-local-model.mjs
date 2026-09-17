const baseUrl = (process.env.PGS_OLLAMA_URL ?? 'http://127.0.0.1:11434').replace(/\/$/, '');
const model = process.env.PGS_OLLAMA_MODEL ?? 'qwen3.8:latest';
const timeoutMs = Number(process.env.PGS_OLLAMA_PREFLIGHT_TIMEOUT_MS ?? 10_000);

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  throw new Error('PGS_OLLAMA_PREFLIGHT_TIMEOUT_MS must be a positive number.');
}

let response;
try {
  response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(timeoutMs) });
} catch (error) {
  throw new Error(`Local Ollama preflight could not reach ${baseUrl}: ${error instanceof Error ? error.message : String(error)}`);
}

if (!response.ok) throw new Error(`Local Ollama preflight returned HTTP ${response.status} from ${baseUrl}.`);
const payload = await response.json();
const models = Array.isArray(payload.models)
  ? payload.models.flatMap(item => typeof item?.name === 'string' ? [item.name] : [])
  : [];
if (!models.includes(model)) {
  throw new Error(`Required local Ollama model is unavailable: ${model}. Available models: ${models.join(', ') || 'none'}.`);
}

console.log(`Local Ollama preflight passed: ${model} at ${baseUrl}`);
