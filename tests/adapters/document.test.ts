import { describe, expect, it } from 'vitest';
import { analyseTextDocument, suggestTextDocument } from '../../src/adapters/document';
import type { SemanticEngine } from '../../src/semantic/types';

const localEngine: SemanticEngine = {
  id: 'local:document-test', providerKind: 'local',
  capabilities: { propositionExtraction: true, relationResolution: true, ambiguityResolution: true, fidelityVerification: false, rendering: false, structuredOutput: true },
  async determine(request) {
    return { propositions: request.deterministicDocument.propositions, relations: request.deterministicRelations, determinations: [], unresolved: request.deterministicDocument.propositions.flatMap(item => item.unresolved ?? []) };
  },
};

describe('text document adapter', () => {
  it('analyses plain text through the universal engine while preserving source', () => {
    const source = 'I sent the document yesterday.';
    const result = analyseTextDocument({ id: 'doc-1', format: 'plain_text', text: source });
    expect(result.operation).toBe('analyse-document');
    expect(result.document.text).toBe(source);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]?.analysis?.deterministic.document.source).toBe(source);
  });

  it('preserves Markdown offsets and protects quotations and fenced code', () => {
    const source = '# Status\nI sent the report.\n> Do not alter this quotation.\n```txt\nmust not change\n```\n';
    const result = analyseTextDocument({ format: 'markdown', text: source, protectedTerms: ['Status'] });
    for (const section of result.sections) expect(source.slice(section.start, section.end)).toBe(section.source);
    expect(result.sections.map(section => section.kind)).toEqual(['heading', 'paragraph', 'quote', 'fence', 'code', 'fence']);
    expect(result.protectedSectionIds).toEqual(['S3', 'S4', 'S5', 'S6']);
    expect(result.sections.find(section => section.kind === 'quote')?.analysis).toBeUndefined();
    expect(result.document.protectedTerms).toEqual(['Status']);
  });

  it('rejects empty or unsupported document input', () => {
    expect(() => analyseTextDocument({ format: 'plain_text', text: '  ' })).toThrow(/document text is required/i);
    expect(() => analyseTextDocument({ format: 'html' as 'plain_text', text: '<p>text</p>' })).toThrow(/unsupported/i);
  });

  it('suggests only for explicitly selected non-protected sections', async () => {
    const result = await suggestTextDocument({ format: 'markdown', text: '# Status\nI sent the report yesterday.\n> Quoted text.\n' }, { sectionIds: ['S2'] });
    expect(result.operation).toBe('suggest-document');
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toMatchObject({ target: { kind: 'section', sectionId: 'S2' }, disposition: 'available', source: 'I sent the report yesterday.' });
    expect(result.suggestions[0]?.recommendations[0]?.text).toBe('I sent the report yesterday.');
  });

  it('rejects unknown, duplicate and protected section selections', async () => {
    const input = { format: 'markdown' as const, text: 'Text.\n> Quote.\n' };
    await expect(suggestTextDocument(input, { sectionIds: [] })).rejects.toThrow(/at least one/i);
    await expect(suggestTextDocument(input, { sectionIds: ['S1', 'S1'] })).rejects.toThrow(/unique/i);
    await expect(suggestTextDocument(input, { sectionIds: ['S9'] })).rejects.toThrow(/unknown/i);
    await expect(suggestTextDocument(input, { sectionIds: ['S2'] })).rejects.toThrow(/protected/i);
  });

  it('withholds recommendations that remove a document-protected term', async () => {
    const result = await suggestTextDocument({ format: 'plain_text', text: "I'm useless at this.", protectedTerms: ['useless'] }, { sectionIds: ['S1'], engine: localEngine });
    expect(result.suggestions[0]?.disposition).toBe('withheld');
    expect(result.suggestions[0]?.recommendations).toEqual([]);
    expect(result.suggestions[0]?.withheldReason).toContain('FIDELITY_PROTECTED_TERM_REMOVED');
  });
});
