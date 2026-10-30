import type { SemanticContext } from '../semantic/types';
import { analyseDocument } from '../analyser/document';
import { evidenceIsSufficient } from '../resolution/ledger';

export type FidelityIssueSeverity = 'review_required' | 'blocked';
export interface FidelityIssue { code: string; severity: FidelityIssueSeverity; message: string; evidence?: string }
export interface FidelityComparison { status: 'pass' | 'review_required' | 'blocked'; issues: FidelityIssue[] }

/**
 * Negation, including the contractions people actually type.
 *
 * ── WHY THIS LIST GREW, 2026-10-30 ───────────────────────────────────────
 *
 * It read `don't|can't|won't|…` — apostrophes required — and listed neither
 * `haven't` nor `couldn't` at all. A negation the comparator cannot see is
 * one it cannot protect, so **meaning reversals passed as `pass`**:
 *
 *   "I dont like government interference."  ->  "I like government interference."
 *   "I havent signed it."                   ->  "I have signed it."
 *   "It hasn't arrived."                    ->  "It has arrived."
 *
 * Measured over 34 pairs that each reverse the meaning, 22 were not blocked.
 * That is `preserve_necessary_negation`, invariant two, failing silently on
 * the single most common typo in informal writing — in a comparator whose
 * entire input is informal writing.
 *
 * `n'?t` is the fix rather than a second list: it matches `n't` and `nt` from
 * one pattern, so the two spellings cannot drift apart again.
 *
 * KNOWN COST, accepted deliberately. `cant` (jargon, or a tilt) and `wont`
 * (as in "as is his wont") are real words, and this reads them as negations.
 * The consequence is a legitimate rewrite blocked and read by a person; the
 * consequence of the omission was a reversed meaning delivered as "your
 * meaning survived". Those are not comparable.
 */
