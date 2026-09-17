import { describe, expect, it } from 'vitest';
import { analyseTextDocument } from '../../src/adapters/document';

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
});
