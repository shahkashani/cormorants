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
} = process.env;

const corpus = process.argv[2];

if (!corpus) {
  console.log('The first arg needs to be a corpus');
  process.exit(1);
}

const mysteries = new Cormorants({
  corpus,
  accessTokenKey: ACCESS_TOKEN_KEY,
  accessTokenSecret: ACCESS_TOKEN_SECRET,
  consumerKey: CONSUMER_KEY,
  consumerSecret: CONSUMER_SECRET,
  blogName: BLOG_NAME,
  modelName: CORMORANTS_MODEL_NAME,
  bannedWords: (BANNED_WORDS || '').split(','),
});

(async function () {
  console.log(await mysteries.speak());
  process.exit(0);
})();
