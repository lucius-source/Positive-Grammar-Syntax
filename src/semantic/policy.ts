import type { SemanticProviderKind } from './types';

export type ApprovedSemanticProviderKind = Extract<SemanticProviderKind, 'local' | 'self_hosted'>;

/** Provider classes allowed to perform PGS semantic work in public engine operations. */
export function isApprovedSemanticProviderKind(
  kind: SemanticProviderKind,
): kind is ApprovedSemanticProviderKind {
  return kind === 'local' || kind === 'self_hosted';
}
