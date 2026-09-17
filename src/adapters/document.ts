import { analyse, type AnalyseOperationResult } from '../api';

export type TextDocumentFormat = 'plain_text' | 'markdown';
export type DocumentSectionKind = 'body' | 'heading' | 'paragraph' | 'quote' | 'code' | 'fence';

export interface TextDocumentInput {
  id?: string;
  title?: string;
  format: TextDocumentFormat;
  text: string;
  protectedTerms?: string[];
}

export interface DocumentSection {
  id: string;
  kind: DocumentSectionKind;
  source: string;
  text: string;
  start: number;
  end: number;
  protected: boolean;
  analysis?: AnalyseOperationResult;
}

export interface TextDocumentAnalysisResult {
  operation: 'analyse-document';
  document: TextDocumentInput;
  sections: DocumentSection[];
  protectedSectionIds: string[];
}

function requireDocument(input: TextDocumentInput): void {
  if (!input.text.trim()) throw new Error('PGS document text is required.');
  if (input.format !== 'plain_text' && input.format !== 'markdown') throw new Error(`Unsupported PGS document format: ${String(input.format)}`);
}

function snapshot(input: TextDocumentInput): TextDocumentInput {
  return {
    ...(input.id ? { id: input.id } : {}),
    ...(input.title ? { title: input.title } : {}),
    format: input.format,
    text: input.text,
    ...(input.protectedTerms?.length ? { protectedTerms: [...input.protectedTerms] } : {}),
  };
}

function section(id: string, kind: DocumentSectionKind, source: string, text: string, start: number, protectedContent: boolean): DocumentSection {
  const clean = text.trim();
  return {
    id,
    kind,
    source,
    text: clean,
    start,
    end: start + source.length,
    protected: protectedContent,
    ...(!protectedContent && clean ? { analysis: analyse(clean) } : {}),
  };
}

function markdownSections(text: string): DocumentSection[] {
  const sections: DocumentSection[] = [];
  const lines = text.match(/.*(?:\r?\n|$)/g)?.filter(line => line.length > 0) ?? [];
  let offset = 0;
  let inFence = false;
  for (const source of lines) {
    const withoutBreak = source.replace(/\r?\n$/, '');
    const trimmed = withoutBreak.trim();
    if (!trimmed) { offset += source.length; continue; }
    const id = `S${sections.length + 1}`;
    if (/^\s*```/.test(withoutBreak)) {
      sections.push(section(id, 'fence', source, trimmed, offset, true));
      inFence = !inFence;
    } else if (inFence) {
      sections.push(section(id, 'code', source, withoutBreak, offset, true));
    } else if (/^\s*>/.test(withoutBreak)) {
      sections.push(section(id, 'quote', source, withoutBreak.replace(/^\s*>\s?/, ''), offset, true));
    } else {
      const heading = withoutBreak.match(/^\s*#{1,6}\s+(.+)$/);
      sections.push(section(id, heading ? 'heading' : 'paragraph', source, heading?.[1] ?? withoutBreak, offset, false));
    }
    offset += source.length;
  }
  return sections;
}

/** Preserve and deterministically analyse supplied plain-text or Markdown document content. */
export function analyseTextDocument(input: TextDocumentInput): TextDocumentAnalysisResult {
  requireDocument(input);
  const document = snapshot(input);
  const sections = input.format === 'markdown'
    ? markdownSections(input.text)
    : [section('S1', 'body', input.text, input.text, 0, false)];
  return {
    operation: 'analyse-document',
    document,
    sections,
    protectedSectionIds: sections.filter(item => item.protected).map(item => item.id),
  };
}
