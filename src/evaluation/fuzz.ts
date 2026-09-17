import { compareFidelity, type FidelityComparison } from '../core/fidelity';
import type { SemanticContext } from '../semantic/types';

export const DEFAULT_FIDELITY_FUZZ_SEED = 0x504753;
export const DEFAULT_FIDELITY_FUZZ_ITERATIONS = 25;

export interface FidelityFuzzOptions {
  seed?: number;
  iterationsPerFamily?: number;
}

export interface FidelityFuzzCase {
  id: string;
  family: string;
  source: string;
  candidate: string;
  expectedCode: string;
  context?: SemanticContext;
}

export interface FidelityFuzzResult extends FidelityFuzzCase {
  pass: boolean;
  comparison: FidelityComparison;
}

export interface FidelityFuzzSummary {
  seed: number;
  iterationsPerFamily: number;
  families: number;
  passed: number;
  failed: number;
  total: number;
  results: FidelityFuzzResult[];
}

type Random = () => number;
interface FuzzFamily {
  id: string;
  expectedCode: string;
  generate: (random: Random) => Omit<FidelityFuzzCase, 'id' | 'family' | 'expectedCode'>;
}

function randomGenerator(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

function pick<T>(random: Random, values: readonly T[]): T {
  const value = values[Math.floor(random() * values.length)];
  if (value === undefined) throw new Error('Cannot select from an empty fuzz value set.');
  return value;
}

function distinctPair<T>(random: Random, values: readonly T[]): [T, T] {
  const firstIndex = Math.floor(random() * values.length);
  let secondIndex = Math.floor(random() * (values.length - 1));
  if (secondIndex >= firstIndex) secondIndex += 1;
  const first = values[firstIndex];
  const second = values[secondIndex];
  if (first === undefined || second === undefined) throw new Error('A fuzz pair requires at least two values.');
  return [first, second];
}

const actors = ['Maria', 'David', 'Alice', 'Robert', 'James', 'Priya'] as const;
const actions = ['reviewed', 'sent', 'confirmed', 'signed', 'submitted', 'ignored'] as const;
const dates = ['2026-10-01', '2027-02-14', '17/10/2026', 'October 17, 2026', '17 October 2026', 'Friday'] as const;
const quantities = ['one', 'two', 'three', 'five', '8', '13', '£500', '£750'] as const;
const motives = ['deliberately', 'intentionally', 'on purpose'] as const;
const evidencePrefixes = ['Evidence shows', 'Records confirm', 'According to the documents'] as const;
const modalityPairs = [
  ['must not', 'should not'],
  ['may', 'will'],
  ['can', 'might'],
  ['should', 'must'],
  ['could', 'will'],
] as const;
const protectedTerms = ['subject to contract', 'without prejudice', 'draft only', 'not legal advice'] as const;

const families: readonly FuzzFamily[] = [
  {
    id: 'actor-substitution',
    expectedCode: 'FIDELITY_ACTOR_INVENTED',
    generate: random => {
      const [sourceActor, candidateActor] = distinctPair(random, actors);
      const action = pick(random, actions);
      return { source: `${sourceActor} ${action} the file.`, candidate: `${candidateActor} ${action} the file.` };
    },
  },
  {
    id: 'action-substitution',
    expectedCode: 'FIDELITY_ACTION_INVENTED',
    generate: random => {
      const actor = pick(random, actors);
      const [sourceAction, candidateAction] = distinctPair(random, actions);
      return { source: `${actor} ${sourceAction} the report.`, candidate: `${actor} ${candidateAction} the report.` };
    },
  },
  {
    id: 'time-invention',
    expectedCode: 'FIDELITY_TIME_INVENTED',
    generate: random => ({ source: 'Send the report.', candidate: `Send the report by ${pick(random, dates)}.` }),
  },
  {
    id: 'quantity-substitution',
    expectedCode: 'FIDELITY_QUANTITY_INVENTED',
    generate: random => {
      const [sourceQuantity, candidateQuantity] = distinctPair(random, quantities);
      return { source: `Pay ${sourceQuantity} instalments.`, candidate: `Pay ${candidateQuantity} instalments.` };
    },
  },
  {
    id: 'motive-invention',
    expectedCode: 'FIDELITY_MOTIVE_INVENTED',
    generate: random => ({ source: 'They ignored my email.', candidate: `They ${pick(random, motives)} ignored my email.` }),
  },
  {
    id: 'evidence-invention',
    expectedCode: 'FIDELITY_EVIDENCE_INVENTED',
    generate: random => ({ source: 'The claimant sent the notice.', candidate: `${pick(random, evidencePrefixes)} the claimant sent the notice.` }),
  },
  {
    id: 'modality-substitution',
    expectedCode: 'FIDELITY_MODALITY_CHANGED',
    generate: random => {
      const [sourceModal, candidateModal] = pick(random, modalityPairs);
      return { source: `The supplier ${sourceModal} disclose the file.`, candidate: `The supplier ${candidateModal} disclose the file.` };
    },
  },
  {
    id: 'negation-invention',
    expectedCode: 'FIDELITY_NEGATION_INVENTED',
    generate: random => {
      const action = pick(random, ['disclose', 'send', 'confirm', 'sign'] as const);
      return { source: `The supplier will ${action} the file.`, candidate: `The supplier will not ${action} the file.` };
    },
  },
  {
    id: 'negation-removal',
    expectedCode: 'FIDELITY_NEGATION_REMOVED',
    generate: random => {
      const action = pick(random, ['disclose', 'send', 'confirm', 'sign'] as const);
      return { source: `The supplier will not ${action} the file.`, candidate: `The supplier will ${action} the file.` };
    },
  },
  {
    id: 'condition-invention',
    expectedCode: 'FIDELITY_CONDITION_INVENTED',
    generate: random => {
      const marker = pick(random, ['if', 'unless', 'provided that', 'only if'] as const);
      return { source: 'The supplier sends the notice.', candidate: `The supplier sends the notice ${marker} the buyer pays.` };
    },
  },
  {
    id: 'condition-removal',
    expectedCode: 'FIDELITY_CONDITION_REMOVED',
    generate: random => {
      const marker = pick(random, ['if', 'unless', 'provided that', 'only if'] as const);
      return { source: `The supplier sends the notice ${marker} the buyer pays.`, candidate: 'The supplier sends the notice and the buyer pays.' };
    },
  },
  {
    id: 'certainty-upgrade',
    expectedCode: 'FIDELITY_CERTAINTY_UPGRADED',
    generate: random => {
      const hedge = pick(random, ['may', 'might', 'could', 'perhaps'] as const);
      const certainty = pick(random, ['will', 'definitely will', 'certainly will'] as const);
      return { source: `I ${hedge} send the report.`, candidate: `I ${certainty} send the report.` };
    },
  },
  {
    id: 'protected-term-removal',
    expectedCode: 'FIDELITY_PROTECTED_TERM_REMOVED',
    generate: random => {
      const protectedTerm = pick(random, protectedTerms);
      return {
        source: `${protectedTerm}: The supplier sent the report.`,
        candidate: 'The supplier sent the report.',
        context: { protectedTerms: [protectedTerm] },
      };
    },
  },
];

function normalizedOptions(options: FidelityFuzzOptions): Required<FidelityFuzzOptions> {
  const seed = options.seed ?? DEFAULT_FIDELITY_FUZZ_SEED;
  const iterationsPerFamily = options.iterationsPerFamily ?? DEFAULT_FIDELITY_FUZZ_ITERATIONS;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new Error('Fidelity fuzz seed must be an integer from 0 to 4294967295.');
  }
  if (!Number.isSafeInteger(iterationsPerFamily) || iterationsPerFamily < 1 || iterationsPerFamily > 10_000) {
    throw new Error('Fidelity fuzz iterations must be an integer from 1 to 10000.');
  }
  return { seed, iterationsPerFamily };
}

