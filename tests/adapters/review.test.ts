import { describe, expect, it } from 'vitest';
import {
  decideSuggestionReview,
  prepareSuggestionReview,
  prepareTextChange,
} from '../../src/index';

describe('framework-neutral suggestion review contract', () => {
  it('presents source, candidate, compact diff and reject-by-default controls', () => {
    const proposal = prepareTextChange(
      { kind: 'body' as const },
      'Maybe it will work.',
      'I am uncertain whether it will work.',
      'PGS-L1',
    );
    const review = prepareSuggestionReview(proposal);
    expect(review).toMatchObject({
      operation: 'prepare-suggestion-review',
      proposalId: proposal.proposalId,
      status: 'pending',
      source: proposal.source,
      candidate: proposal.candidate,
      controls: {
        approveEnabled: true,
        rejectEnabled: true,
        defaultDecision: 'reject',
        requiresReviewerIdentity: true,
      },
      diff: {
        removed: 'Maybe',
        inserted: 'I am uncertain whether',
        commonSuffix: ' it will work.',
      },
    });
  });

  it('surfaces blocked fidelity findings and disables approval', () => {
    const proposal = prepareTextChange(
      { kind: 'body' as const },
      'Send the report.',
      'Send the report by 2026-10-01.',
      'PGS-L1',
    );
    const review = prepareSuggestionReview(proposal);
    expect(review.status).toBe('blocked');
    expect(review.controls.approveEnabled).toBe(false);
    expect(review.controls.rejectEnabled).toBe(true);
    expect(review.findings.map(finding => finding.code)).toContain('FIDELITY_TIME_INVENTED');
    expect(review.blockers.join(' ')).toContain('FIDELITY_TIME_INVENTED');
  });

  it('rebuilds the proposal and rejects tampered review content', () => {
    const proposal = prepareTextChange({ kind: 'body' as const }, 'Maybe it will work.', 'I am uncertain whether it will work.', 'PGS-L1');
    expect(() => prepareSuggestionReview({ ...proposal, candidate: 'It will definitely work.' })).toThrow(/integrity/i);
  });

  it('records an explicit rejection without producing an application', () => {
    const proposal = prepareTextChange({ kind: 'body' as const }, 'Maybe it will work.', 'I am uncertain whether it will work.', 'PGS-L1');
    const outcome = decideSuggestionReview(proposal, {
      proposalId: proposal.proposalId,
      decision: 'reject',
      reviewedBy: ' reviewer-17 ',
      reason: ' Retain the original wording. ',
    });
    expect(outcome).toMatchObject({
      operation: 'complete-suggestion-review',
      decision: 'rejected',
      reviewedBy: 'reviewer-17',
      reason: 'Retain the original wording.',
      application: null,
    });
  });

  it('independently revalidates an explicit approval and returns an application', () => {
    const proposal = prepareTextChange({ kind: 'body' as const }, 'Maybe it will work.', 'I am uncertain whether it will work.', 'PGS-L1');
    const outcome = decideSuggestionReview(proposal, {
      proposalId: proposal.proposalId,
      decision: 'approve',
      reviewedBy: 'reviewer-17',
    });
    expect(outcome.decision).toBe('approved');
    if (outcome.decision !== 'approved') throw new Error('Expected an approved review outcome.');
    expect(outcome.application).toMatchObject({ output: proposal.candidate, approved: true, approvedBy: 'reviewer-17' });
  });

  it('requires a matching proposal identifier and non-empty reviewer identity', () => {
    const proposal = prepareTextChange({ kind: 'body' as const }, 'Maybe it will work.', 'I am uncertain whether it will work.', 'PGS-L1');
    expect(() => decideSuggestionReview(proposal, { proposalId: 'wrong', decision: 'reject', reviewedBy: 'reviewer' })).toThrow(/does not match/i);
    expect(() => decideSuggestionReview(proposal, { proposalId: proposal.proposalId, decision: 'reject', reviewedBy: '  ' })).toThrow(/reviewer identity/i);
  });

  it('fails closed for malformed runtime decision values', () => {
    const proposal = prepareTextChange({ kind: 'body' as const }, 'Maybe it will work.', 'I am uncertain whether it will work.', 'PGS-L1');
    expect(() => decideSuggestionReview(proposal, {
      proposalId: proposal.proposalId,
      decision: 'defer',
      reviewedBy: 'reviewer',
    } as never)).toThrow(/approve or reject/i);
    expect(() => decideSuggestionReview(proposal, {
      proposalId: proposal.proposalId,
      decision: 'reject',
      reviewedBy: 'reviewer',
      reason: 17,
    } as never)).toThrow(/reason must be text/i);
  });

  it('refuses approval of a blocked proposal while retaining rejection', () => {
    const proposal = prepareTextChange({ kind: 'body' as const }, 'Send the report.', 'Send the report tomorrow.', 'PGS-L1');
    expect(() => decideSuggestionReview(proposal, {
      proposalId: proposal.proposalId,
      decision: 'approve',
      reviewedBy: 'reviewer',
    })).toThrow(/cannot be approved/i);
    expect(decideSuggestionReview(proposal, {
      proposalId: proposal.proposalId,
      decision: 'reject',
      reviewedBy: 'reviewer',
    }).decision).toBe('rejected');
  });

  it('returns snapshots that cannot mutate the proposal', () => {
    const target = { kind: 'body' as const, metadata: { label: 'Body' } };
    const proposal = prepareTextChange(target, 'Maybe it will work.', 'I am uncertain whether it will work.', 'PGS-L1');
    const originalFindingCount = proposal.fidelity.issues.length;
    const review = prepareSuggestionReview(proposal);
    review.target.metadata.label = 'Changed';
    review.findings.push({ code: 'TEST', severity: 'blocked', message: 'Mutation test.' });
    expect(proposal.target.metadata.label).toBe('Body');
    expect(proposal.fidelity.issues).toHaveLength(originalFindingCount);
  });
});
