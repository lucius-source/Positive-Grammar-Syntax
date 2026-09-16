export interface ParsedSentence {
  source: string;
  tokens: string[];
  sentenceType: 'statement' | 'question' | 'command' | 'unknown';
  polarity: 'affirmative' | 'negative' | 'mixed';
  negationTokens: string[];
  temporalTokens: string[];
  modalTokens: string[];
  pronounTokens: string[];
}

const NEGATION = new Set(['not', "don't", 'dont', "doesn't", 'doesnt', "didn't", 'didnt', "isn't", 'isnt', "aren't", 'arent', "wasn't", 'wasnt', "weren't", 'werent', "won't", 'wont', "wouldn't", 'wouldnt', "can't", 'cant', 'cannot', "shouldn't", 'shouldnt', "mustn't", 'mustnt', 'no', 'never', 'nothing', 'nobody']);
const MODALS = new Set(['can', 'could', 'may', 'might', 'must', 'shall', 'should', 'will', 'would', "can't", "won't", "shouldn't", "mustn't"]);
const PRONOUNS = new Set(['i', 'me', 'my', 'mine', 'you', 'your', 'yours', 'he', 'him', 'his', 'she', 'her', 'hers', 'it', 'its', 'we', 'us', 'our', 'ours', 'they', 'them', 'their', 'theirs', 'this', 'that', 'these', 'those']);
const TEMPORAL = new Set(['today', 'tomorrow', 'yesterday', 'now', 'soon', 'later', 'asap', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);

export function tokenize(text: string): string[] {
  return text.match(/[£$€]?\d+(?:[.,]\d+)*|[A-Za-z]+(?:['’-][A-Za-z]+)*|[^\sA-Za-z0-9]/g) ?? [];
}

export function parseSentence(text: string): ParsedSentence {
  const tokens = tokenize(text);
  const words = tokens.map(t => t.toLowerCase().replace(/[’]/g, "'"));
  const negationTokens = words.filter(w => NEGATION.has(w));
  const temporalTokens = words.filter(w => TEMPORAL.has(w));
  const modalTokens = words.filter(w => MODALS.has(w));
  const pronounTokens = words.filter(w => PRONOUNS.has(w));

  let sentenceType: ParsedSentence['sentenceType'] = 'statement';
  if (/\?\s*$/.test(text)) sentenceType = 'question';
  else if (/^\s*(?:please\s+)?(?:do|don't|do not|stop|start|arrive|send|confirm|provide|remain|submit|take)\b/i.test(text)) sentenceType = 'command';

  return {
    source: text,
    tokens,
    sentenceType,
    polarity: negationTokens.length ? 'negative' : 'affirmative',
    negationTokens,
    temporalTokens,
    modalTokens,
    pronounTokens,
  };
}
