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
    modelName = 'deepset/bert-base-cased-squad2',
    bannedWords = [],
    maxCorpusLength = 10000,
    isVerbose = false,
    isIncludeMedia = false,
    filterText = null,
  }) {
    this.client = tumblr.createClient({
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
      token: accessTokenKey,
      token_secret: accessTokenSecret,
      returnPromises: true,
    });
    this.modelName = modelName;
    this.corpus = corpus;
    this.maxCorpusLength = maxCorpusLength;
    this.blogName = blogName;
    this.bannedWords;
    this.badWords = new BadWords();
    this.badWords.addWords(...bannedWords);
    this.badWords.removeWords('God');
    this.isVerbose = isVerbose;
    this.isIncludeMedia = isIncludeMedia;
    this.filterText = filterText;
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
    const text = this.question(post);
    if (!this.isIncludeMedia) {
      if (post.content.some(({ type }) => type !== 'text')) {
        if (this.isVerbose) {
          console.log(`🦅 Skipping [media]: ${text}`);
        }
        return false;
      }
    }
    if (this.filterText) {
      if (text.toLowerCase().indexOf(this.filterText.toLowerCase()) === -1) {
        if (this.isVerbose) {
          console.log(
            `🦅 Skipping ["${this.filterText}"]: ${text}`
          );
        }
        return false;
      }
    }
    if (this.badWords.isProfane(text)) {
      if (this.isVerbose) {
        console.log(`🦅 Skipping [profanity]: ${text}`);
      }
      return false;
    }
    return true;
  }

  images(post) {
    const images = post.content.filter(({ type }) => type === 'image');
    return images.map((image) => {
      const { type, url, width, height } = image.media[0];
      return { type, url, width, height };
    });
  }

  question(post) {
    const line = compact(map(post.content, 'text'))
      .join(' ')
      .replace(/\s{2,}/g, ' ');
    const clean = line.trim().replace(/[.,?:]$/, '');
    return `${clean}?`;
  }

  async answer(question) {
    // Truly batshit crazy, but Tensorflow versions step all over each other so we need to sandbox it.
    const cmd = `node "${__dirname}/ask.js" "${this.modelName}" "${question}" "${this.corpus}" ${this.maxCorpusLength}`;
    const result = exec(cmd, { silent: false });
    if (result.code !== 0) {
      throw new Error(`Shell command error: ${result.stderr.trim()}\n> ${cmd}`);
    }
    const stdout = result.stdout.trim();
    const matches = stdout.match(/<answer>([\s\S]*)<\/answer>/);
    const text = matches ? matches[1] : '';
    if (this.badWords.isProfane(text)) {
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
    const answer = await this.answer(question);
    const images = this.images(ask);
    return {
      images,
      ask,
      question,
      answer,
    };
  }
}

module.exports = Cormorants;