export function generateFidelityFuzzCases(options: FidelityFuzzOptions = {}): FidelityFuzzCase[] {
  const { seed, iterationsPerFamily } = normalizedOptions(options);
  const random = randomGenerator(seed);
  return families.flatMap(family => Array.from({ length: iterationsPerFamily }, (_, index) => ({
    id: `${family.id}-${String(index + 1).padStart(4, '0')}`,
    family: family.id,
    expectedCode: family.expectedCode,
    ...family.generate(random),
  })));
}

export function evaluateFidelityFuzz(options: FidelityFuzzOptions = {}): FidelityFuzzSummary {
  const normalized = normalizedOptions(options);
  const results = generateFidelityFuzzCases(normalized).map(testCase => {
    const comparison = compareFidelity(testCase.source, testCase.candidate, testCase.context);
    const pass = comparison.status === 'blocked' && comparison.issues.some(issue => issue.code === testCase.expectedCode);
    return { ...testCase, pass, comparison };
  });
  return {
    ...normalized,
    families: families.length,
    passed: results.filter(result => result.pass).length,
    failed: results.filter(result => !result.pass).length,
    total: results.length,
    results,
  };
}

export function formatFidelityFuzzSummary(summary: FidelityFuzzSummary): string {
  const failures = summary.results.filter(result => !result.pass).map(result => [
    `FAIL ${result.id}: expected ${result.expectedCode}`,
    `  Source: ${result.source}`,
    `  Candidate: ${result.candidate}`,
    `  Received: ${result.comparison.status} (${result.comparison.issues.map(issue => issue.code).join(', ') || 'no issues'})`,
  ].join('\n'));
  return [
    'SEEDED FIDELITY FUZZ EVALUATION',
    `Seed: ${summary.seed} | Families: ${summary.families} | Iterations/family: ${summary.iterationsPerFamily}`,
    `Cases: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed}`,
    ...(failures.length ? ['', ...failures] : []),
  ].join('\n');
}
