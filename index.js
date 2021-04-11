const { map, sample, random, upperFirst, compact } = require('lodash');
const tumblr = require('tumblr.js');
const BadWords = require('bad-words');
const { exec } = require('shelljs');

class Cormorants {
  constructor({
    consumerKey,
    consumerSecret,
    accessTokenKey,
    accessTokenSecret,
    blogName,
    corpus,
    bannedWords = [],
    maxCorpusLength = 10000,
    forceAnswer,
  }) {
    this.client = tumblr.createClient({
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
      token: accessTokenKey,
      token_secret: accessTokenSecret,
      returnPromises: true,
    });
    this.corpus = corpus;
    this.maxCorpusLength = maxCorpusLength;
    this.blogName = blogName;
    this.bannedWords;
    this.forceAnswer = forceAnswer;
    this.badWords = new BadWords();
    this.badWords.addWords(...bannedWords);
    this.badWords.removeWords('God');
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

  async answer(question) {
    // Truly batshit crazy, but Tensorflow versions step all over each other so we need to sandbox it.
    const cmd = `node "${__dirname}/ask.js" "${question}" "${this.corpus}" ${this.maxCorpusLength}`;
    const result = exec(cmd, { silent: false });
    if (result.code !== 0) {
      throw new Error(`Shell command error: ${result.stderr.trim()}\n> ${cmd}`);
    }
    const stdout = result.stdout.trim();
    const matches = stdout.match(/<answer>([\s\S]*)<\/answer>/);
    const text = matches ? matches[1] : '';
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
    const clean = string.replace(/[\n\r]/g, ' ').replace(/\s{2,}/g, ' ');
    return `${upperFirst(clean)}${punc}`;
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
    const answer = this.forceAnswer || (await this.answer(question));
    return {
      ask,
      question,
      answer,
    };
  }
}

module.exports = Cormorants;
