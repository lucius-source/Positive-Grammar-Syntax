# PGS Email Procedure

## Purpose

This procedure applies the universal Positive Grammar Syntax specification to email communications and to text-based documents associated with an email. It does not create a separate grammar for email.

## Operating modes

An email workflow may request one or more of:

1. **Analyse** — inspect the communication without rewriting it.
2. **Score** — evaluate applicable PGS dimensions.
3. **Suggest** — recommend changes while retaining the source.
4. **Transform** — produce a revised communication.
5. **Compare** — show material changes between source and transformed versions.
6. **Explain** — identify why each recommendation or change follows from PGS.

## Procedure

### 1. Establish communication context

Where available, identify:

- sender and intended recipient role;
- purpose of the communication;
- whether it initiates or responds to a thread;
- attachments or referenced documents;
- required formality or domain constraints;
- deadlines, requests and decisions already stated by the source.

Do not fabricate missing context.

### 2. Preserve source

Retain the complete original communication as the immutable source for comparison.

### 3. Identify propositions

Segment the communication into meaningful propositions, requests, assertions, questions and actions. Preserve the relationship between email text and attachments where that relationship affects meaning.

### 4. Apply PGS analysis

Evaluate each relevant proposition against PGS-001 through PGS-007. A rule may return:

- pass;
- opportunity;
- warning;
- protected exception;
- insufficient context;
- not applicable.

A communication does not fail merely because a rule is not applicable.

### 5. Apply protected-context checks

Before recommending transformation, check whether wording is legally, factually, logically, technically or safety sensitive. Preserve necessary negation, quoted text, evidential status, defined terms and operative wording.

For legal or formal documents, PGS improves expression but must not silently alter rights, duties, admissions, denials, allegations, reservations or procedural meaning.

### 6. Determine communication intent

Identify the intended outcome from the source. Where the source does not establish the intention, ask for clarification or mark the field unresolved rather than inventing it.

### 7. Generate recommendations

Recommendations should identify:

- affected text;
- rule ID;
- issue or opportunity;
- proposed treatment;
- expected clarity benefit;
- any semantic or domain risk.

### 8. Transform when requested

Produce a natural revised email preserving material meaning, facts, relationships and tone requirements. Prefer concise affirmative construction where appropriate, but never force every sentence into the same structure.

### 9. Verify fidelity

Compare source and transformed versions for:

- changed facts;
- changed actor or responsibility;
- changed certainty;
- changed time or deadline;
- changed request;
- changed legal or operative meaning;
- omitted material information;
- newly introduced claims.

Any unexplained material change blocks automatic acceptance.

### 10. Return structured output

A complete PGS email review should be capable of returning:

- source text;
- purpose/intent where known;
- per-rule findings;
- overall assessment;
- recommendations;
- transformed version when requested;
- change explanations;
- fidelity warnings;
- unresolved questions.

## Attachments

Attachments are analysed through the same PGS core specification using the relevant document adapter. The email adapter should identify cross-document dependencies such as `attached notice`, `the enclosed schedule`, or statements whose meaning depends on the attachment.

The system should never rewrite an attachment merely because it accompanies an email. Analysis and transformation are separate user-authorised operations.

## Training mode

For learning rather than automatic rewriting, the email adapter should explain the highest-value PGS opportunities and allow the user to attempt a revision before revealing a proposed transformation.
