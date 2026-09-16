import type { Domain } from './types';

const DOMAIN_PATTERNS: Array<[Domain, RegExp]> = [
  ['legal', /\b(?:claimant|defendant|court|jurisdiction|statute|contract|contractual|notice|consent|liable|liability)\b/i],
  ['medical', /\b(?:tablet|tablets|dose|dosage|medicine|medication|prescription|patient|mg|milligram|milligrams)\b/i],
  ['safety', /\b(?:circuit|energise|energize|hazard|hazardous|danger|dangerous|emergency|protective equipment)\b/i],
  ['spiritual', /\b(?:energy|energetic|vibration|spiritual)\b/i],
];

export function classifyProtectedDomain(text: string): Domain | undefined {
  return DOMAIN_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0];
}
