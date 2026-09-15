import type { DocumentAnalysis } from '../analyser/document';
import type { EvidenceItem, SemanticContext, SemanticResponse } from '../semantic/types';

export interface ResolutionEntry {
  field: string;
  propositionId?: string;
  status: 'resolved' | 'unresolved' | 'assessed' | 'indeterminate' | 'protected';
  value?: unknown;
  provenance: 'source' | 'user_context' | 'model_assessment';
  basis: string;
}

function matchingBinding(sourceSpan: string, field: string, context?: SemanticContext) {
  return context?.referenceBindings?.find(binding => {
    const reference = binding.reference.trim();
    if (!reference) return false;
    if (field === 'actor' && reference.toLowerCase() === 'actor') return true;
    return new RegExp(`\\b${reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(sourceSpan);
  });
}

function matchingEvidence(field: string, propositionId: string, context?: SemanticContext): EvidenceItem | undefined {
  return context?.evidence?.find(item => item.field.toLowerCase() === field.toLowerCase() && (!item.propositionId || item.propositionId === propositionId));
}

export function evidenceIsSufficient(field: string, evidence: EvidenceItem): boolean {
  if (field === 'reference' || field === 'actor') return false;
  if (field === 'motive' || field === 'intention') return evidence.kind === 'attributed_admission' || evidence.kind === 'documented';
  return evidence.kind === 'direct_observation' || evidence.kind === 'documented' || evidence.kind === 'attributed_admission';
}

export function buildResolutionLedger(analysis: DocumentAnalysis, semantic?: SemanticResponse, context?: SemanticContext): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];
  const deterministicKeys = new Set<string>();
  for (const proposition of analysis.document.propositions) {
    for (const field of proposition.unresolved ?? []) {
      const key = `${proposition.id}:${field.toLowerCase()}`;
      deterministicKeys.add(key);
      const binding = field === 'reference' || field === 'actor' ? matchingBinding(proposition.sourceSpan, field, context) : undefined;
      const evidence = matchingEvidence(field, proposition.id, context);
      if (binding) entries.push({ field, propositionId: proposition.id, status: 'resolved', value: binding.entity, provenance: 'user_context', basis: `Explicit binding: ${binding.reference} → ${binding.entity}` });
      else if (evidence && evidenceIsSufficient(field, evidence)) entries.push({ field, propositionId: proposition.id, status: 'resolved', value: evidence.statement, provenance: 'user_context', basis: `User-supplied ${evidence.kind} evidence for ${field}.` });
      else entries.push({ field, propositionId: proposition.id, status: 'unresolved', provenance: evidence ? 'user_context' : 'source', basis: evidence ? `${evidence.kind} evidence does not establish ${field}.` : 'Deterministic PIR identifies this field as unresolved.' });
    }
  }
  for (const determination of semantic?.determinations ?? []) {
    const key = `${determination.propositionId ?? ''}:${determination.field.toLowerCase()}`;
    if (deterministicKeys.has(key)) continue;
    entries.push({
      field: determination.field,
      ...(determination.propositionId ? { propositionId: determination.propositionId } : {}),
      status: determination.status === 'determined' ? 'assessed' : determination.status,
      ...(determination.value !== undefined ? { value: determination.value } : {}),
      provenance: 'model_assessment',
      basis: determination.basis,
    });
  }
  return entries;
}

export function unresolvedFromLedger(entries: ResolutionEntry[], semantic?: SemanticResponse): string[] {
  const unresolved = entries.filter(item => item.status === 'unresolved' || item.status === 'indeterminate')
    .map(item => `${item.propositionId ? `${item.propositionId}: ` : ''}${item.field}`);
  const knownFields = new Set(entries.map(item => item.field.toLowerCase()));
  const covered = (item: string) => {
    const value = item.toLowerCase();
    if (knownFields.has(value)) return true;
    if ([...knownFields].some(field => new RegExp(`\\b${field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(value))) return true;
    if (knownFields.has('reference') && /reference|identity|antecedent/.test(value)) return true;
    if (knownFields.has('motive') && /motive|reason|intent/.test(value)) return true;
    return false;
  };
  for (const item of semantic?.unresolved ?? []) if (!covered(item)) unresolved.push(item);
  return [...new Set(unresolved)];
}
