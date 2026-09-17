import { describe, expect, it } from 'vitest';
import {
  applyApprovedEmailSuggestion,
  applyApprovedTextDocumentSuggestion,
  approveSuggestionApplication,
  prepareSuggestionApplication,
  prepareTextChange,
  suggestTextDocument,
  type SemanticEngine,
} from '../../src/index';

const localEngine: SemanticEngine = {
  id: 'local:application-test',
  providerKind: 'local',
  capabilities: { propositionExtraction: true, relationResolution: true, ambiguityResolution: true, fidelityVerification: false, rendering: false, structuredOutput: true },
  async determine(request) {
    return {
      propositions: request.deterministicDocument.propositions,
      relations: request.deterministicRelations,
      determinations: request.deterministicDocument.propositions.flatMap(proposition =>
        (proposition.unresolved ?? []).map(field => ({ field, propositionId: proposition.id, status: 'unresolved' as const, basis: 'Application test preserves ambiguity.' }))),
      unresolved: request.deterministicDocument.propositions.flatMap(proposition => proposition.unresolved ?? []),
    };
  },
};

describe('non-mutating suggestion application boundary', () => {
  it('blocks approval when deterministic fidelity fails', () => {
    const proposal = prepareTextChange({ kind: 'body' as const }, 'Send the report.', 'Send the report by 2026-10-01.', 'PGS-L1');
    expect(proposal.approvalAllowed).toBe(false);
    expect(proposal.blockers.join(' ')).toContain('FIDELITY_TIME_INVENTED');
    expect(() => approveSuggestionApplication(proposal, { proposalId: proposal.proposalId, approved: true })).toThrow(/cannot be approved/i);
    expect(() => approveSuggestionApplication({ ...proposal, approvalAllowed: true, blockers: [] }, { proposalId: proposal.proposalId, approved: true })).toThrow(/cannot be approved/i);
  });

  it('requires an explicit matching approval and detects proposal tampering', () => {
    const proposal = prepareTextChange({ kind: 'body' as const }, 'Maybe it will work.', 'I am uncertain whether it will work.', 'PGS-L1');
    expect(proposal.approvalAllowed).toBe(true);
    expect(proposal.changes).toHaveLength(1);
    expect(() => approveSuggestionApplication(proposal, { proposalId: proposal.proposalId, approved: false })).toThrow(/explicit approval/i);
    expect(() => approveSuggestionApplication(proposal, { proposalId: 'wrong', approved: true })).toThrow(/integrity/i);
    expect(() => approveSuggestionApplication({ ...proposal, candidate: 'Tampered.' }, { proposalId: proposal.proposalId, approved: true })).toThrow(/integrity/i);
  });

  it('prepares an available selected-content recommendation', async () => {
    const result = await suggestTextDocument(
      { format: 'plain_text', text: 'Maybe it will work.' },
      { sectionIds: ['S1'], engine: localEngine },
    );
    const selected = result.suggestions[0];
    expect(selected).toBeDefined();
    const proposal = prepareSuggestionApplication(selected!, 'PGS-L1');
    expect(proposal.source).toBe('Maybe it will work.');
    expect(proposal.candidate).toBe('I am uncertain whether it will work.');
    expect(proposal.approvalAllowed).toBe(true);
  });

  it('applies an approved Markdown section to a copy and preserves markup', () => {
    const input = { format: 'markdown' as const, text: '# Status\nMaybe it will work.\n' };
    const proposal = prepareTextChange({ kind: 'section' as const, sectionId: 'S2' }, 'Maybe it will work.', 'I am uncertain whether it will work.', 'PGS-L1');
    const approved = approveSuggestionApplication(proposal, { proposalId: proposal.proposalId, approved: true, approvedBy: 'reviewer' });
    const output = applyApprovedTextDocumentSuggestion(input, approved);
    expect(output.text).toBe('# Status\nI am uncertain whether it will work.\n');
    expect(input.text).toBe('# Status\nMaybe it will work.\n');
    expect(approved.approvedBy).toBe('reviewer');
  });

  it('applies approved email body and attachment changes to copies only', () => {
    const email = {
      subject: 'Status',
      body: 'Maybe it will work.',
      attachments: [{ id: 'A1', name: 'notes.md', document: { format: 'markdown' as const, text: '# Notes\nMaybe it will work.\n' } }],
    };
    const bodyProposal = prepareTextChange({ kind: 'body' as const }, email.body, 'I am uncertain whether it will work.', 'PGS-L1');
    const bodyApproved = approveSuggestionApplication(bodyProposal, { proposalId: bodyProposal.proposalId, approved: true });
    const withBody = applyApprovedEmailSuggestion(email, bodyApproved);
    expect(withBody.body).toBe('I am uncertain whether it will work.');
    expect(email.body).toBe('Maybe it will work.');

    const attachmentProposal = prepareTextChange(
      { kind: 'attachment-section' as const, attachmentId: 'A1', sectionId: 'S2' },
      'Maybe it will work.',
      'I am uncertain whether it will work.',
      'PGS-L1',
    );
    const attachmentApproved = approveSuggestionApplication(attachmentProposal, { proposalId: attachmentProposal.proposalId, approved: true });
    const withAttachment = applyApprovedEmailSuggestion(email, attachmentApproved);
    expect(withAttachment.attachments?.[0]?.document?.text).toBe('# Notes\nI am uncertain whether it will work.\n');
    expect(email.attachments[0]?.document.text).toBe('# Notes\nMaybe it will work.\n');
  });

  it('preserves whitespace surrounding an approved email field', () => {
    const proposal = prepareTextChange({ kind: 'body' as const }, 'Maybe it will work.', 'I am uncertain whether it will work.', 'PGS-L1');
    const approved = approveSuggestionApplication(proposal, { proposalId: proposal.proposalId, approved: true });
    const output = applyApprovedEmailSuggestion({ body: '\nMaybe it will work.\n' }, approved);
    expect(output.body).toBe('\nI am uncertain whether it will work.\n');
  });

  it('refuses application when source content changed after approval', () => {
    const proposal = prepareTextChange({ kind: 'body' as const }, 'Maybe it will work.', 'I am uncertain whether it will work.', 'PGS-L1');
    const approved = approveSuggestionApplication(proposal, { proposalId: proposal.proposalId, approved: true });
    expect(() => applyApprovedEmailSuggestion({ body: 'The source changed.' }, approved)).toThrow(/changed after approval/i);
  });
});
