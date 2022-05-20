const { map, sample, upperFirst, compact, countBy } = require('lodash');
const tumblr = require('tumblr.js');
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
    maxCorpusLength = 10000,
    minWords = null,
    isVerbose = false,
    isIncludeMedia = false,
    filterText = null,
    setQuestion = null,
    setAnswer = null,
    moderation = null,
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
    this.isVerbose = isVerbose;
    this.isIncludeMedia = isIncludeMedia;
    this.filterText = filterText;
    this.setQuestion = setQuestion;
    this.setAnswer = setAnswer;
    this.minWords = minWords;
    this.moderation = moderation;
  }

  async filter(arr, callback) {
    const fail = Symbol();
    return (
      await Promise.all(
        arr.map(async (item) => ((await callback(item)) ? item : fail))
      )
    ).filter((i) => i !== fail);
  }

  async posts() {
    const results = [];
    let isTraversing = true;
    let beforeId = undefined;
    while (isTraversing) {
      if (this.isVerbose) {
        console.log(
          `🦅  Getting posts${beforeId ? ` (before ID ${beforeId})` : '...'}`
        );
      }
      const { posts, _links } = await this.client.blogSubmissions(
        this.blogName,
        {
          npf: true,
          limit: 50,
          before_id: beforeId,
        }
      );
      results.push.apply(results, posts);
      if (posts.length === 0 || !_links || !_links.next) {
        isTraversing = false;
      } else {
        beforeId = _links.next.query_params.before_id;
      }
    }
    return this.filter(results, (t) => this.filterFn(t));
  }

  async filterFn(post) {
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
          console.log(`🦅 Skipping ["${this.filterText}"]: ${text}`);
        }
        return false;
      }
    }
    if (this.moderation) {
      if (!(await this.moderation.validate(text))) {
        if (this.isVerbose) {
          console.log(`🦅 Skipping [profanity]: ${text}`);
        }
        return false;
      }
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
    const cleanQ = question.replace(/(["])/g, '\\$1');
    // Truly batshit crazy, but Tensorflow versions step all over each other so we need to sandbox it.
    const cmd = `node "${__dirname}/ask.js" "${this.modelName}" "${cleanQ}" "${this.corpus}" ${this.maxCorpusLength}`;
    const result = exec(cmd, { silent: false });
    if (result.code !== 0) {
      throw new Error(`Shell command error: ${result.stderr.trim()}\n> ${cmd}`);
    }
    const stdout = result.stdout.trim();
    const matches = stdout.match(/<answer>([\s\S]*)<\/answer>/);
    const text = matches ? matches[1] : '';
    if (
      (this.moderation && !(await this.moderation.validate(text))) ||
      (this.minWords && text.split(/\s/).length < this.minWords)
    ) {
      return await this.answer(question);
    }
    return this.toSentence(text);
  }

  count(str, ch) {
    return countBy(str)[ch] || 0;
  }

  toClean(text) {
    const bookends = [
      ['“', '”'],
      ['(', ')'],
      ['[', ']'],
    ];
    const doubles = ['"'];
    let sanitized = text.trim();
    bookends.forEach(([open, close]) => {
      if (sanitized.indexOf(open) === -1 || sanitized.indexOf(close) === -1) {
        sanitized = sanitized.replace(open, '').replace(close, '');
      }
    });
    doubles.forEach((double) => {
      if (this.count(sanitized, double) === 1) {
        sanitized = sanitized.replace(double, '');
      }
    });
    return sanitized;
  }

  toSentence(rawString) {
    if (!rawString) {
      return '';
    }
    const string = this.toClean(rawString);
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
    console.log(`🦅 Ask: ${this.question(ask)}`);
    console.log(JSON.stringify(ask, null, 2));
    const question = this.setQuestion || this.question(ask);
    const answer = this.setAnswer || (await this.answer(question));
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
