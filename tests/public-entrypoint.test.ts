import { describe, expect, it } from 'vitest';
import * as publicApi from '../src/public';

describe('public package entrypoint', () => {
  it('exposes only the supported runtime operations and local adapter', () => {
    expect(Object.keys(publicApi).sort()).toEqual(['OllamaSemanticEngine', 'analyse', 'compare', 'explain', 'suggest']);
  });

  it('runs deterministic operations through the narrow entrypoint', () => {
    expect(publicApi.analyse('I sent the document yesterday.').validation.valid).toBe(true);
    expect(publicApi.compare('Send the report.', 'Send the report by 2026-10-01.').status).toBe('blocked');
  });
});
