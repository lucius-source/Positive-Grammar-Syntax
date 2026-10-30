import type { SemanticProviderKind } from './types';

export type ApprovedSemanticProviderKind = Extract<
  SemanticProviderKind,
  'local' | 'self_hosted' | 'cloud'
>;

/**
 * Provider classes allowed to perform PGS semantic work when a caller supplies
 * the engine EXPLICITLY.
 *
 * `cloud` was added on 2026-10-30, by the owner. The reason is hosting rather
 * than preference: a 24/7 self-hosted Ollama service needs a server that does
 * not exist, and `18-pgs-web-service.md` §2 had already worked out that an
 * always-on worker breaches the £10-per-member ceiling at low member counts —
 * £15 at twenty members against a £10 limit. Token billing scales to zero, so
 * the ceiling holds at launch scale. The consuming portal already sends
 * member-entered text to a model provider for its chatbot, so this is
 * consistency with a posture already in use rather than a new one.
 *
 * ── WHAT DID NOT CHANGE, AND MUST NOT ─────────────────────────────────────
 * Read the documents closely and two distinct rules were doing the work here.
 * Only one of them moved.
 *
 *  1. NO FALLBACK TO CLOUD. `registry.ts` filters cloud providers out of
 *     `determineLocalFirst` and refuses to reach for one when a local engine
 *     fails. That rule is untouched, and this function is not used there. An
 *     engine reached BECAUSE something else broke is not a deployment
 *     decision — it is a surprise, and surprises about where member text goes
 *     are the thing worth forbidding.
 *
 *  2. NO PROVIDER SELECTED BY REQUEST DATA. There is no field in
 *     `SemanticRequest`, and none may be added, that names a provider. The
 *     deployment chooses; the caller and the member never do.
 *
 * So what is approved here is one thing: an engine a deployment configured on
 * purpose and can name. `custom` is still refused, because an unclassified
 * provider is exactly the case these rules exist to catch.
 *
 * ── HONEST LABELLING IS PART OF THE PERMISSION ────────────────────────────
 * `18-pgs-web-service.md` §4 forbids labelling a configurable remote URL
 * `local`. The same honesty forbids an API-backed engine reporting
 * `self_hosted`. A cloud engine says `cloud`, so anything downstream that
 * cares — a member-facing promise, a privacy notice, an audit — reads the
 * truth rather than a comfortable word.
 *
 * Fidelity is unaffected either way. The gate is deterministic and runs here,
 * not in the model, so a cloud engine is no freer to invent an actor, motive,
 * date, quantity, evidence or certainty than a local one.
 */
export function isApprovedSemanticProviderKind(
  kind: SemanticProviderKind,
): kind is ApprovedSemanticProviderKind {
  return kind === 'local' || kind === 'self_hosted' || kind === 'cloud';
}
