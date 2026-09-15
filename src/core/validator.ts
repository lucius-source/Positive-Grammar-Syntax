import type { PgsDocument, PgsProposition, ValidationIssue, ValidationResult } from './types';

const EPISTEMIC = new Set([
  'observed','reported','known','evidenced','inferred','believed','assumed',
  'alleged','predicted','intended','uncertain','unknown'
]);

function validateProposition(p: PgsProposition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const error = (code: string, message: string) => issues.push({ code, severity: 'error', propositionId: p.id, message });
  const warn = (code: string, message: string) => issues.push({ code, severity: 'warning', propositionId: p.id, message });

  if (!p.id?.trim()) error('PIR_ID_REQUIRED', 'Proposition id is required.');
  if (!p.sourceSpan?.trim()) error('PIR_SOURCE_REQUIRED', 'A traceable source span is required.');
  if (!EPISTEMIC.has(p.epistemicStatus)) error('PIR_EPISTEMIC_INVALID', 'Epistemic status is invalid.');
  if (p.confidence != null && (p.confidence < 0 || p.confidence > 1)) error('PIR_CONFIDENCE_RANGE', 'Confidence must be between 0 and 1.');

  if (p.negation?.present && p.negation.necessary && !p.negation.reason?.trim()) {
    warn('PIR_NEGATION_REASON', 'Necessary negation should record why it must be preserved.');
  }
  if (p.ambiguity?.present && !(p.ambiguity.unresolvedFields?.length || p.ambiguity.candidateInterpretations?.length)) {
    warn('PIR_AMBIGUITY_DETAIL', 'Ambiguity is flagged but no unresolved field or interpretation is recorded.');
  }
  if (p.fidelityStatus === 'blocked' && !p.unresolved?.length && !p.ambiguity?.present) {
    warn('PIR_BLOCK_REASON', 'Blocked propositions should identify unresolved or ambiguous content.');
  }
  if (p.speechAct === 'refusal' && p.polarity === 'affirmative' && !p.protectedContent?.length) {
    warn('PIR_REFUSAL_PROTECTION', 'Refusal should be explicitly protected against polarity-changing transformation.');
  }
  if (p.domain === 'legal' || p.domain === 'medical' || p.domain === 'safety') {
    if (p.fidelityStatus === 'pass' && p.negation?.present) {
      warn('PIR_HIGH_RISK_NEGATION', 'High-risk domain negation should normally be protected or explicitly reviewed.');
    }
  }
  return issues;
}

export function validatePgsDocument(doc: PgsDocument): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!doc.source?.trim()) issues.push({ code: 'PIR_DOCUMENT_SOURCE_REQUIRED', severity: 'error', message: 'Document source is required.' });
  if (!doc.propositions?.length) issues.push({ code: 'PIR_PROPOSITIONS_REQUIRED', severity: 'error', message: 'At least one proposition is required.' });

  const ids = new Set<string>();
  for (const proposition of doc.propositions ?? []) {
    if (ids.has(proposition.id)) issues.push({ code: 'PIR_DUPLICATE_ID', severity: 'error', propositionId: proposition.id, message: 'Proposition ids must be unique within a document.' });
    ids.add(proposition.id);
    issues.push(...validateProposition(proposition));
  }
  return { valid: !issues.some(i => i.severity === 'error'), issues };
}
