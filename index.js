const { map, sample, random, upperFirst, compact } = require('lodash');
const tumblr = require('tumblr.js');
const { QAClient, initModel } = require('question-answering');
const BadWords = require('bad-words');

class Cormorants {
  constructor({
    consumerKey,
    consumerSecret,
    accessTokenKey,
    accessTokenSecret,
    blogName,
    corpus,
    bannedWords = [],
    model = 'bert-large-cased-whole-word-masking-finetuned-squad',
    maxCorpusLength = 10000,
  }) {
    this.client = tumblr.createClient({
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
      token: accessTokenKey,
      token_secret: accessTokenSecret,
      returnPromises: true,
    });
    this.model = model;
    this.corpus = corpus;
    this.maxCorpusLength = maxCorpusLength;
    this.blogName = blogName;
    this.bannedWords;
    this.badWords = new BadWords();
    this.badWords.addWords(...bannedWords);
  }

  async posts() {
    const results = [];
    let isTraversing = true;
    let offset = 0;
    while (isTraversing) {
      const { posts, _links } = await this.client.blogSubmissions(
        this.blogName,
        {
          npf: true,
          offset,
        }
      );
      results.push.apply(results, posts);
      if (posts.length === 0 || !_links || !_links.next) {
        isTraversing = false;
      } else {
        offset = _links.next.query_params.offset;
      }
    }
    return results.filter((p) => this.filter(p));
  }

  filter(post) {
    if (post.content.some(({ type }) => type !== 'text')) {
      console.log(`Skipping (media): ${this.question(post)}`);
      return false;
    }
    const text = this.question(post);
    if (this.badWords.isProfane(text)) {
      console.log(`Skipping (content): ${this.question(post)}`);
      return false;
    }
    return true;
  }

  question(post) {
    return compact(map(post.content, 'text')).join(' ');
  }

  getCorpus() {
    if (
      !Number.isFinite(this.maxCorpusLength) ||
      this.corpus.length <= this.maxCorpusLength
    ) {
      return this.corpus;
    }
    const startIndex = random(0, this.corpus.length - this.maxCorpusLength);
    return this.corpus.slice(startIndex, startIndex + this.maxCorpusLength);
  }

  async answer(question) {
    const model = await initModel({
      name: this.model,
    });
    const qaClient = await QAClient.fromOptions({
      model,
    });
    const { text } = await qaClient.predict(question, this.getCorpus());
    if (this.badWords.isProfane(text)) {
      console.log(`Disregarding: ${text}`);
      return await this.answer(question);
    }
    return this.toSentence(text);
  }

  toSentence(string) {
    if (!string) {
      return '';
    }
    const punc = new RegExp(/[.?!]$/).test(string) ? '' : '.';
    return `${upperFirst(string)}${punc}`;
  }

  getBaseParams(apiPath) {
    return {
      ...this.client.requestOptions,
      url: this.client.baseUrl + apiPath,
      oauth: this.client.credentials,
    };
  }

  async speak() {
    const asks = await this.posts();
    if (asks.length === 0) {
      return null;
    }
    const ask = sample(asks);
    const question = this.question(ask);
    const answer = await this.answer(question);
    return {
      ask,
      question,
      answer,
    };
  }
}

module.exports = Cormorants;
