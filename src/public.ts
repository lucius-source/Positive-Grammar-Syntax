export { analyse, compare, explain, suggest } from './api';
export { analyseEmail, analyseTextDocument } from './adapters';
export type {
  DocumentSection,
  DocumentSectionKind,
  EmailAnalysisResult,
  EmailAttachment,
  EmailAttachmentAnalysis,
  EmailDependency,
  EmailInput,
  EmailThreadMessage,
  TextDocumentAnalysisResult,
  TextDocumentFormat,
  TextDocumentInput,
} from './adapters';
export type {
  AnalyseOperationResult,
  CompareOptions,
  ExplainOperationResult,
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
