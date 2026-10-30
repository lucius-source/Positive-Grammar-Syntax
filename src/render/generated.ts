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
import type { SemanticContext, SemanticEngine } from '../semantic/types';
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
