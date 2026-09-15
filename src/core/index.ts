export * from './types';
export * from './validator';
export * from './rules';
export * from './fidelity';
export * from './domain';

import { detectDeterministicRules } from './rules';

export interface AnalyseResult {
  source: string;
  findings: ReturnType<typeof detectDeterministicRules>;
}

/**
 * Phase-one deterministic analysis. This deliberately does not attempt semantic
 * proposition extraction. Contextual interpretation belongs behind the future
 * semantic-engine adapter and must conform to PGS-PIR plus fidelity validation.
 */
export function analyse(text: string): AnalyseResult {
  return {
    source: text,
    findings: detectDeterministicRules(text),
  };
}
