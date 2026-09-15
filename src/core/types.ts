export type Polarity = 'affirmative' | 'negative' | 'mixed';
export type EpistemicStatus =
  | 'observed' | 'reported' | 'known' | 'evidenced' | 'inferred'
  | 'believed' | 'assumed' | 'alleged' | 'predicted' | 'intended'
  | 'uncertain' | 'unknown';
export type FidelityStatus = 'pass' | 'conditional' | 'review_required' | 'blocked' | 'protected';
export type SpeechAct =
  | 'assertion' | 'observation' | 'question' | 'request' | 'command'
  | 'offer' | 'promise' | 'refusal' | 'consent' | 'denial' | 'warning'
  | 'advice' | 'proposal' | 'allegation' | 'expression' | 'other';
export type Modality = 'none' | 'ability' | 'permission' | 'obligation' | 'necessity' | 'possibility' | 'probability' | 'intention' | 'commitment';
export type Domain = 'general' | 'business' | 'relational' | 'legal' | 'medical' | 'safety' | 'technical' | 'scientific' | 'creative' | 'spiritual' | 'other';

export interface PgsTime {
  eventTime?: string;
  deadline?: string;
  duration?: string;
  frequency?: string;
  temporalStatus?: 'explicit' | 'relative' | 'implicit' | 'unknown';
}

export interface PgsNegation {
  present: boolean;
  text?: string;
  necessary?: boolean;
  reason?: string;
}

export interface PgsAmbiguity {
  present: boolean;
  unresolvedFields?: string[];
  candidateInterpretations?: string[];
}

export interface PgsProposition {
  id: string;
  sourceSpan: string;
  context?: string | null;
  actor?: string | null;
  actionOrRelation?: string | null;
  objectOrTarget?: string | null;
  observation?: string | null;
  interpretation?: string | null;
  intention?: string | null;
  desiredState?: string | null;
  requestedAction?: string | null;
  responsibleParty?: string | null;
  time?: PgsTime;
  conditions?: string[];
  quantities?: string[];
  polarity: Polarity;
  negation?: PgsNegation;
  epistemicStatus: EpistemicStatus;
  confidence?: number | null;
  speechAct: SpeechAct;
  modality?: Modality;
  domain?: Domain;
  evidence?: string[];
  ambiguity?: PgsAmbiguity;
  protectedContent?: string[];
  triggeredRules?: string[];
  triggeredPatterns?: string[];
  exceptions?: string[];
  researchAnnotations?: string[];
  fidelityStatus: FidelityStatus;
  unresolved?: string[];
}

export interface PgsDocument {
  source: string;
  propositions: PgsProposition[];
}

export interface ValidationIssue {
  code: string;
  severity: 'warning' | 'error';
  propositionId?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}
