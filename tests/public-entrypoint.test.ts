import { describe, expect, it } from 'vitest';
import * as publicApi from '../src/public';

describe('public package entrypoint', () => {
  it('exposes only the supported runtime operations and local adapter', () => {
    expect(Object.keys(publicApi).sort()).toEqual(['OllamaSemanticEngine', 'analyse', 'analyseEmail', 'analyseTextDocument', 'compare', 'explain', 'suggest', 'suggestEmail', 'suggestTextDocument']);
  });

  it('runs deterministic operations through the narrow entrypoint', () => {
    expect(publicApi.analyse('I sent the document yesterday.').validation.valid).toBe(true);
    expect(publicApi.compare('Send the report.', 'Send the report by 2026-10-01.').status).toBe('blocked');
    expect(publicApi.analyseEmail({ subject: 'Status' }).operation).toBe('analyse-email');
    expect(publicApi.analyseTextDocument({ format: 'plain_text', text: 'I sent it.' }).operation).toBe('analyse-document');
  });

  it('orchestrates deterministic suggestions through the narrow entrypoint', async () => {
    expect((await publicApi.suggestEmail({ body: 'I sent the report yesterday.' }, { targets: [{ kind: 'body' }] })).operation).toBe('suggest-email');
    expect((await publicApi.suggestTextDocument({ format: 'plain_text', text: 'I sent the report yesterday.' }, { sectionIds: ['S1'] })).operation).toBe('suggest-document');
  });
});
