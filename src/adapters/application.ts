import { compareFidelity, type FidelityComparison } from '../core/fidelity';
import type { Recommendation } from '../pipeline';
import type { SemanticContext } from '../semantic/types';
import { analyseTextDocument, type DocumentSuggestionTarget, type TextDocumentInput } from './document';
import { analyseEmail, type EmailInput, type EmailSuggestionTarget } from './email';
import type { SelectedContentSuggestion } from './suggestion';

export interface TextReplacement {
  start: number;
  end: number;
  removed: string;
  inserted: string;
}

export interface SuggestionApplicationProposal<TTarget> {
  operation: 'prepare-suggestion-application';
  proposalId: string;
  target: TTarget;
  level: Recommendation['level'];
  source: string;
  candidate: string;
  changes: TextReplacement[];
  fidelity: FidelityComparison;
  context?: SemanticContext;
  approvalRequired: true;
  approvalAllowed: boolean;
  blockers: string[];
}

export interface SuggestionApprovalDecision {
  proposalId: string;
  approved: boolean;
  approvedBy?: string;
}

export interface ApprovedSuggestionApplication<TTarget> {
  operation: 'approved-suggestion-application';
  proposalId: string;
  target: TTarget;
  level: Recommendation['level'];
  source: string;
  output: string;
  changes: TextReplacement[];
  approved: true;
  approvedBy?: string;
}

function snapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function proposalFingerprint(target: unknown, level: Recommendation['level'], source: string, candidate: string, context?: SemanticContext): string {
  const value = JSON.stringify({ target, level, source, candidate, context });
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index++) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `pgs-${hash.toString(16).padStart(16, '0')}`;
}

function replacement(source: string, candidate: string): TextReplacement[] {
  if (source === candidate) return [];
  let start = 0;
  while (start < source.length && start < candidate.length && source[start] === candidate[start]) start++;
  let sourceEnd = source.length;
  let candidateEnd = candidate.length;
  while (sourceEnd > start && candidateEnd > start && source[sourceEnd - 1] === candidate[candidateEnd - 1]) {
    sourceEnd--;
    candidateEnd--;
  }
  return [{ start, end: sourceEnd, removed: source.slice(start, sourceEnd), inserted: candidate.slice(start, candidateEnd) }];
}

/** Prepare a deterministic, non-mutating replacement proposal. This does not authorize or apply the candidate. */
export function prepareTextChange<TTarget>(
  target: TTarget,
  source: string,
  candidate: string,
  level: Recommendation['level'],
  context?: SemanticContext,
): SuggestionApplicationProposal<TTarget> {
  if (!source.trim()) throw new Error('PGS application source text is required.');
  if (!candidate.trim()) throw new Error('PGS application candidate text is required.');
  const safeTarget = snapshot(target);
  const safeContext = context ? snapshot(context) : undefined;
  const changes = replacement(source, candidate);
  const fidelity = compareFidelity(source, candidate, safeContext);
  const blockers = [
    ...fidelity.issues.filter(issue => issue.severity === 'blocked').map(issue => `${issue.code}: ${issue.message}`),
    ...(changes.length ? [] : ['NO_TEXT_CHANGE: Candidate is identical to source.']),
  ];
  return {
    operation: 'prepare-suggestion-application',
    proposalId: proposalFingerprint(safeTarget, level, source, candidate, safeContext),
    target: safeTarget,
    level,
    source,
    candidate,
    changes,
    fidelity,
    ...(safeContext ? { context: safeContext } : {}),
    approvalRequired: true,
    approvalAllowed: blockers.length === 0,
    blockers,
  };
}

/** Prepare an application proposal from one available, explicitly selected recommendation. */
export function prepareSuggestionApplication<TTarget>(
  suggestion: SelectedContentSuggestion<TTarget>,
  level: Recommendation['level'],
): SuggestionApplicationProposal<TTarget> {
  if (suggestion.disposition !== 'available') throw new Error(`Withheld PGS suggestion cannot be prepared: ${suggestion.withheldReason ?? 'fidelity approval unavailable'}`);
  const recommendation = suggestion.recommendations.find(item => item.level === level);
  if (!recommendation?.text) throw new Error(`PGS ${level} recommendation is not available for the selected target.`);
  return prepareTextChange(suggestion.target, suggestion.source, recommendation.text, level, suggestion.audit.context);
}

