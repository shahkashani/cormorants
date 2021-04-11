const { readFileSync } = require('fs');
const { QAClient, initModel } = require('question-answering');
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
  const modelName = process.argv[2];
  const question = process.argv[3];
  const corpusFile = process.argv[4];
  const maxCorpusLength = process.argv[5]
    ? parseInt(process.argv[5], 10)
    : 10000;

  console.log(`🦅 Model: ${modelName}`);
  console.log(`🦅 Corpus: ${corpusFile}`);
  console.log(`🦅 Length: ${maxCorpusLength}`);
  console.log(`🦅 Question: ${question}`);

  const string = readFileSync(corpusFile);
  const text = corpusFile.endsWith('pdf')
    ? (await pdf(string)).text
    : string.toString();
  const corpus = getCorpus(text, maxCorpusLength);
  const model = await initModel({
    name: modelName,
  });
  const qaClient = await QAClient.fromOptions({ model });
  const { text: answer } = await qaClient.predict(question, corpus);
  console.log(`<answer>${answer}</answer>`);
  process.exit(0);
})();
