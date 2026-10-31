/**
 * The one place a model is allowed to author wording.
 *
 * `renderRecommendations` derives PGS-L1 and PGS-L2 deterministically from the
 * source. This renders PGS-L3-natural by asking the configured semantic engine
 * for a wording — and then refuses to hand it on unless it survives the same
 * deterministic fidelity comparison a human's rewrite is put through.
 *
 * ── FOUR GATES, IN THIS ORDER ────────────────────────────────────────────
 *
 * 1. CAPABILITY. An engine that does not advertise `rendering`, or has no
 *    `render`, produces no L3 recommendation at all — not a withheld one.
 *    Absence means "not offered", which is what every existing caller sees,
 *    and silence is the correct answer when nothing was ever going to be
 *    generated.
 *
 * 2. EXC-008. Instrument text is withheld before the engine is called, so a
 *    deed is never sent anywhere to be rewritten. The markers that caused it
 *    are named in the reason, because a drafter is owed the reason.
 *
 * 3. THE ENGINE'S OWN REPORT. `RenderResponse.protectedContentPreserved` is
 *    the renderer stating whether it kept protected content. When it says no,
 *    that is believed and the wording is withheld. An engine admitting a
 *    failure is better evidence than a comparator inferring one.
 *
 * 4. FIDELITY. `compareFidelity` — the same function `compare()` exposes and
 *    the portal's rewrite check already uses. `blocked` withholds the text.
 *    `review_required` keeps it but carries the issues along, because the
 *    engine cannot establish equivalence either way and the reader is the one
 *    who knows what they meant.
 *
 * A thrown render is caught and reported, never propagated: a generated
 * wording is an addition to the result, and losing it must not cost the caller
 * the analysis they would otherwise have had.
 */

import { compareFidelity } from '../core/fidelity';
import type { PropositionRelation } from '../analyser/document';
import type { PgsProposition } from '../core/types';
import type { SemanticContext, SemanticDetermination, SemanticEngine } from '../semantic/types';
import { instrumentMarkers, readsAsInstrument } from './instrument';
import type { Recommendation } from './recommendations';

export interface GeneratedOutcome {
  /** Absent when the engine cannot render; a withheld recommendation otherwise. */
  recommendation?: Recommendation;
  /** Set when `render` threw. Reported like `semanticError`, never thrown on. */
  error?: string;
}

export interface GenerateRequest {
  source: string;
  engine: SemanticEngine;
  propositions: PgsProposition[];
  relations: PropositionRelation[];
  context?: SemanticContext;
  /**
   * The determination layer's output, for the affirmative path below.
   *
   * The model is instructed to copy propositions unchanged and express all
   * analysis in determinations, so `desiredState` arrives here and never on a
   * proposition. Nothing bridges the two, which is why this is a separate
   * field rather than a property read off `propositions`.
   */
  determinations?: SemanticDetermination[];
}

/**
 * The affirmative restatement of a non-necessary negation, when the
 * determination layer found one.
 *
 * `docs/20` measured why this is the whole feature: PGS exists to let someone
 * state what was absent from an order on a factual basis, and nothing asked
 * the model for that form until `d51c29d`. The model now returns it as a
 * `desiredState` determination — "The second item is absent from the
 * delivery." — and this is what carries it to a reader.
 *
 * ONLY where the negation is not necessary. `necessary` is decided
 * deterministically (`src/parser/proposition.ts`, `src/analyser/document.ts`),
 * so "I do not consent to this." carries `necessary: true` from the protected
 * legal domain and never reaches here. That the safety case is settled without
 * a model judgement is the reason this path can exist at all.
 */
