import { compareFidelity, type FidelityComparison } from '../core/fidelity';
import type { SemanticContext } from '../semantic/types';

export interface FidelityMutationCase {
  id: string;
  category: string;
  source: string;
  candidate: string;
  context?: SemanticContext;
  expectedStatus: FidelityComparison['status'];
  expectedCodes?: string[];
  forbiddenCodes?: string[];
}

export interface FidelityMutationAssertion { pass: boolean; message: string }
export interface FidelityMutationResult {
  id: string;
  category: string;
  pass: boolean;
  assertions: FidelityMutationAssertion[];
  comparison: FidelityComparison;
}

export interface FidelityMutationSummary {
  passed: number;
  failed: number;
  total: number;
  results: FidelityMutationResult[];
}

export function evaluateFidelityMutation(testCase: FidelityMutationCase): FidelityMutationResult {
  const comparison = compareFidelity(testCase.source, testCase.candidate, testCase.context);
  const codes = new Set(comparison.issues.map(issue => issue.code));
  const assertions: FidelityMutationAssertion[] = [
    { pass: comparison.status === testCase.expectedStatus, message: `Expected ${testCase.expectedStatus} status; received ${comparison.status}.` },
  ];
  for (const code of testCase.expectedCodes ?? []) assertions.push({ pass: codes.has(code), message: `${code} is reported.` });
  for (const code of testCase.forbiddenCodes ?? []) assertions.push({ pass: !codes.has(code), message: `${code} is not reported.` });
  return { id: testCase.id, category: testCase.category, pass: assertions.every(assertion => assertion.pass), assertions, comparison };
}

export function evaluateFidelityMutationCorpus(cases: FidelityMutationCase[]): FidelityMutationSummary {
  const results = cases.map(evaluateFidelityMutation);
  return { passed: results.filter(result => result.pass).length, failed: results.filter(result => !result.pass).length, total: results.length, results };
}

export function formatFidelityMutationSummary(summary: FidelityMutationSummary): string {
  const details = summary.results.map(result => {
    const failures = result.assertions.filter(assertion => !assertion.pass);
    const suffix = failures.length ? `\n${failures.map(assertion => `    - ${assertion.message}`).join('\n')}` : '';
    return `${result.pass ? 'PASS' : 'FAIL'} ${result.id} ${result.category}${suffix}`;
  });
  return ['ADVERSARIAL FIDELITY EVALUATION', `Cases: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed}`, '', ...details].join('\n');
}
