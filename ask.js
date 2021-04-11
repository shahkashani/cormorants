const { readFileSync } = require('fs');
const { QAClient } = require('question-answering');
const pdf = require('pdf-parse');
const { random } = require('lodash');

function getCorpus(corpus, maxCorpusLength) {
  if (maxCorpusLength === 0 || corpus.length <= maxCorpusLength) {
    return corpus;
  }
  const startIndex = random(0, corpus.length - maxCorpusLength);
  return corpus.slice(startIndex, startIndex + maxCorpusLength);
}

(async () => {
  const question = process.argv[2];
  const corpusFile = process.argv[3];
  const maxCorpusLength = process.argv[4]
    ? parseInt(process.argv[4], 10)
    : 10000;
  const string = readFileSync(corpusFile);
  const text = corpusFile.endsWith('pdf')
    ? (await pdf(string)).text
    : string.toString();
  const corpus = getCorpus(text, maxCorpusLength);
  const qaClient = await QAClient.fromOptions();
  const { text: answer } = await qaClient.predict(question, corpus);
  console.log(`<answer>${answer}</answer>`);
  process.exit(0);
})();
