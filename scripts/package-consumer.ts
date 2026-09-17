import {
  analyse,
  analyseEmail,
  analyseTextDocument,
  compare,
  explain,
  suggest,
  type AnalyseOperationResult,
  type FidelityComparison,
  type EmailAnalysisResult,
  type TextDocumentAnalysisResult,
  type SemanticContext,
} from 'positive-grammar-syntax';

const context: SemanticContext = { knownFacts: ['I sent the document'] };
const analysis: AnalyseOperationResult = analyse('I sent the document yesterday.');
const comparison: FidelityComparison = compare('Send the report.', 'Send the report by 2026-10-01.', { context });
const explanation = explain('Maybe it will work.');
const deterministicSuggestion = suggest('I sent the document yesterday.');
const emailAnalysis: EmailAnalysisResult = analyseEmail({ subject: 'Status', body: 'I sent the report.' });
const documentAnalysis: TextDocumentAnalysisResult = analyseTextDocument({ format: 'markdown', text: '# Status\nI sent the report.\n' });

void [analysis, comparison, explanation, deterministicSuggestion, emailAnalysis, documentAnalysis];