/*
  The stems are what precedes `n't`, which is NOT always the whole word:
  `can't` is `ca`, `won't` is `wo`, `shan't` is `sha`, `ain't` is `ai`.
  Writing `can` here spells `cann't` and silently drops `can't` — which is
  exactly what the first attempt did, and what the 34-pair probe caught.
*/
const NEGATION = /\b(?:not|no|never|cannot|(?:do|does|did|is|are|was|were|wo|would|should|must|ca|could|have|has|had|sha|need|dare|ought|ai)n'?t)\b/gi;
const HEDGES = /\b(?:may|might|could|maybe|perhaps|possibly|uncertain|believe|think|assume|allege)\b/gi;
/**
 * Evidential framing — `preserve_evidential_framing`, accepted 2026-10-30.
 *
 * `HEDGES` above is epistemic modality and mental-state verbs. It is not
 * evidentiality: the marking of a proposition as REPORTED or DECIDED rather
 * than asserted. "It has been decided that X" does not claim X, it claims
 * that someone unnamed decided X, and a candidate asserting X has changed who
 * is making the claim. docs/18 has the measurement and the limits.
 *
 * No `g` flag. This is used with `test` and `exec` rather than `match`, and a
 * global regex carries `lastIndex` between calls — which would make the same
 * comparison answer differently depending on what was compared before it.
 *
 * The FRAME is required, never the bare verb: "we decided to close the
 * account" is an assertion by a named actor and must not match.
 */
const EVIDENTIAL_FRAME =
  /\b(?:it\s+(?:has\s+been|had\s+been|was|is)\s+(?:decided|agreed|determined|concluded|resolved|found|held|understood|reported|alleged|suggested|arranged|confirmed)\s+that|(?:a|the)\s+decision\s+(?:has\s+been|had\s+been|was)\s+(?:made|taken)|(?:i|we)\s+(?:am|are|was|were|have\s+been|has\s+been)\s+(?:told|advised|informed)\s+that|it\s+(?:is|was)\s+(?:believed|thought|said|anticipated|expected)\s+that)\b/i;
const STRONG_CERTAINTY = /\b(?:will|must|definitely|certainly|obviously|undoubtedly|know|known)\b/gi;
const CONDITION = /\b(?:if|unless|provided that|only if)\b/gi;
const MONTH = '(?:january|february|march|april|may|june|july|august|september|october|november|december)';
const TEMPORAL = new RegExp(`\\b(?:today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|${MONTH}\\s+\\d{1,2}(?:,\\s*\\d{4})?|\\d{1,2}\\s+${MONTH}(?:\\s+\\d{4})?|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4})\\b`, 'gi');
const QUANTITY = /(?:£|\$|€)?\d+(?:[.,]\d+)?|\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\b/gi;
const ACTOR = /\b(?:i|me|my|mine|we|us|our|ours|you|your|yours|he|him|his|she|her|hers|they|them|their|theirs|supplier|claimant|recipient|sender|buyer|seller|employer|employee|court)\b/gi;
const ACTION = /\b(?:send|sent|receive|received|confirm|confirmed|sign|signed|disclose|disclosed|energise|energised|take|took|pay|paid|proceed|proceeded|review|reviewed|reconcile|reconciled|submit|submitted|reply|respond|ignore|ignored)\b/gi;
const MOTIVE = /\b(?:deliberately|intentionally|on purpose|chose to|wanted to)\b/gi;
const EVIDENCE_CLAIM = /\b(?:evidence (?:shows?|proves?|confirms?)|records? (?:shows?|proves?|confirms?)|documents? (?:shows?|proves?|confirms?)|according to (?:the )?(?:evidence|records?|documents?))\b/gi;
const MODAL = /\b(?:mustn't|must not|must|shouldn't|should not|should|shall|may|might|could|can't|cannot|can|won't|will not|will|wouldn't|would not|would|(?:do not|does not|don't|doesn't) (?:currently )?have (?:the )?capability|not (?:currently )?able to|(?:assess(?:ed)? )?a risk of|risk of)\b/gi;

function terms(text: string, pattern: RegExp): Set<string> {
  return new Set((text.match(pattern) ?? []).map(item => item.toLowerCase()));
}

function missing(required: Set<string>, candidate: Set<string>): string[] {
  return [...required].filter(item => !candidate.has(item));
}

function normalizedModalities(text: string): Set<string> {
  const normalize: Record<string, string> = {
    "mustn't": 'must', 'must not': 'must', must: 'must', shall: 'shall',
    "shouldn't": 'should', 'should not': 'should', should: 'should',
    may: 'may', might: 'might', could: 'could', "can't": 'can', cannot: 'can', can: 'can',
    "won't": 'will', 'will not': 'will', will: 'will', "wouldn't": 'would', 'would not': 'would', would: 'would',
  };
  return new Set([...terms(text, MODAL)].map(item => /capability|able to/.test(item) ? 'can' : /risk of/.test(item) ? 'could' : (normalize[item] ?? item)));
}

const ACTION_FAMILY: Record<string, string> = { make: 'error_creation', commit: 'error_creation', listen: 'attention', hear: 'attention', complete: 'completion', do: 'completion' };
const actionFamily = (action: string) => ACTION_FAMILY[action] ?? action;

function pirFields(text: string): { actions: Set<string>; actors: Set<string> } {
  const propositions = analyseDocument(text).document.propositions;
  return {
    actions: new Set(propositions.flatMap(item => item.actionOrRelation ? [actionFamily(item.actionOrRelation)] : [])),
    actors: new Set(propositions.flatMap(item => typeof item.actor === 'string' ? [item.actor.toLowerCase()] : [])),
  };
}

function unionPirFields(texts: string[]): { actions: Set<string>; actors: Set<string> } {
  const actions = new Set<string>();
  const actors = new Set<string>();
  for (const text of texts.filter(item => item.trim())) {
    const fields = pirFields(text);
    for (const action of fields.actions) actions.add(action);
    for (const actor of fields.actors) actors.add(actor);
    if (/\b(?:i|me|my|mine)\b/i.test(text)) actors.add('speaker');
    if (/\b(?:we|us|our|ours)\b/i.test(text)) actors.add('speakers');
    if (/\b(?:you|your|yours)\b/i.test(text)) actors.add('addressee');
  }
  return { actions, actors };
}

function deterministicTemporalEdges(text: string): Set<string> {
  const analysis = analyseDocument(text);
  const propositions = new Map(analysis.document.propositions.map(proposition => [proposition.id, proposition]));
  const edges = new Set<string>();
  for (const relation of analysis.relations) {
    if (relation.type !== 'temporal_sequence' || relation.confidence !== 'deterministic') continue;
    const from = propositions.get(relation.from);
    const to = propositions.get(relation.to);
    if (!from?.actionOrRelation || !to?.actionOrRelation) continue;
    edges.add(`${from.actor ?? 'unknown'}:${actionFamily(from.actionOrRelation)} -> ${to.actor ?? 'unknown'}:${actionFamily(to.actionOrRelation)}`);
  }
  return edges;
}

function unionTemporalEdges(texts: string[]): Set<string> {
  const edges = new Set<string>();
  for (const text of texts.filter(item => item.trim())) {
    for (const edge of deterministicTemporalEdges(text)) edges.add(edge);
  }
  return edges;
}

function verifiedConditionalReframe(source: string, candidate: string): boolean {
  const sourceAnalysis = analyseDocument(source);
  const candidateAnalysis = analyseDocument(candidate);
  const sourceRelation = sourceAnalysis.relations.find(item => item.type === 'condition');
  const candidateRelation = candidateAnalysis.relations.find(item => item.type === 'condition');
  if (!sourceRelation || !candidateRelation || !/^if$/i.test(sourceRelation.marker ?? '') || !/^only if$/i.test(candidateRelation.marker ?? '')) return false;
  if (sourceAnalysis.document.propositions.length !== 2 || candidateAnalysis.document.propositions.length !== 2) return false;
  if (!sourceAnalysis.document.propositions.every(item => item.negation?.present) || candidateAnalysis.document.propositions.some(item => item.negation?.present)) return false;
  const sourceActions = pirFields(source).actions;
  const candidateActions = pirFields(candidate).actions;
  return missing(sourceActions, candidateActions).length === 0 && missing(candidateActions, sourceActions).length === 0
    && missing(terms(source, TEMPORAL), terms(candidate, TEMPORAL)).length === 0;
}

/**
 * Verbs whose meaning IS sentential negation of their complement.
 *
 * Deliberately tiny, and `refuse` is deliberately absent. "Fail to send" means
 * "not send", so "did not fail to send" means "sent". "Refuse to attend" means
 * "declined to attend", which is NOT "not attend" — you can fail to attend
 * without refusing, and not refusing does not mean you went. Every verb added
 * here must satisfy `V to X` ≡ `not X` exactly, or EXC-009 starts certifying
 * inferences instead of equivalences.
 */
const NEGATIVE_VERB = /\b(?:fail(?:s|ed|ing)?|neglect(?:s|ed|ing)?|omit(?:s|ted|ting)?|forget(?:s|ting)?|forgot(?:ten)?)\s+to\b/gi;

/**
 * Where parity reasoning is not sound.
 *
 * "Not all balances are addressed" and "all balances are unaddressed" have the
 * same negation count and opposite meanings, because negation and a universal
 * quantifier do not commute. Rather than model scope, EXC-009 refuses.
 */
const SCOPE_SENSITIVE = /\b(?:not\s+(?:all|every|any|both|each)|(?:all|every|each|both)\b[^.?!]{0,40}\bnot)\b/i;

/** Occurrences, NOT unique terms: "not … not" is two negations and cancels. */
function countMatches(text: string, pattern: RegExp): number {
  return (text.match(new RegExp(pattern.source, pattern.flags)) ?? []).length;
}

/** Even means the proposition asserts; odd means it denies. */
function negationParity(text: string): number {
  return (countMatches(text, NEGATION) + countMatches(text, NEGATIVE_VERB)) % 2;
}

const sameField = (a?: string | null, b?: string | null): boolean =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

/**
 * EXC-009: is this negation change a verified double-negation elimination?
 *
 * Three things must hold together, and each stops a different failure. Parity
 * catches "did not fail to send" ≡ "sent" while rejecting "have not received"
 * → "received". The core comparison stops parity from certifying two unrelated
 * sentences that happen to agree modulo two. The scope guard refuses the
 * quantifier cases parity cannot reason about.
 *
 * THE CORE MUST BE VISIBLE, not merely equal. PGS extracts actions from a
 * closed lexicon, so for most sentences `actionOrRelation` is undefined — and
 * two undefineds comparing equal would certify anything. An action PGS cannot
 * see is not a verified one, so an absent action refuses.
 *
 * That is why this fires rarely today. The limit is now parser coverage, which
 * can grow, rather than a blanket refusal, which cannot.
 */
function verifiedDoubleNegation(source: string, candidate: string): boolean {
  /*
    Nothing to certify when the negation did not change. Without this, an
    unchanged sentence satisfies parity and core trivially and every ordinary
    faithful rewrite picks up an EXC-009 note explaining a transformation that
    never happened.
  */
  const sourceMarkers = terms(source, NEGATION);
  const candidateMarkers = terms(candidate, NEGATION);
  if (
    missing(sourceMarkers, candidateMarkers).length === 0
    && missing(candidateMarkers, sourceMarkers).length === 0
  ) return false;

  if (SCOPE_SENSITIVE.test(source) || SCOPE_SENSITIVE.test(candidate)) return false;
  if (negationParity(source) !== negationParity(candidate)) return false;

  const sourcePropositions = analyseDocument(source).document.propositions;
  const candidatePropositions = analyseDocument(candidate).document.propositions;
  if (sourcePropositions.length !== 1 || candidatePropositions.length !== 1) return false;

  const from = sourcePropositions[0];
  const to = candidatePropositions[0];
  if (!from?.actionOrRelation || !to?.actionOrRelation) return false;

  return sameField(from.actionOrRelation, to.actionOrRelation)
    && sameField(from.actor, to.actor)
    && sameField(from.objectOrTarget, to.objectOrTarget);
}

function verifiedUnknownActorReframe(source: string, candidate: string): boolean {
  const propositions = analyseDocument(source).document.propositions;
  return propositions.length === 1
    && propositions[0]?.actor === null
    && ['make', 'commit'].includes(propositions[0]?.actionOrRelation ?? '')
    && /\b(?:mistakes|errors)\b/i.test(source)
    && /^The actor responsible for the errors is not identified\.$/i.test(candidate.trim());
}

export function compareFidelity(source: string, candidate: string, context?: SemanticContext): FidelityComparison {
  const authorisedTexts = [source, ...(context?.knownFacts ?? []), context?.userIntent ?? '', ...(context?.referenceBindings ?? []).map(item => item.entity), ...(context?.evidence ?? []).filter(item => evidenceIsSufficient(item.field, item)).map(item => item.statement)];
  const authorised = authorisedTexts.join(' ');
  const issues: FidelityIssue[] = [];
  const add = (issue: FidelityIssue) => issues.push(issue);
  const conditionalReframe = verifiedConditionalReframe(source, candidate);
  const unknownActorReframe = verifiedUnknownActorReframe(source, candidate);
  // EXC-009. Claims EQUIVALENCE, so it suppresses both directions: the same
  // verification that makes "did not fail to send" → "sent" safe makes
  // "neglected to tell" → "did not tell" safe, and one-way suppression would
  // be an asymmetry with no reason behind it.
  const doubleNegation = verifiedDoubleNegation(source, candidate);

  const sourceNegation = terms(source, NEGATION);
  const candidateNegation = terms(candidate, NEGATION);
  if (sourceNegation.size && candidateNegation.size === 0 && !conditionalReframe && !doubleNegation) {
    add({ code: 'FIDELITY_NEGATION_REMOVED', severity: 'blocked', message: 'Candidate removes source negation; logical equivalence is not established.', evidence: [...sourceNegation].join(', ') });
  }
  if (!terms(authorised, NEGATION).size && candidateNegation.size && !unknownActorReframe && !doubleNegation) {
    add({ code: 'FIDELITY_NEGATION_INVENTED', severity: 'blocked', message: 'Candidate introduces negation absent from source and verified context.', evidence: [...candidateNegation].join(', ') });
  }
  // review_required, never pass: structural verification is evidence that the
  // parity and the core agree, not a semantic guarantee that they mean the
  // same thing. The reader is told what was checked and decides.
  if (doubleNegation) add({ code: 'FIDELITY_NEGATION_EQUIVALENT', severity: 'review_required', message: 'Candidate changes negation in a structurally verified double-negation elimination (EXC-009); final semantic review remains required.' });
  if (conditionalReframe) add({ code: 'FIDELITY_CONDITION_EQUIVALENT', severity: 'review_required', message: 'Candidate uses a structurally verified only-if contraposition; final semantic review remains required.' });

  const sourceConditions = terms(source, CONDITION);
  const candidateConditions = terms(candidate, CONDITION);
  if (sourceConditions.size && candidateConditions.size === 0) {
    add({ code: 'FIDELITY_CONDITION_REMOVED', severity: 'blocked', message: 'Candidate removes a source condition.', evidence: [...sourceConditions].join(', ') });
  }
  const inventedConditions = conditionalReframe ? [] : missing(candidateConditions, terms(authorised, CONDITION));
  if (inventedConditions.length) add({ code: 'FIDELITY_CONDITION_INVENTED', severity: 'blocked', message: 'Candidate introduces an unauthorised condition.', evidence: inventedConditions.join(', ') });

  for (const [pattern, code, label] of [[QUANTITY, 'FIDELITY_QUANTITY_REMOVED', 'quantity'], [TEMPORAL, 'FIDELITY_TIME_REMOVED', 'time']] as const) {
    const absent = missing(terms(source, pattern), terms(candidate, pattern));
    if (absent.length) add({ code, severity: 'blocked', message: `Candidate removes or changes source ${label} content.`, evidence: absent.join(', ') });
    const additions = missing(terms(candidate, pattern), terms(authorised, pattern));
    if (additions.length) add({ code: code.replace('REMOVED', 'INVENTED'), severity: 'blocked', message: `Candidate introduces unauthorised ${label} content.`, evidence: additions.join(', ') });
  }

  const sourceTemporalEdges = deterministicTemporalEdges(source);
  const candidateTemporalEdges = deterministicTemporalEdges(candidate);
  const changedTemporalEdges = missing(sourceTemporalEdges, candidateTemporalEdges);
  if (changedTemporalEdges.length) {
    add({ code: 'FIDELITY_TEMPORAL_ORDER_CHANGED', severity: 'blocked', message: 'Candidate removes or reverses an explicitly established event order.', evidence: changedTemporalEdges.join(', ') });
  }
  const inventedTemporalEdges = missing(candidateTemporalEdges, unionTemporalEdges(authorisedTexts));
  if (inventedTemporalEdges.length) {
    add({ code: 'FIDELITY_TEMPORAL_ORDER_INVENTED', severity: 'blocked', message: 'Candidate introduces an event order absent from source and verified context.', evidence: inventedTemporalEdges.join(', ') });
  }

  const sourceHedges = terms(source, HEDGES);
  if (sourceHedges.size && terms(candidate, HEDGES).size === 0 && terms(candidate, STRONG_CERTAINTY).size > 0) {
    add({ code: 'FIDELITY_CERTAINTY_UPGRADED', severity: 'blocked', message: 'Candidate upgrades hedged language to stronger certainty.' });
  }

  /*
    `preserve_evidential_framing`. review_required rather than blocked, by the
    owner's decision of 2026-10-30: the loss is pragmatic rather than a flat
    contradiction, and the comparator cannot tell a careless flattening from a
    deliberate one. So it shows the reader what moved and lets them judge —
    the posture EXC-009 takes for a verified negation change.
  */
  const sourceFrame = EVIDENTIAL_FRAME.exec(source);
  if (sourceFrame && !EVIDENTIAL_FRAME.test(candidate)) {
    add({
      code: 'FIDELITY_FRAMING_REMOVED',
      severity: 'review_required',
      message: 'Candidate removes a frame attributing the statement to someone else; the source reports it and the candidate asserts it directly.',
      evidence: sourceFrame[0].trim(),
    });
  }

  const inventedMotive = missing(terms(candidate, MOTIVE), terms(authorised, MOTIVE));
  if (inventedMotive.length) add({ code: 'FIDELITY_MOTIVE_INVENTED', severity: 'blocked', message: 'Candidate introduces motive or intention absent from source and sufficient evidence.', evidence: inventedMotive.join(', ') });

  const inventedEvidence = missing(terms(candidate, EVIDENCE_CLAIM), terms(authorised, EVIDENCE_CLAIM));
  if (inventedEvidence.length) add({ code: 'FIDELITY_EVIDENCE_INVENTED', severity: 'blocked', message: 'Candidate introduces an evidential basis absent from source and sufficient evidence.', evidence: inventedEvidence.join(', ') });

  const sourceModalities = normalizedModalities(source);
  if (sourceModalities.size && !conditionalReframe) {
    const changedModalities = missing(sourceModalities, normalizedModalities(candidate));
    if (changedModalities.length) add({ code: 'FIDELITY_MODALITY_CHANGED', severity: 'blocked', message: 'Candidate removes or changes source modality without established equivalence.', evidence: changedModalities.join(', ') });
  }

  for (const protectedTerm of context?.protectedTerms ?? []) {
    if (protectedTerm.trim() && !candidate.toLowerCase().includes(protectedTerm.trim().toLowerCase())) {
      add({ code: 'FIDELITY_PROTECTED_TERM_REMOVED', severity: 'blocked', message: 'Candidate removes a user-protected term.', evidence: protectedTerm });
    }
  }

  const authorisedActors = terms(authorised, ACTOR);
  if (/\b(?:my|me|mine)\b/i.test(source)) for (const actor of ['i', 'me', 'my', 'mine']) authorisedActors.add(actor);
  if (terms(source, HEDGES).size || /\b(?:obviously|going to fail)\b/i.test(source)) authorisedActors.add('i');
  const newActors = missing(terms(candidate, ACTOR), authorisedActors);
  if (newActors.length) add({ code: 'FIDELITY_ACTOR_INVENTED', severity: 'blocked', message: 'Candidate introduces an actor absent from source and verified context.', evidence: newActors.join(', ') });

  /*
    `ACTION` matches surface forms, so "send" and "sent" are different terms
    and "I did not fail to send it." → "I sent it." reads as an INVENTED
    action. Under EXC-009 that conclusion is already known to be wrong:
    `verifiedDoubleNegation` compared the PARSED `actionOrRelation` of both
    propositions and found the same lemma. The parser's normalised action is
    better evidence than a tense difference in a regex, so the verified case
    defers to it. Everything outside EXC-009 is unchanged.
  */
  const newActions = doubleNegation ? [] : missing(terms(candidate, ACTION), terms(authorised, ACTION));
  if (newActions.length) add({ code: 'FIDELITY_ACTION_INVENTED', severity: 'blocked', message: 'Candidate introduces an action absent from source and verified context.', evidence: newActions.join(', ') });

  const sourcePir = pirFields(source);
  const candidatePir = pirFields(candidate);
  const authorisedPir = unionPirFields(authorisedTexts);
  if (terms(source, HEDGES).size || /\b(?:obviously|going to fail)\b/i.test(source)) authorisedPir.actors.add('speaker');
  const inventedPirActors = conditionalReframe ? [] : missing(candidatePir.actors, authorisedPir.actors);
  if (inventedPirActors.length && !issues.some(issue => issue.code === 'FIDELITY_ACTOR_INVENTED')) {
    add({ code: 'FIDELITY_ACTOR_INVENTED', severity: 'blocked', message: 'Candidate PIR introduces an actor absent from source and verified context.', evidence: inventedPirActors.join(', ') });
  }
  const inventedPirActions = conditionalReframe ? [] : missing(candidatePir.actions, authorisedPir.actions);
  if (inventedPirActions.length && !issues.some(issue => issue.code === 'FIDELITY_ACTION_INVENTED')) {
    add({ code: 'FIDELITY_ACTION_INVENTED', severity: 'blocked', message: 'Candidate PIR introduces an action or relation absent from source and verified context.', evidence: inventedPirActions.join(', ') });
  }
  const omittedActions = missing(sourcePir.actions, candidatePir.actions);
  if (omittedActions.length) add({ code: 'FIDELITY_PIR_ACTION_OMITTED', severity: 'review_required', message: 'Candidate PIR does not explicitly retain every source action or relation; semantic equivalence requires review.', evidence: omittedActions.join(', ') });
  const omittedActors = missing(sourcePir.actors, candidatePir.actors);
  if (omittedActors.length) add({ code: 'FIDELITY_PIR_ACTOR_OMITTED', severity: 'review_required', message: 'Candidate PIR does not explicitly retain every known source actor; semantic equivalence requires review.', evidence: omittedActors.join(', ') });

  const status = issues.some(issue => issue.severity === 'blocked') ? 'blocked'
    : issues.some(issue => issue.severity === 'review_required') ? 'review_required' : 'pass';
  return { status, issues };
}