/** Validate an explicit approval decision and return an approved replacement; no external content is mutated. */
export function approveSuggestionApplication<TTarget>(
  proposal: SuggestionApplicationProposal<TTarget>,
  decision: SuggestionApprovalDecision,
): ApprovedSuggestionApplication<TTarget> {
  const expectedId = proposalFingerprint(proposal.target, proposal.level, proposal.source, proposal.candidate, proposal.context);
  if (proposal.proposalId !== expectedId || decision.proposalId !== expectedId) throw new Error('PGS suggestion proposal integrity check failed.');
  if (decision.approved !== true) throw new Error('Explicit approval is required before applying a PGS suggestion.');
  const verified = prepareTextChange(proposal.target, proposal.source, proposal.candidate, proposal.level, proposal.context);
  if (!verified.approvalAllowed) throw new Error(`Blocked PGS suggestion cannot be approved: ${verified.blockers.join(' ')}`);
  return {
    operation: 'approved-suggestion-application',
    proposalId: proposal.proposalId,
    target: snapshot(proposal.target),
    level: proposal.level,
    source: proposal.source,
    output: proposal.candidate,
    changes: snapshot(verified.changes),
    approved: true,
    ...(decision.approvedBy?.trim() ? { approvedBy: decision.approvedBy.trim() } : {}),
  };
}

function replaceDocumentSection(input: TextDocumentInput, application: ApprovedSuggestionApplication<DocumentSuggestionTarget>): TextDocumentInput {
  const analysis = analyseTextDocument(input);
  const selected = analysis.sections.find(section => section.id === application.target.sectionId);
  if (!selected || selected.protected) throw new Error(`Unknown or protected PGS document section: ${application.target.sectionId}`);
  if (selected.text !== application.source) throw new Error('PGS document source changed after approval; application refused.');
  const replacementSource = selected.source.replace(selected.text, application.output);
  const text = `${input.text.slice(0, selected.start)}${replacementSource}${input.text.slice(selected.end)}`;
  return { ...analysis.document, text };
}

/** Apply an approved section replacement to a new document value. The supplied document is never mutated. */
export function applyApprovedTextDocumentSuggestion(
  input: TextDocumentInput,
  application: ApprovedSuggestionApplication<DocumentSuggestionTarget>,
): TextDocumentInput {
  if (application.target.kind !== 'section') throw new Error('Approved PGS application does not target a document section.');
  return replaceDocumentSection(input, application);
}

/** Apply an approved email-field or attachment-section replacement to a new email value. The supplied email is never mutated. */
export function applyApprovedEmailSuggestion(
  input: EmailInput,
  application: ApprovedSuggestionApplication<EmailSuggestionTarget>,
): EmailInput {
  const email = analyseEmail(input).email;
  if (application.target.kind === 'subject' || application.target.kind === 'body') {
    const current = email[application.target.kind] ?? '';
    if (current.trim() !== application.source) throw new Error(`PGS email ${application.target.kind} changed after approval; application refused.`);
    return { ...email, [application.target.kind]: current.replace(application.source, application.output) };
  }
  const attachmentId = application.target.attachmentId;
  const sectionId = application.target.sectionId;
  const attachment = email.attachments?.find(item => item.id === attachmentId);
  if (!attachment?.document) throw new Error(`Unknown or non-text PGS email attachment: ${attachmentId}`);
  const document = replaceDocumentSection(attachment.document, {
    ...application,
    target: { kind: 'section', sectionId },
  });
  return {
    ...email,
    attachments: (email.attachments ?? []).map(item => item.id === attachment.id ? { ...item, document } : item),
  };
}
