import type { SemanticContext } from '../semantic/types';
import type { PgsProposition } from '../core/types';

export interface Recommendation {
  level: 'PGS-L1' | 'PGS-L2';
  text?: string;
  withheldReason?: string;
  ruleIds: string[];
  supportingFields: string[];
}

function asSentence(text: string): string {
  const clean = text.trim();
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

function applyBindings(source: string, context?: SemanticContext): string {
  let result = source;
  for (const binding of context?.referenceBindings ?? []) {
    const reference = binding.reference.trim();
    const entity = binding.entity.trim();
    if (!reference || !entity || !/^(?:they|he|she|it)$/i.test(reference)) continue;
    result = result.replace(new RegExp(`\\b${reference}\\b`, 'gi'), entity);
  }
  return result;
}

function naturalL1(source: string, hasMotive: boolean, propositions: PgsProposition[]): { text: string; ruleIds: string[]; supportingFields: string[] } {
  const clean = source.trim();
  const proposition = propositions[0];
  const consequent = propositions[1];
  if (propositions.length === 2 && proposition?.actionOrRelation === 'receive' && consequent?.actionOrRelation === 'proceed'
    && proposition.negation?.present && consequent.negation?.present && proposition.time?.deadline && proposition.objectOrTarget) {
    const consequenceSubject = consequent.sourceSpan.match(/^(.+?)\s+won't\s+proceed/i)?.[1]?.trim();
    const originalDeadline = proposition.sourceSpan.match(/\bby\s+([^\s,.]+)/i)?.[1] ?? proposition.time.deadline;
    if (consequenceSubject) {
      const subject = `${consequenceSubject.charAt(0).toUpperCase()}${consequenceSubject.slice(1)}`;
      return { text: `${subject} proceeds only if ${proposition.objectOrTarget} is received by ${originalDeadline}.`, ruleIds: ['PGS-004', 'PGS-007'], supportingFields: ['P1.actionOrRelation', 'P1.objectOrTarget', 'P1.time.deadline', 'P1.negation', 'P2.actionOrRelation', 'P2.negation', 'relation.condition'] };
    }
  }
  if (proposition?.actor === null && ['make', 'commit'].includes(proposition.actionOrRelation ?? '') && /\b(?:mistakes|errors)\b/i.test(clean)) {
    return { text: 'The actor responsible for the errors is not identified.', ruleIds: ['PGS-001'], supportingFields: ['P1.actor=null', 'P1.actionOrRelation', 'P1.objectOrTarget'] };
  }
  if (proposition?.actor === 'addressee' && proposition.actionOrRelation === 'listen' && /\bnever\b/i.test(clean)) {
    return { text: 'I believe my points are not being fully heard.', ruleIds: ['PGS-002', 'PGS-005'], supportingFields: ['P1.actor', 'P1.actionOrRelation', 'P1.negation'] };
  }
  if (proposition?.actor === 'speaker' && proposition.actionOrRelation === 'complete' && proposition.negation?.present && /\byet\b/i.test(clean)) {
    return { text: 'I do not currently have the capability to complete this.', ruleIds: ['PGS-003', 'PGS-005'], supportingFields: ['P1.actor', 'P1.actionOrRelation', 'P1.negation', 'P1.objectOrTarget'] };
  }
  if (proposition?.actionOrRelation === 'fail' && ['predicted', 'uncertain'].includes(proposition.epistemicStatus)) {
    return { text: 'I assess a risk of failure.', ruleIds: ['PGS-005'], supportingFields: ['P1.actionOrRelation', 'P1.epistemicStatus'] };
  }
  if (/^I (?:do not|don't) consent to this\.?$/i.test(clean)) {
    return { text: 'I do not consent to this.', ruleIds: ['PGS-007'], supportingFields: ['P1.actor', 'P1.actionOrRelation', 'P1.negation', 'P1.speechAct'] };
  }
  /**
   * A global evaluative self-description, calibrated to the task.
   *
   * `evaluativeLabel` in core/rules.ts already detects the whole family —
   * /\b(?:useless|hopeless|worthless)\b/ — and raises PGS-002 ("may combine a
   * present difficulty with a fixed identity claim") and PGS-005 ("a global
   * capability claim requires calibration to the known task"). The renderer
   * matched one exact sentence, so the engine could SAY what was wrong with
   * "I'm hopeless at spreadsheets" and could not rewrite it.
   *
   * What is calibrated is the identity claim, not the difficulty: "useless"
   * asserts a fixed property of the speaker, and the rewrite reduces it to the
   * present task without denying the difficulty or inventing a cause. The
   * object is carried through verbatim — inventing a task the speaker did not
   * name is the one thing this must not do — and only a bare "this" or "it"
   * becomes "this task", because "difficulty with this" does not read as
   * English.
   */
  const evaluativeSelf = clean.match(
    /^I(?:\s+am|['’]m)\s+(?:useless|hopeless|worthless)\s+at\s+(.+?)\.?$/i,
  );
  if (evaluativeSelf?.[1]) {
    const object = evaluativeSelf[1].trim();
    const target = /^(?:this|it)$/i.test(object) ? 'this task' : object;
    return { text: `I am having difficulty with ${target}.`, ruleIds: ['PGS-002', 'PGS-005'], supportingFields: ['P1.actor', 'P1.sourceSpan', 'P1.ambiguity.reference'] };
  }
  if (/^I feel blocked energy around this decision\.?$/i.test(clean)) {
    return { text: 'I experience what I describe as blocked energy around this decision.', ruleIds: ['PGS-005'], supportingFields: ['P1.actor', 'P1.observation', 'P1.domain', 'P1.sourceSpan'] };
  }
  if (/^I (?:do not|don't) disagree\.?$/i.test(clean)) {
    return { text: 'I am not expressing disagreement.', ruleIds: ['PGS-005', 'PGS-007'], supportingFields: ['P1.actor', 'P1.actionOrRelation', 'P1.negation', 'P1.ambiguity.epistemicPosition'] };
  }
  /**
   * A conditional apology, with its condition preserved.
   *
   * `conditionalApology` (/\bsorry\s+if\b/) raises PGS-002: "do not invent an
   * admission or causal fact". That rules out the obvious rewrite — turning
   * "I'm sorry if that upset you" into an apology for having upset them
   * asserts the upset as fact, which is precisely the invention forbidden.
   *
   * So the condition is kept and moved to the front. docs/11 requires
   * "embedded condition preservation for constructions such as conditional
   * apologies", and fronting preserves the proposition exactly while removing
   * the reading in which "sorry" lands first and the condition is heard as a
   * qualifier on it. Truth-conditionally identical; structurally honest.
   */
  const conditionalApology = clean.match(
    /^(?:I(?:\s+am|['’]m)\s+)?sorry\s+if\s+(.+?)\.?$/i,
  );
  if (conditionalApology?.[1]) {
    return { text: `If ${conditionalApology[1].trim()}, I am sorry.`, ruleIds: ['PGS-002'], supportingFields: ['P1.actor', 'P1.speechAct', 'P1.sourceSpan', 'relation.condition'] };
  }

  /**
   * Absolute impossibility, calibrated to what the speaker can see.
   *
   * `absoluteImpossibility` (/\bimpossible\b/) raises PGS-002 (the absolute
   * "may combine a constraint with an interpretation"), PGS-005
   * ("impossibility requires evidence or calibrated personal scope") and
   * PGS-006 ("a proposed range or alternative requires user-supplied
   * context").
   *
   * PGS-006 is the one that shapes this: the rewrite must NOT offer a way
   * round. It reduces a claim about the world to a claim about the speaker's
   * present view, which is what they can actually warrant, and stops there.
   * PGS-006 is deliberately not in `ruleIds` — no alternative is proposed, so
   * claiming the rule would misreport what was done.
   */
  const impossibility = clean.match(
    /^(?:this|that|it)\s+is\s+impossible\s*(?:to\s+(.+?))?\.?$/i,
  );
  if (impossibility) {
    const object = impossibility[1]?.trim();
    return { text: object ? `I do not currently see a way to ${object}.` : 'I do not currently see a way to do this.', ruleIds: ['PGS-002', 'PGS-005'], supportingFields: ['P1.actionOrRelation', 'P1.epistemicStatus', 'P1.sourceSpan'] };
  }

  /**
   * Present inability, beyond the one shape that was handled.
   *
   * `inability` matches can't, cannot, unable and "not (yet) able", and raises
   * PGS-003: "present inability is distinguished from permanent incapability;
   * preserve the actual scope." The structural rule above covers only
   * speaker + complete + "yet"; everything else fell through unrewritten.
   *
   * ── THE GUARD IS THE POINT OF THIS RULE ─────────────────────────────────
   *
   * "Currently" is a softener, and softening is exactly what the charter
   * forbids where the negation is operative: a transformation "must not
   * reverse, soften or remove their operative meaning". `classifyProtectedDomain`
   * treats *consent*, *liable*, *contract* and *notice* as legal, so "I cannot
   * consent to this" is protected — rewriting it to "not currently able"
   * implies a temporary position the speaker did not take, in the one domain
   * where that difference is the whole meaning. A necessary negation is
   * refused for the same reason.
   *
   * Both are left exactly as written, which is the correct outcome rather
   * than a missed one.
   */
  const inability = clean.match(
    /^I\s+(?:can(?:'|’)?t|cannot|can\s+not)\s+(.+?)\.?$/i,
  );
  if (
    inability?.[1] &&
    !proposition?.domain &&
    proposition?.negation?.necessary !== true
  ) {
    return { text: `I am not currently able to ${inability[1].trim()}.`, ruleIds: ['PGS-003', 'PGS-005'], supportingFields: ['P1.actor', 'P1.actionOrRelation', 'P1.negation', 'P1.modality'] };
  }

  /**
   * A vague evaluation, with the missing part named rather than supplied.
   *
   * `vagueFeedback` raises PGS-002 ("vague evaluation should be separated from
   * observable criteria") and PGS-006 ("a constructive request requires actual
   * criteria; none may be invented").
   *
   * Those two pull in opposite directions unless the rewrite names the gap
   * instead of filling it — which is exactly what the PGS-001 rule above
   * already does for a missing actor ("The actor responsible for the errors is
   * not identified"). The same move applies here: say that the criteria are
   * absent, and invent none.
   *
   * PGS-006 is not claimed in `ruleIds`, for the reason it is not claimed on
   * impossibility: no criteria were proposed, so reporting the rule would
   * overstate what the engine did.
   */
  const vagueEvaluation = clean.match(
    /^(?:the|this|that|my|your)\s+(report|feedback|draft|work)\b[^.!?]*\bbad\b[^.!?]*\.?$/i,
  );
  if (vagueEvaluation?.[1]) {
    return { text: `The criteria for this evaluation of the ${vagueEvaluation[1].toLowerCase()} are not stated.`, ruleIds: ['PGS-002'], supportingFields: ['P1.objectOrTarget', 'P1.observation', 'P1.sourceSpan'] };
  }

  /**
   * An absolute generalisation, calibrated and attributed.
   *
   * `absoluteGeneralisation` matches always, never, nobody, everybody,
   * everyone and nothing, raising PGS-002 ("may combine observation with
   * interpretation") and PGS-005 ("requires evidence or epistemic
   * calibration"). Only one shape was rendered — addressee + listen + never,
   * above, which keeps its precedence.
   *
   * ── WHY ONLY THE ADVERB MOVES ───────────────────────────────────────────
   *
   * Calibration here is two small changes and no more: the absolute becomes a
   * frequency the speaker can actually support, and the claim is attributed to
   * them. Everything else is carried through untouched, because rewriting the
   * verb would mean changing tense — "you have interrupt me" is what regex
   * surgery on a predicate produces, and a rule that mangles grammar to look
   * thorough is worse than one that does less.
   *
   * ── WHY IMPERATIVES AND PROTECTED DOMAINS ARE EXCLUDED ──────────────────
   *
   * The subject is required, so "Never energise the circuit while live" does
   * not match: it is an instruction, and softening "never" to "rarely" there
   * would invert a safety rule. The domain guard repeats the point for cases
   * the grammar lets through, and a necessary negation is refused outright.
   */
  const absolute = clean.match(
    /^(I|we|you|they|he|she)\s+(always|never)\s+(.+?)\.?$/i,
  );
  if (
    absolute?.[1] &&
    absolute[3] &&
    !proposition?.domain &&
    proposition?.negation?.necessary !== true
  ) {
    // Lower-cased because the subject moves out of sentence-initial position,
    // except the first-person pronoun, which is capitalised wherever it sits.
    const lowered = absolute[1].toLowerCase();
    const subject = lowered === 'i' ? 'I' : lowered;
    const frequency = absolute[2].toLowerCase() === 'always' ? 'often' : 'rarely';
    return { text: `I believe ${subject} ${frequency} ${absolute[3].trim()}.`, ruleIds: ['PGS-002', 'PGS-005'], supportingFields: ['P1.actor', 'P1.actionOrRelation', 'P1.epistemicStatus', 'P1.sourceSpan'] };
  }

  const uncertainty = clean.match(/^Maybe\s+(.+?)[.]?$/i);
  if (uncertainty?.[1]) {
    return { text: `I am uncertain whether ${uncertainty[1].replace(/[.]$/, '')}.`, ruleIds: ['PGS-005'], supportingFields: ['P1.epistemicStatus', 'P1.sourceSpan'] };
  }
  const assumption = clean.match(/^Obviously\s+(.+?)[.]?$/i);
  if (assumption?.[1]) {
    return { text: `I assume ${assumption[1].replace(/[.]$/, '')}.`, ruleIds: ['PGS-002', 'PGS-005'], supportingFields: ['P1.epistemicStatus', 'P1.sourceSpan'] };
  }
  if (hasMotive) {
    const clause = /^(?:I|we|you|they|he|she|it|this|that)\b/i.test(clean) ? `${clean.charAt(0).toLowerCase()}${clean.slice(1)}` : clean;
    return { text: `I believe ${clause}`, ruleIds: ['PGS-002', 'PGS-005'], supportingFields: ['P1.ambiguity.motive', 'P1.sourceSpan'] };
  }
  return { text: clean, ruleIds: [], supportingFields: ['P1.sourceSpan'] };
}

export function renderRecommendations(source: string, unresolved: string[], context?: SemanticContext, propositions: PgsProposition[] = []): Recommendation[] {
  const hasMotive = unresolved.some(item => /motive/i.test(item));
  const hasUnresolved = unresolved.length > 0;
  const rendered = naturalL1(applyBindings(source, context), hasMotive, propositions);
  const verifiedFacts = (context?.knownFacts ?? []).map(asSentence);
  const l1Text = [...verifiedFacts, rendered.text].join(' ');
  const contextFields = [
    ...verifiedFacts.map((_, index) => `context.knownFacts[${index}]`),
    ...(context?.referenceBindings ?? []).map((_, index) => `context.referenceBindings[${index}]`),
    ...(context?.evidence ?? []).map((_, index) => `context.evidence[${index}]`),
  ];
  const l1: Recommendation = { level: 'PGS-L1', text: l1Text, ruleIds: rendered.ruleIds, supportingFields: [...contextFields, ...rendered.supportingFields] };
  const l2: Recommendation = context?.userIntent?.trim()
    ? { level: 'PGS-L2', text: `${l1Text} ${asSentence(context.userIntent)}`, ruleIds: [...new Set([...rendered.ruleIds, 'PGS-006'])], supportingFields: [...contextFields, ...rendered.supportingFields, 'context.userIntent'] }
    : hasUnresolved
      ? { level: 'PGS-L2', withheldReason: 'A more directive rewrite could change unresolved meaning or invent evidence or a requested action.', ruleIds: [], supportingFields: [] }
      : { level: 'PGS-L2', text: l1Text, ruleIds: rendered.ruleIds, supportingFields: [...contextFields, ...rendered.supportingFields] };
  return [l1, l2];
}
