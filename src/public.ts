export { analyse, compare, explain, score, suggest } from './api';
export { analyseEmail, analyseTextDocument, suggestEmail, suggestTextDocument } from './adapters';
export { applyApprovedEmailSuggestion, applyApprovedTextDocumentSuggestion, approveSuggestionApplication, decideSuggestionReview, prepareSuggestionApplication, prepareSuggestionReview, prepareTextChange } from './adapters';
export type {
  DocumentSection,
  DocumentSectionKind,
  EmailAnalysisResult,
  EmailAttachment,
  EmailAttachmentAnalysis,
  EmailDependency,
  EmailInput,
  EmailThreadMessage,
  EmailSuggestionResult,
  EmailSuggestionTarget,
  SuggestEmailOptions,
  SuggestTextDocumentOptions,
  TextDocumentSuggestionResult,
  DocumentSuggestionTarget,
  SelectedContentSuggestion,
  SelectionSuggestionOptions,
  SuggestionAudit,
  SuggestionDisposition,
  TextDocumentAnalysisResult,
  TextDocumentFormat,
  TextDocumentInput,
  ApprovedSuggestionApplication,
  SuggestionApplicationProposal,
  SuggestionApprovalDecision,
  TextReplacement,
  ApprovedSuggestionReview,
  RejectedSuggestionReview,
  SuggestionReview,
  SuggestionReviewControls,
  SuggestionReviewDecision,
  SuggestionReviewDiff,
  SuggestionReviewOutcome,
  SuggestionReviewStatus,
} from './adapters';
export type {
  AnalyseOperationResult,
  CompareOptions,
  ExplainOperationResult,
  ScoreDeduction,
  ScoreOperationResult,
  SuggestOptions,
} from './api';
export { OllamaSemanticEngine } from './semantic/adapters/ollama';
export type { OllamaSemanticEngineOptions } from './semantic/adapters/ollama';
export type {
  EvidenceItem,
  EvidenceKind,
  SemanticContext,
  SemanticEngine,
  SemanticEngineCapabilities,
  SemanticProviderKind,
} from './semantic/types';
export type { FidelityComparison, FidelityIssue, FidelityIssueSeverity } from './core/fidelity';
export type {
  Domain,
  EpistemicStatus,
  FidelityStatus,
  Modality,
  PgsDocument,
  PgsProposition,
  Polarity,
  SpeechAct,
  ValidationIssue,
  ValidationResult,
} from './core/types';
export type { PipelineResult, PipelineOptions, Recommendation } from './pipeline';
