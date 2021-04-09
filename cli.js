require('dotenv').config();

const Cormorants = require('./index');
const { readFileSync } = require('fs');

const {
  ACCESS_TOKEN_KEY,
  ACCESS_TOKEN_SECRET,
  CONSUMER_KEY,
  CONSUMER_SECRET,
  BLOG_NAME,
  BANNED_WORDS,
} = process.env;

const corpus = readFileSync(
  '../fieriframes/captions/lyrics/joanna-newsom-ys.txt'
).toString();

const mysteries = new Cormorants({
  corpus,
  accessTokenKey: ACCESS_TOKEN_KEY,
  accessTokenSecret: ACCESS_TOKEN_SECRET,
  consumerKey: CONSUMER_KEY,
  consumerSecret: CONSUMER_SECRET,
  blogName: BLOG_NAME,
  bannedWords: (BANNED_WORDS || '').split(','),
});

(async function () {
  console.log(await mysteries.speak());
  process.exit(0);
})();
