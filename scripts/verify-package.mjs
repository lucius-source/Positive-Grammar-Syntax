import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const publicModule = await import('../dist/public.js');
const expectedExports = [
  'OllamaSemanticEngine',
  'analyse',
  'analyseEmail',
  'analyseTextDocument',
  'applyApprovedEmailSuggestion',
  'applyApprovedTextDocumentSuggestion',
  'approveSuggestionApplication',
  'compare',
  'explain',
  'prepareSuggestionApplication',
  'prepareTextChange',
  'suggest',
  'suggestEmail',
  'suggestTextDocument',
];
const actualExports = Object.keys(publicModule).sort();
if (JSON.stringify(actualExports) !== JSON.stringify(expectedExports)) {
  throw new Error(`Unexpected public exports: ${actualExports.join(', ')}`);
}

const analysis = publicModule.analyse('I sent the document yesterday.');
if (!analysis.validation.valid || analysis.operation !== 'analyse') throw new Error('Built analyse operation failed verification.');
const comparison = publicModule.compare('Send the report.', 'Send the report by 2026-10-01.');
if (comparison.status !== 'blocked') throw new Error('Built compare operation failed verification.');
if (publicModule.analyseEmail({ subject: 'Status' }).operation !== 'analyse-email') throw new Error('Built email adapter failed verification.');
if (publicModule.analyseTextDocument({ format: 'plain_text', text: 'I sent it.' }).operation !== 'analyse-document') throw new Error('Built document adapter failed verification.');
if ((await publicModule.suggestEmail({ body: 'I sent the report yesterday.' }, { targets: [{ kind: 'body' }] })).operation !== 'suggest-email') throw new Error('Built email suggestion adapter failed verification.');
if ((await publicModule.suggestTextDocument({ format: 'plain_text', text: 'I sent the report yesterday.' }, { sectionIds: ['S1'] })).operation !== 'suggest-document') throw new Error('Built document suggestion adapter failed verification.');
const proposal = publicModule.prepareTextChange({ kind: 'body' }, 'Maybe it will work.', 'I am uncertain whether it will work.', 'PGS-L1');
const approved = publicModule.approveSuggestionApplication(proposal, { proposalId: proposal.proposalId, approved: true });
if (publicModule.applyApprovedEmailSuggestion({ body: proposal.source }, approved).body !== proposal.candidate) throw new Error('Built approval boundary failed verification.');

for (const path of ['dist/public.js', 'dist/public.d.ts', 'dist/api.js', 'dist/api.d.ts']) {
  if (!existsSync(resolve(path))) throw new Error(`Missing package artifact: ${path}`);
}

console.log(`Verified compiled package exports: ${actualExports.join(', ')}`);
