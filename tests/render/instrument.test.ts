import { describe, expect, it } from 'vitest';
import { instrumentMarkers, readsAsInstrument } from '../../src/render/instrument';

/**
 * EXC-008. The counterexamples matter more than the examples here: a detector
 * that refuses everything legal-sounding protects nothing and removes the
 * feature's reason to exist, because correspondence ABOUT a legal matter is
 * most of what anyone brings to PGS.
 */
describe('EXC-008 instrument detection', () => {
  describe('withholds generation for operative instrument text', () => {
    it.each([
      ['execution clause', 'IN WITNESS WHEREOF the parties have executed this Deed.'],
      ['declaration of trust', 'The Settlor hereby declares that the Trustees shall hold the Trust Fund upon trust for the Beneficiaries.'],
      ['recital into operative part', 'NOW THEREFORE in consideration of the premises the parties agree as follows.'],
      ['attestation', 'Signed, sealed and delivered by the within named Grantor.'],
      ['defined term', 'The Company (hereinafter called "the Employer") shall pay the sums set out below.'],
      ['assignment', 'The Assignor hereby assigns all right, title and interest in the Patents.'],
      ['statutory notice', 'Notice is hereby given that a meeting of creditors will be held.'],
    ])('%s', (_name, text) => {
      expect(readsAsInstrument(text)).toBe(true);
    });

    it('reports the markers that caused the withholding', () => {
      const markers = instrumentMarkers('IN WITNESS WHEREOF the parties have executed this Deed.');
      expect(markers.some(m => m.decisive && /witness whereof/i.test(m.matched))).toBe(true);
      expect(markers.every(m => m.matched.length > 0)).toBe(true);
    });
  });

  /**
   * Correspondence that mentions legal things. Every one of these is `legal`
   * to `classifyProtectedDomain`, which is precisely why that classifier could
   * not be reused for this.
   */
  describe('leaves correspondence about legal matters alone', () => {
    it.each([
      ['refusal of consent', 'I do not consent to this.'],
      ['about a received notice', 'Your notice of 14 November arrived after the deadline it sets.'],
      ['about a signed agreement', 'I am writing about the agreement we signed last year.'],
      ['about a trustee', 'The trustee has not replied to either of my letters.'],
      ['complaint', 'I am writing to complain about the way my case has been handled.'],
      ['disputed charge', 'I am not disputing the charge itself, only the timing.'],
      ['conditional chase', "If payment is not received by 14 November, we won't proceed with the order."],
      ['liability denial', 'I am not liable for the balance and I have said so twice.'],
      ['one pompous letter', 'As set out hereunder, the matters aforesaid remain outstanding.'],
    ])('%s', (_name, text) => {
      expect(readsAsInstrument(text)).toBe(false);
    });
  });

  describe('the threshold', () => {
    it('treats a single corroborating marker as correspondence', () => {
      const text = 'The trustee has not replied.';
      expect(instrumentMarkers(text)).toHaveLength(1);
      expect(readsAsInstrument(text)).toBe(false);
    });

    it('withholds once two distinct kinds corroborate', () => {
      // party + operative, neither decisive on its own.
      const text = 'The Trustees shall be deemed to have accepted the appointment.';
      const markers = instrumentMarkers(text);
      expect(markers.every(m => !m.decisive)).toBe(true);
      expect(new Set(markers.map(m => m.kind)).size).toBeGreaterThanOrEqual(2);
      expect(readsAsInstrument(text)).toBe(true);
    });

    it('does not let two markers of ONE kind reach the threshold', () => {
      const text = 'The matters aforesaid and the sums payable hereunder.';
      const markers = instrumentMarkers(text);
      expect(new Set(markers.map(m => m.kind))).toEqual(new Set(['archaic']));
      expect(readsAsInstrument(text)).toBe(false);
    });

    it('finds nothing in text with no legal character at all', () => {
      expect(instrumentMarkers('You never listen to anything I say.')).toEqual([]);
      expect(readsAsInstrument('You never listen to anything I say.')).toBe(false);
    });
  });

  it('reads numbered clause structure as structural evidence', () => {
    const deed = '1.1 The Tenant shall be liable for the rent.\n1.2 The Landlord shall insure the Property.';
    expect(readsAsInstrument(deed)).toBe(true);
  });
});
