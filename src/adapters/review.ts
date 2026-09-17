import type { FidelityComparison, FidelityIssue } from '../core/fidelity';
import type { Recommendation } from '../pipeline';
import type { SemanticContext } from '../semantic/types';
import {
  approveSuggestionApplication,
  prepareTextChange,
  type ApprovedSuggestionApplication,
  type SuggestionApplicationProposal,
  type TextReplacement,
} from './application';

export type SuggestionReviewStatus = 'pending' | 'blocked';

export interface SuggestionReviewDiff {
  commonPrefix: string;
  removed: string;
  inserted: string;
  commonSuffix: string;
  sourceRange: { start: number; end: number };
  candidateRange: { start: number; end: number };
}

export interface SuggestionReviewControls {
  approveEnabled: boolean;
  rejectEnabled: true;
  defaultDecision: 'reject';
  requiresReviewerIdentity: true;
}

export interface SuggestionReview<TTarget> {
  operation: 'prepare-suggestion-review';
  proposalId: string;
  target: TTarget;
  level: Recommendation['level'];
  status: SuggestionReviewStatus;
  source: string;
  candidate: string;
  diff: SuggestionReviewDiff;
  fidelity: FidelityComparison;
  findings: FidelityIssue[];
  blockers: string[];
  controls: SuggestionReviewControls;
  context?: SemanticContext;
}

export interface SuggestionReviewDecision {
  proposalId: string;
  decision: 'approve' | 'reject';
  reviewedBy: string;
  reason?: string;
}

export interface ApprovedSuggestionReview<TTarget> {
  operation: 'complete-suggestion-review';
  proposalId: string;
  decision: 'approved';
  reviewedBy: string;
  reason?: string;
  application: ApprovedSuggestionApplication<TTarget>;
}

export interface RejectedSuggestionReview<TTarget> {
  operation: 'complete-suggestion-review';
  proposalId: string;
  decision: 'rejected';
  reviewedBy: string;
  reason?: string;
  target: TTarget;
  application: null;
}

export type SuggestionReviewOutcome<TTarget> = ApprovedSuggestionReview<TTarget> | RejectedSuggestionReview<TTarget>;

function snapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function verifiedProposal<TTarget>(proposal: SuggestionApplicationProposal<TTarget>): SuggestionApplicationProposal<TTarget> {
  const verified = prepareTextChange(proposal.target, proposal.source, proposal.candidate, proposal.level, proposal.context);
  if (verified.proposalId !== proposal.proposalId) throw new Error('PGS suggestion review integrity check failed.');
  return verified;
}

function diffFromReplacement(source: string, candidate: string, changes: TextReplacement[]): SuggestionReviewDiff {
  const change = changes[0];
  if (!change) {
    return {
      commonPrefix: source,
      removed: '',
      inserted: '',
      commonSuffix: '',
      sourceRange: { start: source.length, end: source.length },
      candidateRange: { start: candidate.length, end: candidate.length },
    };
  }
  const commonPrefix = source.slice(0, change.start);
  const commonSuffix = source.slice(change.end);
  return {
    commonPrefix,
    removed: change.removed,
    inserted: change.inserted,
    commonSuffix,
    sourceRange: { start: change.start, end: change.end },
    candidateRange: { start: change.start, end: change.start + change.inserted.length },
  };
}

/** Build a non-mutating, integrity-checked view model for an explicit review interface. */
export function prepareSuggestionReview<TTarget>(proposal: SuggestionApplicationProposal<TTarget>): SuggestionReview<TTarget> {
  const verified = verifiedProposal(proposal);
  return {
    operation: 'prepare-suggestion-review',
    proposalId: verified.proposalId,
    target: snapshot(verified.target),
    level: verified.level,
    status: verified.approvalAllowed ? 'pending' : 'blocked',
    source: verified.source,
    candidate: verified.candidate,
    diff: diffFromReplacement(verified.source, verified.candidate, verified.changes),
    fidelity: snapshot(verified.fidelity),
    findings: snapshot(verified.fidelity.issues),
    blockers: [...verified.blockers],
    controls: {
      approveEnabled: verified.approvalAllowed,
      rejectEnabled: true,
      defaultDecision: 'reject',
      requiresReviewerIdentity: true,
    },
    ...(verified.context ? { context: snapshot(verified.context) } : {}),
  };
}

/** Record an explicit review decision. Approval is independently revalidated; rejection never yields an application. */
export function decideSuggestionReview<TTarget>(
  proposal: SuggestionApplicationProposal<TTarget>,
  decision: SuggestionReviewDecision,
): SuggestionReviewOutcome<TTarget> {
  const verified = verifiedProposal(proposal);
  if (decision.proposalId !== verified.proposalId) throw new Error('PGS suggestion review decision does not match the proposal.');
  if (decision.decision !== 'approve' && decision.decision !== 'reject') throw new Error('PGS suggestion review decision must be approve or reject.');
  const reviewedBy = typeof decision.reviewedBy === 'string' ? decision.reviewedBy.trim() : '';
  if (!reviewedBy) throw new Error('PGS suggestion review requires a reviewer identity.');
  if (decision.reason !== undefined && typeof decision.reason !== 'string') throw new Error('PGS suggestion review reason must be text.');
  const reason = decision.reason?.trim();
  if (decision.decision === 'reject') {
    return {
      operation: 'complete-suggestion-review',
      proposalId: verified.proposalId,
      decision: 'rejected',
      reviewedBy,
      ...(reason ? { reason } : {}),
      target: snapshot(verified.target),
      application: null,
    };
  }
  const application = approveSuggestionApplication(verified, {
    proposalId: verified.proposalId,
    approved: true,
    approvedBy: reviewedBy,
  });
  return {
    operation: 'complete-suggestion-review',
    proposalId: verified.proposalId,
    decision: 'approved',
    reviewedBy,
    ...(reason ? { reason } : {}),
    application,
  };
}
