import { classifyProtectedDomain } from './domain';

export interface RuleFinding {
  ruleId: string;
  patternId?: string;
  severity: 'info' | 'suggestion' | 'warning';
  message: string;
  evidence?: string;
}

const vagueTime = /\b(soon|asap|later|sometime|eventually|in a while)\b/i;
const absoluteGeneralisation = /\b(always|never|nobody|everybody|everyone|nothing)\b/i;
// Conservative passive candidate: regular participles plus a small explicit set of common irregular participles.
const passiveCandidate = /\b(?:was|were|is|are|been|be)\s+(?:\w+(?:ed|en)|made|done|sent|given|taken|known|seen|found|held|built|written|read|said|told|left|lost|paid|put|set)\b/i;
const negativeInstruction = /\b(?:do not|don't|must not|mustn't|should not|shouldn't|i\s+(?:will not|won't))\b/i;
const unsupportedCertainty = /\b(obviously|definitely|certainly|undoubtedly)\b/i;
const uncertaintyMarker = /\b(maybe|perhaps|possibly|uncertain|seems?|appears?)\b/i;
const inability = /\b(?:can't|cannot|unable|not (?:yet )?able)\b/i;
const evaluativeLabel = /\b(?:useless|hopeless|worthless)\b/i;
const conditionalApology = /\bsorry\s+if\b/i;
const vagueFeedback = /\b(?:report|feedback|draft|work)\b[^.!?]*\bbad\b/i;
const absoluteImpossibility = /\bimpossible\b/i;
const failurePrediction = /\b(?:going to|will)\s+fail\b/i;

export function detectDeterministicRules(text: string): RuleFinding[] {
  const findings: RuleFinding[] = [];
  const add = (finding: RuleFinding) => findings.push(finding);

  const time = text.match(vagueTime);
  if (time) add({ ruleId: 'PGS-004', severity: 'suggestion', message: 'Material timing may be vague; prefer an explicit time when known.', evidence: time[0] });

  const general = text.match(absoluteGeneralisation);
  if (general) {
    add({ ruleId: 'PGS-002', severity: 'suggestion', message: 'Absolute language may combine observation with interpretation; verify the observable basis.', evidence: general[0] });
    add({ ruleId: 'PGS-005', severity: 'suggestion', message: 'Absolute generalisation requires evidence or epistemic calibration.', evidence: general[0] });
  }

  const passive = text.match(passiveCandidate);
  if (passive) add({ ruleId: 'PGS-001', patternId: 'PAT-001', severity: 'suggestion', message: 'Possible passive construction; verify whether material agency is explicit.', evidence: passive[0] });

  const negative = text.match(negativeInstruction);
  if (negative) add({ ruleId: 'PGS-007', patternId: 'PAT-007', severity: 'info', message: 'Negative instruction detected. Preserve it when legally, logically or safety necessary; otherwise consider an affirmative desired state.', evidence: negative[0] });
  else {
    const protectedDomain = classifyProtectedDomain(text);
    const materialNegation = text.match(/\b(?:not|no|never|cannot|can't|doesn't|didn't|isn't|aren't|wasn't|weren't|won't|mustn't)\b/i);
    if (protectedDomain && materialNegation) add({ ruleId: 'PGS-007', patternId: 'PAT-007-PROTECTED', severity: 'info', message: `Material ${protectedDomain} negation detected and protected from polarity-changing transformation.`, evidence: materialNegation[0] });
  }

  const certainty = text.match(unsupportedCertainty);
  if (certainty) {
    add({ ruleId: 'PGS-002', severity: 'suggestion', message: 'Certainty language may combine observation with interpretation; separate them when material.', evidence: certainty[0] });
    add({ ruleId: 'PGS-005', patternId: 'PAT-005', severity: 'suggestion', message: 'Strong certainty marker detected; verify that the evidence supports this degree of certainty.', evidence: certainty[0] });
  }

  const uncertainty = text.match(uncertaintyMarker);
  if (uncertainty) add({ ruleId: 'PGS-005', patternId: 'PAT-005-UNCERTAINTY', severity: 'info', message: 'Uncertainty is explicit and must not be upgraded to certainty.', evidence: uncertainty[0] });

  const capability = text.match(inability);
  if (capability) {
    add({ ruleId: 'PGS-003', severity: 'suggestion', message: 'Present inability is distinguished from permanent incapability; preserve the actual scope.', evidence: capability[0] });
    add({ ruleId: 'PGS-005', severity: 'suggestion', message: 'Capability status requires calibrated scope and must not be overstated.', evidence: capability[0] });
  }

  const label = text.match(evaluativeLabel);
  if (label) {
    add({ ruleId: 'PGS-002', severity: 'suggestion', message: 'Global evaluative self-description may combine a present difficulty with a fixed identity claim.', evidence: label[0] });
    add({ ruleId: 'PGS-005', severity: 'suggestion', message: 'A global capability claim requires calibration to the known task and evidence.', evidence: label[0] });
  }

  const apology = text.match(conditionalApology);
  if (apology) add({ ruleId: 'PGS-002', severity: 'suggestion', message: 'Conditional apology detected; do not invent an admission or causal fact.', evidence: apology[0] });

  const feedback = text.match(vagueFeedback);
  if (feedback) {
    add({ ruleId: 'PGS-002', severity: 'suggestion', message: 'Vague evaluation should be separated from observable criteria.', evidence: feedback[0] });
    add({ ruleId: 'PGS-006', severity: 'suggestion', message: 'A constructive request requires actual criteria; none may be invented.', evidence: feedback[0] });
  }

  const impossible = text.match(absoluteImpossibility);
  if (impossible) {
    add({ ruleId: 'PGS-002', severity: 'suggestion', message: 'Absolute feasibility language may combine a constraint with an interpretation.', evidence: impossible[0] });
    add({ ruleId: 'PGS-005', severity: 'suggestion', message: 'Impossibility requires evidence or calibrated personal scope.', evidence: impossible[0] });
    add({ ruleId: 'PGS-006', severity: 'suggestion', message: 'A proposed range or alternative requires user-supplied context.', evidence: impossible[0] });
  }

  const prediction = text.match(failurePrediction);
  if (prediction) add({ ruleId: 'PGS-005', severity: 'suggestion', message: 'Failure prediction is an assessment, not an established outcome.', evidence: prediction[0] });

  return findings;
}
