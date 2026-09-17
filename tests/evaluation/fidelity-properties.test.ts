import { describe, expect, it } from 'vitest';
import { compareFidelity } from '../../src/core/fidelity';

function expectBlocked(source: string, candidate: string, code: string): void {
  const result = compareFidelity(source, candidate);
  expect(result.status, `${source} -> ${candidate}`).toBe('blocked');
  expect(result.issues.map(issue => issue.code), `${source} -> ${candidate}`).toContain(code);
}

describe('deterministic fidelity mutation properties', () => {
  it.each([
    ['Maria reviewed the file.', 'David reviewed the file.'],
    ['Alice sent the report.', 'Robert sent the report.'],
    ['James opened the file.', 'Maria opened the file.'],
  ])('blocks a generated named-actor substitution: %s -> %s', (source, candidate) => {
    expectBlocked(source, candidate, 'FIDELITY_ACTOR_INVENTED');
  });

  it.each([
    ['Maria reviewed the file.', 'Maria opened the file.'],
    ['Maria sent the report.', 'Maria ignored the report.'],
    ['Maria found the discrepancy.', 'Maria submitted the discrepancy.'],
  ])('blocks a generated controlled-action substitution: %s -> %s', (source, candidate) => {
    expectBlocked(source, candidate, 'FIDELITY_ACTION_INVENTED');
  });

  it.each(['2026-10-01', '17/10/2026', 'October 17, 2026', '17 October 2026', 'Friday'])
    ('blocks an invented date format: %s', date => {
      expectBlocked('Send the report.', `Send the report by ${date}.`, 'FIDELITY_TIME_INVENTED');
    });

  it.each([
    ['Take two tablets.', 'Take three tablets.'],
    ['Pay £500.', 'Pay £750.'],
    ['Send 2 copies.', 'Send 4 copies.'],
  ])('blocks a generated quantity substitution: %s -> %s', (source, candidate) => {
    expectBlocked(source, candidate, 'FIDELITY_QUANTITY_INVENTED');
  });

  it.each(['deliberately', 'intentionally', 'on purpose'])('blocks an invented motive marker: %s', marker => {
    expectBlocked('They ignored my email.', `They ${marker} ignored my email.`, 'FIDELITY_MOTIVE_INVENTED');
  });

  it.each(['Evidence shows', 'Records confirm', 'According to the documents'])('blocks an invented evidential basis: %s', prefix => {
    expectBlocked('The claimant sent the notice.', `${prefix} the claimant sent the notice.`, 'FIDELITY_EVIDENCE_INVENTED');
  });

  it.each([
    ['The supplier must not disclose the file.', 'The supplier should not disclose the file.'],
    ['I may send the file.', 'I will send the file.'],
    ['I can send the file.', 'I might send the file.'],
  ])('blocks a generated modality substitution: %s -> %s', (source, candidate) => {
    expectBlocked(source, candidate, 'FIDELITY_MODALITY_CHANGED');
  });

  it('allows PIR actors and actions explicitly authorized by context', () => {
    const result = compareFidelity('The actor and action are unspecified.', 'Maria opened the file.', {
      knownFacts: ['Maria opened the file.'],
    });
    expect(result.issues.map(issue => issue.code)).not.toContain('FIDELITY_ACTOR_INVENTED');
    expect(result.issues.map(issue => issue.code)).not.toContain('FIDELITY_ACTION_INVENTED');
  });
});
