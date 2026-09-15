export interface RuleFinding {
  ruleId: string;
  patternId?: string;
  severity: 'info' | 'suggestion' | 'warning';
  message: string;
  evidence?: string;
}

const vagueTime = /\b(soon|asap|later|sometime|eventually|in a while)\b/i;
const absoluteGeneralisation = /\b(always|never|nobody|everybody|everyone|nothing)\b/i;
const passiveCandidate = /\b(?:was|were|is|are|been|be)\s+\w+(?:ed|en)\b/i;
const negativeInstruction = /\b(?:do not|don't|must not|mustn't|should not|shouldn't)\b/i;
const unsupportedCertainty = /\b(obviously|definitely|certainly|undoubtedly)\b/i;

export function detectDeterministicRules(text: string): RuleFinding[] {
  const findings: RuleFinding[] = [];
  const add = (finding: RuleFinding) => findings.push(finding);

  const time = text.match(vagueTime);
  if (time) add({ ruleId: 'PGS-004', severity: 'suggestion', message: 'Material timing may be vague; prefer an explicit time when known.', evidence: time[0] });

  const general = text.match(absoluteGeneralisation);
  if (general) add({ ruleId: 'PGS-002', severity: 'suggestion', message: 'Absolute language may combine observation with interpretation; verify the observable basis.', evidence: general[0] });

  const passive = text.match(passiveCandidate);
  if (passive) add({ ruleId: 'PGS-001', patternId: 'PAT-001', severity: 'suggestion', message: 'Possible passive construction; verify whether material agency is explicit.', evidence: passive[0] });

  const negative = text.match(negativeInstruction);
  if (negative) add({ ruleId: 'PGS-007', patternId: 'PAT-007', severity: 'info', message: 'Negative instruction detected. Preserve it when legally, logically or safety necessary; otherwise consider an affirmative desired state.', evidence: negative[0] });

  const certainty = text.match(unsupportedCertainty);
  if (certainty) add({ ruleId: 'PGS-005', patternId: 'PAT-005', severity: 'suggestion', message: 'Strong certainty marker detected; verify that the evidence supports this degree of certainty.', evidence: certainty[0] });

  return findings;
}
