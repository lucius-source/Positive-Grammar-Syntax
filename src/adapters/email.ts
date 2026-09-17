import { analyse, type AnalyseOperationResult } from '../api';
import { analyseTextDocument, type TextDocumentAnalysisResult, type TextDocumentInput } from './document';

export interface EmailThreadMessage {
  id: string;
  sender?: string;
  recipients?: string[];
  sentAt?: string;
  subject?: string;
  body: string;
}

export interface EmailAttachment {
  id: string;
  name: string;
  mediaType?: string;
  document?: TextDocumentInput;
}

export interface EmailInput {
  id?: string;
  sender?: string;
  recipients?: string[];
  subject?: string;
  body?: string;
  thread?: EmailThreadMessage[];
  attachments?: EmailAttachment[];
}

export interface EmailAttachmentAnalysis {
  attachment: EmailAttachment;
  analysis?: TextDocumentAnalysisResult;
}

export interface EmailDependency {
  reference: string;
  attachmentId?: string;
  resolved: boolean;
}

export interface EmailAnalysisResult {
  operation: 'analyse-email';
  email: EmailInput;
  subjectAnalysis?: AnalyseOperationResult;
  bodyAnalysis?: AnalyseOperationResult;
  attachments: EmailAttachmentAnalysis[];
  dependencies: EmailDependency[];
}

function snapshotDocument(document: TextDocumentInput): TextDocumentInput {
  return {
    ...(document.id ? { id: document.id } : {}),
    ...(document.title ? { title: document.title } : {}),
    format: document.format,
    text: document.text,
    ...(document.protectedTerms?.length ? { protectedTerms: [...document.protectedTerms] } : {}),
  };
}

function snapshotAttachment(attachment: EmailAttachment): EmailAttachment {
  return {
    id: attachment.id,
    name: attachment.name,
    ...(attachment.mediaType ? { mediaType: attachment.mediaType } : {}),
    ...(attachment.document ? { document: snapshotDocument(attachment.document) } : {}),
  };
}

function snapshotEmail(input: EmailInput): EmailInput {
  return {
    ...(input.id ? { id: input.id } : {}),
    ...(input.sender ? { sender: input.sender } : {}),
    ...(input.recipients?.length ? { recipients: [...input.recipients] } : {}),
    ...(input.subject !== undefined ? { subject: input.subject } : {}),
    ...(input.body !== undefined ? { body: input.body } : {}),
    ...(input.thread?.length ? { thread: input.thread.map(message => ({
      id: message.id,
      ...(message.sender ? { sender: message.sender } : {}),
      ...(message.recipients?.length ? { recipients: [...message.recipients] } : {}),
      ...(message.sentAt ? { sentAt: message.sentAt } : {}),
      ...(message.subject !== undefined ? { subject: message.subject } : {}),
      body: message.body,
    })) } : {}),
    ...(input.attachments?.length ? { attachments: input.attachments.map(snapshotAttachment) } : {}),
  };
}

function dependencies(body: string, attachments: EmailAttachment[]): EmailDependency[] {
  const found: EmailDependency[] = [];
  for (const attachment of attachments) {
    if (body.toLowerCase().includes(attachment.name.toLowerCase())) {
      found.push({ reference: attachment.name, attachmentId: attachment.id, resolved: true });
    }
  }
  const generic = body.match(/\b(?:the\s+)?(?:attached|enclosed)\s+(?:file|document|notice|schedule|report)|\battachment\b/gi) ?? [];
  for (const reference of generic) {
    if (attachments.length === 1 && attachments[0]) found.push({ reference, attachmentId: attachments[0].id, resolved: true });
    else found.push({ reference, resolved: false });
  }
  return found;
}

/** Preserve and deterministically analyse an email and any explicitly supplied text attachments. */
export function analyseEmail(input: EmailInput): EmailAnalysisResult {
  const subject = input.subject?.trim() ?? '';
  const body = input.body?.trim() ?? '';
  if (!subject && !body) throw new Error('PGS email subject or body text is required.');
  const email = snapshotEmail(input);
  const attachments = (email.attachments ?? []).map(attachment => ({
    attachment,
    ...(attachment.document ? { analysis: analyseTextDocument(attachment.document) } : {}),
  }));
  return {
    operation: 'analyse-email',
    email,
    ...(subject ? { subjectAnalysis: analyse(input.subject ?? '') } : {}),
    ...(body ? { bodyAnalysis: analyse(input.body ?? '') } : {}),
    attachments,
    dependencies: dependencies(input.body ?? '', email.attachments ?? []),
  };
}
