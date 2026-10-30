/**
 * Does this text read as the operative part of a legal instrument?
 *
 * Implements EXC-008 (`specification/exceptions.yaml`), which withholds L3
 * GENERATION for instrument text. Nothing else is withheld: analysis, scoring,
 * explanation and fidelity comparison all stay available, because reading an
 * instrument is safe and only rewriting one is not.
 *
 * ── WHY A DETECTOR AND NOT THE DOMAIN CLASSIFIER ─────────────────────────
 *
 * `core/domain.ts` already classifies text as `legal`, but it fires on
 * "notice", "consent", "contract" and "liable" — so "I do not consent to
 * this." is legal text. That is correspondence, and it is exactly the sentence
 * PGS exists to help someone write. Refusing it would empty the feature of its
 * purpose while protecting nothing.
 *
 * What distinguishes an instrument is not its subject but its function: a
 * clause does not describe a disposition, it effects one. So the markers below
 * are the ones that only appear when text is DOING something — executing,
 * reciting, disposing — rather than talking about something that was done.
 *
 * ── THE THRESHOLD, AND WHY IT IS ASYMMETRIC ──────────────────────────────
 *
 * A decisive marker is conclusive on its own; otherwise two distinct KINDS of
 * corroborating marker are required. Two of one kind is not enough — a letter
 * can be pompous without being a deed, and "hereunder … aforesaid" is a
 * register, not a disposition.
 *
 * The bias is to withhold, and EXC-008 gives the reason: withholding costs a
 * drafter their own wording, while a wrong generation costs an instrument that
 * does not do what its maker intended. Those are not comparable, so detector
 * confidence does not get to set the default.
 *
 * This is a reading of surface markers. It will be wrong in both directions,
 * and it is a floor rather than a guarantee — a plainly drafted modern trust
 * clause carrying none of these markers will pass it. It is not a substitute
 * for a drafter knowing what they are editing.
 */

export type InstrumentMarkerKind =
  | 'execution'
  | 'operative'
  | 'recital'
  | 'party'
  | 'structure'
  | 'archaic';

export interface InstrumentMarker {
  kind: InstrumentMarkerKind;
  /** True when this marker alone settles it. */
  decisive: boolean;
  /** The words that matched, for reporting back to the drafter. */
  matched: string;
}

/**
 * Conclusive on their own: phrases that essentially only occur in text that is
 * executing, reciting or disposing.
 */
const DECISIVE: Array<[InstrumentMarkerKind, RegExp]> = [
  ['execution', /\bin witness whereof\b/i],
  ['execution', /\bexecuted as a deed\b/i],
  ['execution', /\bsigned,? sealed and delivered\b/i],
  ['operative', /\bhereby\s+(?:declares?|covenants?|assigns?|conveys?|grants?|appoints?|revokes?|devises?|bequeaths?|settles?|transfers?|irrevocably)\b/i],
  ['operative', /\bnotice is hereby given\b/i],
  ['recital', /\bnow,?\s+therefore\b/i],
  ['recital', /\bwitnesseth\b/i],
  ['structure', /\bagrees? as follows\b/i],
  ['structure', /\bthis deed\b/i],
  ['archaic', /\bhereinafter\s+(?:called|referred to)\b/i],
];

/**
 * Suggestive but not conclusive. Any ONE of these can appear in ordinary
 * correspondence about a legal matter — "the trustee has not replied" is a
 * complaint, not a settlement — so two distinct kinds are required.
 */
const CORROBORATING: Array<[InstrumentMarkerKind, RegExp]> = [
  ['recital', /\bwhereas\b/i],
  ['structure', /\bthis (?:agreement|settlement|indenture|conveyance|assignment|lease|will|codicil)\b/i],
  ['structure', /(?:^|\n)\s*\d+\.\d+[\s)]/],
  ['structure', /\b(?:clause|schedule|recital)\s+\d+\b/i],
  ['party', /\b(?:settlor|trustees?|testat(?:or|rix)|executors?|grantor|covenantor|devisee|beneficiar(?:y|ies))\b/i],
  ['party', /\bthe (?:Company|Parties|Purchaser|Vendor|Landlord|Tenant|Borrower|Lender)\b/],
  ['archaic', /\b(?:aforesaid|thereunder|hereunder|hereof|thereof|herein|thereto|hereto)\b/i],
  ['operative', /\bshall be (?:deemed|construed|entitled|liable|binding|vested)\b/i],
  ['operative', /\btake notice\b/i],
];

const collect = (
  text: string,
  patterns: Array<[InstrumentMarkerKind, RegExp]>,
  decisive: boolean,
): InstrumentMarker[] =>
  patterns.flatMap(([kind, pattern]) => {
    const found = pattern.exec(text);
    return found ? [{ kind, decisive, matched: found[0].trim() }] : [];
  });

/** Every marker found, decisive ones first. Empty for ordinary correspondence. */
export function instrumentMarkers(text: string): InstrumentMarker[] {
  return [...collect(text, DECISIVE, true), ...collect(text, CORROBORATING, false)];
}

/**
 * Whether EXC-008 withholds generation for this text.
 *
 * One decisive marker, or two distinct kinds of corroborating marker.
 */
export function readsAsInstrument(text: string): boolean {
  const markers = instrumentMarkers(text);
  if (markers.some(marker => marker.decisive)) return true;
  return new Set(markers.map(marker => marker.kind)).size >= 2;
}
