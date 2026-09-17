import {
  analyse,
  analyseEmail,
  analyseTextDocument,
  compare,
  explain,
  suggest,
  suggestEmail,
  suggestTextDocument,
  type AnalyseOperationResult,
  type FidelityComparison,
  type EmailAnalysisResult,
  type TextDocumentAnalysisResult,
  type EmailSuggestionResult,
  type TextDocumentSuggestionResult,
  type SemanticContext,
} from 'positive-grammar-syntax';

const context: SemanticContext = { knownFacts: ['I sent the document'] };
const analysis: AnalyseOperationResult = analyse('I sent the document yesterday.');
const comparison: FidelityComparison = compare('Send the report.', 'Send the report by 2026-10-01.', { context });
const explanation = explain('Maybe it will work.');
const deterministicSuggestion = suggest('I sent the document yesterday.');
const emailAnalysis: EmailAnalysisResult = analyseEmail({ subject: 'Status', body: 'I sent the report.' });
const documentAnalysis: TextDocumentAnalysisResult = analyseTextDocument({ format: 'markdown', text: '# Status\nI sent the report.\n' });
const emailSuggestion: Promise<EmailSuggestionResult> = suggestEmail({ body: 'I sent the report yesterday.' }, { targets: [{ kind: 'body' }] });
const documentSuggestion: Promise<TextDocumentSuggestionResult> = suggestTextDocument({ format: 'plain_text', text: 'I sent the report yesterday.' }, { sectionIds: ['S1'] });

void [analysis, comparison, explanation, deterministicSuggestion, emailAnalysis, documentAnalysis, emailSuggestion, documentSuggestion];