function affirmativeFromDeterminations(
  propositions: PgsProposition[],
  determinations: SemanticDetermination[] | undefined,
): string | undefined {
  if (!determinations?.length) return undefined;
  for (const proposition of propositions) {
    if (!proposition.negation?.present || proposition.negation.necessary === true) continue;
    const determined = determinations.find(
      item =>
        item.field === 'desiredState' &&
        item.status === 'determined' &&
        (item.propositionId === undefined || item.propositionId === proposition.id) &&
        typeof item.value === 'string' &&
        item.value.trim().length > 0,
    );
    if (!determined) continue;
    const value = (determined.value as string).trim();
    // The library composes the sentence; the determination supplies the state.
    const sentence = `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
    return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
  }
  return undefined;
}

const withheld = (reason: string, ruleIds: string[] = []): Recommendation => ({
  level: 'PGS-L3-natural',
  withheldReason: reason,
  ruleIds,
  supportingFields: [],
});

/** "“this Deed”, “hereby declares”" — for the withholding reason. */
const quoteMarkers = (source: string): string =>
  [...new Set(instrumentMarkers(source).map(marker => marker.matched))]
    .slice(0, 4)
    .map(marker => `“${marker}”`)
    .join(', ');

export async function generateRecommendation({
  source,
  engine,
  propositions,
  relations,
  context,
  determinations,
}: GenerateRequest): Promise<GeneratedOutcome> {
  // 1. Capability.
  if (!engine.capabilities.rendering || typeof engine.render !== 'function') return {};

  // 2. EXC-008, before the engine sees the text.
  if (readsAsInstrument(source)) {
    return {
      recommendation: withheld(
        `This reads as the operative text of a legal instrument (${quoteMarkers(source)}), ` +
          'so no wording is generated for it. Analysis, scoring and the fidelity check remain available.',
        ['EXC-008'],
      ),
    };
  }

  /**
   * 2b. THE AFFIRMATIVE PATH, before the engine is asked to write anything.
   *
   * Composed from a `desiredState` determination rather than free prose, so
   * this costs no second model call and the wording is bounded by a field a
   * person can read in the ledger beside it.
   *
   * ── WHY IT IS OFFERED AND NOT WITHHELD ──────────────────────────────────
   *
   * `compareFidelity` blocks every affirmative restatement with
   * `FIDELITY_NEGATION_REMOVED`, and blocks the faithful ones exactly as hard
   * as the inverted ones — measured 2026-10-31 over four restatements and two
   * inversions, six blocks. It keys on the negation TOKEN being absent, and
   * its authorised exceptions (`verifiedConditionalReframe`, EXC-009) are
   * structural proofs, not model attestations. "The delivery did not include
   * the second item." -> "The second item is absent from the delivery."
   * cannot be proved that way: `include` and `absent` are antonyms with
   * swapped arguments, and no structural invariant reaches it.
   *
   * So rule 7 is more general than the comparator can certify, and the three
   * ways out are to offer it unverified, to certify only a provable class, or
   * to let a determination authorise the removal. The owner chose the first on
   * 2026-10-31: offer the wording with its issues attached so the member — who
   * wrote the sentence and can judge whether it still says what they meant —
   * decides. It certifies nothing and discloses everything.
   *
   * This needs no new contract. `Recommendation` already documents `text` plus
   * `fidelityIssues` as "the wording is offered and these are the reasons to
   * read it carefully", and the portal's `SemanticRewrite` says the same, so
   * the panel that renders it already exists.
   *
   * NEGATION REMOVAL ONLY. Any other blocking issue — an invented actor, a
   * dropped condition, a changed quantity — still withholds. The determination
   * authorises restating a negation affirmatively and nothing else, so an
   * affirmative candidate that also invents something is withheld like any
   * other wording that does.
   */
  const affirmative = affirmativeFromDeterminations(propositions, determinations);
  if (affirmative) {
    const comparison = compareFidelity(source, affirmative, context);
    const beyondNegation = comparison.issues.filter(
      issue => issue.code !== 'FIDELITY_NEGATION_REMOVED',
    );
    const blocking = beyondNegation.filter(issue => issue.severity === 'blocked');
    const base = {
      level: 'PGS-L3-natural' as const,
      ruleIds: ['PGS-007'],
      supportingFields: ['P1.desiredState', 'P1.negation'],
    };
    if (blocking.length) {
      return {
        recommendation: {
          ...base,
          withheldReason:
            'The affirmative wording changed more than the negation, so it is withheld.',
          fidelityIssues: comparison.issues,
        },
      };
    }
    return {
      recommendation: {
        ...base,
        text: affirmative,
        ...(comparison.issues.length ? { fidelityIssues: comparison.issues } : {}),
      },
    };
  }

  let rendered: Awaited<ReturnType<NonNullable<SemanticEngine['render']>>>;
  try {
    rendered = await engine.render({
      source,
      propositions,
      relations,
      level: context?.level ?? 'L3-natural',
      ...(context ? { context } : {}),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  const text = rendered.text?.trim() ?? '';
  if (!text) return { recommendation: withheld('The engine returned no wording.') };

  // 3. The engine's own report.
  if (!rendered.protectedContentPreserved) {
    return {
      recommendation: withheld(
        'The engine reported that protected content was not preserved in its wording.',
        rendered.ruleTrace ?? [],
      ),
    };
  }

  // 4. Fidelity, deterministically, on what came back.
  const comparison = compareFidelity(source, text, context);
  const base = {
    level: 'PGS-L3-natural' as const,
    ruleIds: rendered.ruleTrace ?? [],
    supportingFields: [`engine:${engine.id}`],
  };

  if (comparison.status === 'blocked') {
    return {
      recommendation: {
        ...base,
        withheldReason: 'The generated wording changed the meaning of the source, so it is withheld.',
        fidelityIssues: comparison.issues,
      },
    };
  }

  return {
    recommendation: {
      ...base,
      text,
      ...(comparison.issues.length ? { fidelityIssues: comparison.issues } : {}),
    },
  };
}
