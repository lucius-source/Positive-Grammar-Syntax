import type { SemanticContext, SemanticEngine } from '../semantic/types';
import { runPgsPipeline, type PipelineResult } from '../pipeline';

export interface LocalEvaluationCase {
  id: string;
  category: string;
  source: string;
  expectedRules?: string[];
  expectedUnresolved?: string[];
  protectedFragments?: string[];
  requireL2Withheld?: boolean;
  forbidNewNumbers?: boolean;
  context?: SemanticContext;
  expectedL2Fragments?: string[];
  expectedL1Fragments?: string[];
  expectedResolved?: string[];
  expectedDomain?: string;
  expectedProtectedContent?: string[];
}

export interface EvaluationAssertion { pass: boolean; message: string }
export interface LocalEvaluationResult {
  id: string;
  category: string;
  pass: boolean;
  assertions: EvaluationAssertion[];
  pipeline: PipelineResult;
}

function numbers(text: string): string[] {
  return text.match(/(?:£|\$|€)?\d+(?:[.,]\d+)?/g) ?? [];
}

export async function evaluateLocalCase(testCase: LocalEvaluationCase, engine: SemanticEngine): Promise<LocalEvaluationResult> {
  const pipeline = await runPgsPipeline(testCase.source, engine, testCase.context ? { context: testCase.context } : {});
  const rendered = pipeline.recommendations.flatMap(item => item.text ?? []).join('\n');
  const rules = new Set(pipeline.ruleFindings.map(item => item.ruleId));
  const unresolved = pipeline.unresolved.join(' ').toLowerCase();
  const assertions: EvaluationAssertion[] = [
    { pass: pipeline.source === testCase.source, message: 'Original source is preserved.' },
    { pass: pipeline.validation.valid, message: 'Deterministic PGS-PIR validates.' },
    { pass: !pipeline.deterministic.requiresSemanticReview || pipeline.semantic !== undefined, message: pipeline.semanticError ?? 'Required semantic output is present and valid.' },
    { pass: !pipeline.fidelity.some(item => item.status === 'blocked'), message: 'Initial fidelity gate has no blocked finding.' },
  ];
  for (const rule of testCase.expectedRules ?? []) assertions.push({ pass: rules.has(rule), message: `${rule} is detected.` });
  for (const field of testCase.expectedUnresolved ?? []) assertions.push({ pass: unresolved.includes(field.toLowerCase()), message: `${field} remains unresolved.` });
  for (const field of testCase.expectedResolved ?? []) assertions.push({ pass: pipeline.resolutionLedger.some(item => item.field.toLowerCase() === field.toLowerCase() && item.status === 'resolved' && item.provenance !== 'model_assessment'), message: `${field} is resolved from authorized provenance.` });
  if (testCase.expectedDomain) assertions.push({ pass: pipeline.deterministic.document.propositions.some(item => item.domain === testCase.expectedDomain), message: `${testCase.expectedDomain} domain is classified.` });
  for (const item of testCase.expectedProtectedContent ?? []) assertions.push({ pass: pipeline.deterministic.document.propositions.some(proposition => proposition.protectedContent?.includes(item)), message: `Protected content is recorded: ${item}` });
  for (const fragment of testCase.protectedFragments ?? []) assertions.push({ pass: rendered.includes(fragment), message: `Protected fragment is retained: ${fragment}` });
  if (testCase.requireL2Withheld) assertions.push({ pass: pipeline.recommendations.find(item => item.level === 'PGS-L2')?.text === undefined, message: 'PGS-L2 is withheld pending resolution.' });
  const l2Text = pipeline.recommendations.find(item => item.level === 'PGS-L2')?.text ?? '';
  const l1Text = pipeline.recommendations.find(item => item.level === 'PGS-L1')?.text ?? '';
  for (const fragment of testCase.expectedL1Fragments ?? []) assertions.push({ pass: l1Text.includes(fragment), message: `PGS-L1 contains expected content: ${fragment}` });
  for (const fragment of testCase.expectedL2Fragments ?? []) assertions.push({ pass: l2Text.includes(fragment), message: `PGS-L2 contains context-supported content: ${fragment}` });
  if (testCase.forbidNewNumbers) {
    const sourceNumbers = new Set(numbers([testCase.source, ...(testCase.context?.knownFacts ?? []), testCase.context?.userIntent ?? ''].join(' ')));
    const additions = numbers(rendered).filter(item => !sourceNumbers.has(item));
    assertions.push({ pass: additions.length === 0, message: additions.length ? `Invented numeric content: ${additions.join(', ')}` : 'No date or quantity is invented.' });
  }
  return { id: testCase.id, category: testCase.category, pass: assertions.every(item => item.pass), assertions, pipeline };
}

export interface EvaluationSummary { passed: number; failed: number; total: number; results: LocalEvaluationResult[] }

export async function evaluateLocalCorpus(cases: LocalEvaluationCase[], engine: SemanticEngine, onCase?: (testCase: LocalEvaluationCase, index: number) => void): Promise<EvaluationSummary> {
  const results: LocalEvaluationResult[] = [];
  for (const [index, testCase] of cases.entries()) {
    onCase?.(testCase, index);
    results.push(await evaluateLocalCase(testCase, engine));
  }
  return { passed: results.filter(item => item.pass).length, failed: results.filter(item => !item.pass).length, total: results.length, results };
}

export function formatEvaluationSummary(summary: EvaluationSummary): string {
  const details = summary.results.map(result => {
    const failures = result.assertions.filter(item => !item.pass);
    const suffix = failures.length ? `\n${failures.map(item => `    - ${item.message}`).join('\n')}` : '';
    return `${result.pass ? 'PASS' : 'FAIL'} ${result.id} ${result.category}${suffix}`;
  });
  return [`LOCAL PGS EVALUATION`, `Cases: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed}`, '', ...details].join('\n');
}
