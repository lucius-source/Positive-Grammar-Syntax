import { describe, expect, it } from 'vitest';
import { analyseEmail, suggestEmail, type EmailInput } from '../../src/adapters/email';

describe('email adapter', () => {
  it('preserves email and thread context without merging it into source analysis', () => {
    const input: EmailInput = {
      id: 'email-1', sender: 'sender-role', recipients: ['recipient-role'], subject: 'Status update', body: 'I sent the report yesterday.',
      thread: [{ id: 'prior-1', sender: 'recipient-role', body: 'Please send the report.' }],
    };
    const result = analyseEmail(input);
    input.recipients?.push('later-mutation');
    if (input.thread?.[0]) input.thread[0].body = 'mutated';
    expect(result.operation).toBe('analyse-email');
    expect(result.email.recipients).toEqual(['recipient-role']);
    expect(result.email.thread?.[0]?.body).toBe('Please send the report.');
    expect(result.bodyAnalysis?.source).toBe('I sent the report yesterday.');
    expect(result.bodyAnalysis).not.toHaveProperty('context');
  });

  it('routes supplied text attachments through the document adapter without rewriting them', () => {
    const result = analyseEmail({
      body: 'Please review the attached notice.',
      attachments: [{ id: 'att-1', name: 'notice.md', mediaType: 'text/markdown', document: { format: 'markdown', text: '> Do not disclose this notice.\n' } }],
    });
    expect(result.attachments[0]?.analysis?.document.text).toBe('> Do not disclose this notice.\n');
    expect(result.attachments[0]?.analysis?.protectedSectionIds).toEqual(['S1']);
    expect(result.dependencies).toContainEqual({ reference: 'the attached notice', attachmentId: 'att-1', resolved: true });
    expect(result.attachments[0]).not.toHaveProperty('recommendations');
  });

  it('does not guess which attachment a generic reference identifies', () => {
    const result = analyseEmail({ body: 'See the attached document.', attachments: [
      { id: 'a', name: 'a.txt' }, { id: 'b', name: 'b.txt' },
    ] });
    expect(result.dependencies).toContainEqual({ reference: 'the attached document', resolved: false });
  });

  it('accepts a subject-only email and rejects an empty email', () => {
    expect(analyseEmail({ subject: 'Response required' }).subjectAnalysis?.source).toBe('Response required');
    expect(() => analyseEmail({ subject: ' ', body: '' })).toThrow(/subject or body text is required/i);
  });

  it('suggests only for explicitly selected email fields', async () => {
    const result = await suggestEmail({ subject: 'Status', body: 'I sent the report yesterday.' }, { targets: [{ kind: 'body' }] });
    expect(result.operation).toBe('suggest-email');
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toMatchObject({ target: { kind: 'body' }, disposition: 'available', source: 'I sent the report yesterday.' });
  });

  it('supports selected text-attachment sections but rejects protected content', async () => {
    const input: EmailInput = { body: 'I sent the email yesterday.', attachments: [{
      id: 'att-1', name: 'notes.md', document: { format: 'markdown', text: 'I sent the notice yesterday.\n> Do not alter.\n' },
    }] };
    const result = await suggestEmail(input, { targets: [{ kind: 'attachment-section', attachmentId: 'att-1', sectionId: 'S1' }] });
    expect(result.suggestions[0]?.source).toBe('I sent the notice yesterday.');
    await expect(suggestEmail(input, { targets: [{ kind: 'attachment-section', attachmentId: 'att-1', sectionId: 'S2' }] })).rejects.toThrow(/protected/i);
  });

  it('rejects empty, duplicate and unavailable selections', async () => {
    await expect(suggestEmail({ body: 'Text.' }, { targets: [] })).rejects.toThrow(/at least one/i);
    await expect(suggestEmail({ body: 'Text.' }, { targets: [{ kind: 'body' }, { kind: 'body' }] })).rejects.toThrow(/unique/i);
    await expect(suggestEmail({ body: 'Text.' }, { targets: [{ kind: 'subject' }] })).rejects.toThrow(/subject is empty/i);
    await expect(suggestEmail({ body: 'Text.' }, { targets: [{ kind: 'attachment-section', attachmentId: 'missing', sectionId: 'S1' }] })).rejects.toThrow(/unknown or non-text/i);
  });

  it('requires an explicitly supplied local engine when selected content needs semantic review', async () => {
    await expect(suggestEmail(
      { body: 'They deliberately ignored my email.' },
      { targets: [{ kind: 'body' }] },
    )).rejects.toThrow(/local semantic engine is required/i);
  });
});
