require('dotenv').config();

const Cormorants = require('./index');

const {
  ACCESS_TOKEN_KEY,
  ACCESS_TOKEN_SECRET,
  CONSUMER_KEY,
  CONSUMER_SECRET,
  BLOG_NAME,
  BANNED_WORDS,
  CORMORANTS_MODEL_NAME,
  CORMORANTS_CORPUS,
} = process.env;

const mysteries = new Cormorants({
  accessTokenKey: ACCESS_TOKEN_KEY,
  accessTokenSecret: ACCESS_TOKEN_SECRET,
  consumerKey: CONSUMER_KEY,
  consumerSecret: CONSUMER_SECRET,
  blogName: BLOG_NAME,
  modelName: CORMORANTS_MODEL_NAME,
  corpus: CORMORANTS_CORPUS,
  isVerbose: true,
  bannedWords: (BANNED_WORDS || '').split(','),
});

(async function () {
  console.log(await mysteries.speak());
  process.exit(0);
})();
