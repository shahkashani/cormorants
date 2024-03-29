const tumblr = require('tumblr.js');

const TYPE_ASK = 'ask';
const TYPE_IMAGE = 'image';
const TYPE_TEXT = 'text';

class Cormorants {
  constructor({
    tumblrConfig: {
      consumerKey,
      consumerSecret,
      accessTokenKey,
      accessTokenSecret,
      blogName,
    },
  }) {
    this.client = tumblr.createClient({
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
      token: accessTokenKey,
      token_secret: accessTokenSecret,
    });
    this.blogName = blogName;
  }

  getRest(post) {
    const { layout, content } = post;
    const ask = layout.find(({ type }) => type === TYPE_ASK);
    if (!ask) {
      return null;
    }
    return content.filter((_c, i) => ask.blocks.indexOf(i) === -1);
  }

  filter(post) {
    const rest = this.getRest(post);
    return rest && !rest.find(({ type }) => type === TYPE_IMAGE);
  }

  async posts() {
    const results = [];
    let isTraversing = true;
    let beforeId = undefined;
    while (isTraversing) {
      const { posts, _links } = await this.client.blogDrafts(this.blogName, {
        npf: true,
        limit: 50,
        before_id: beforeId,
      });
      const asks = posts.filter((p) => this.filter(p));
      results.push.apply(results, asks);
      if (posts.length === 0 || !_links || !_links.next) {
        isTraversing = false;
      } else {
        beforeId = _links.next.query_params.before_id;
      }
    }
    return results;
  }

  getCaptions(post) {
    const rest = this.getRest(post);
    return rest
      ? this.getRest(post)
          .filter(({ type }) => type === TYPE_TEXT)
          .map(({ text }) => text)
          .map((text) => text.replace(/(^\[|\]$)/g, ''))
      : [];
  }

  format(ask) {
    return {
      ask,
      captions: this.getCaptions(ask),
    };
  }

  async getNextAsk() {
    const asks = await this.posts();
    if (asks.length === 0) {
      return null;
    }
    const [ask] = asks;
    return this.format(ask);
  }

  async getAllAsks() {
    const asks = await this.posts();
    if (asks.length === 0) {
      return null;
    }
    return asks.map((ask) => this.format(ask));
  }
}

module.exports = Cormorants;
