require('dotenv').config();

const Cormorants = require('./index');

const {
  ACCESS_TOKEN_KEY,
  ACCESS_TOKEN_SECRET,
  CONSUMER_KEY,
  CONSUMER_SECRET,
  BLOG_NAME,
} = process.env;

const mysteries = new Cormorants({
  tumblrConfig: {
    accessTokenKey: ACCESS_TOKEN_KEY,
    accessTokenSecret: ACCESS_TOKEN_SECRET,
    consumerKey: CONSUMER_KEY,
    consumerSecret: CONSUMER_SECRET,
    blogName: BLOG_NAME,
  },
});

(async function () {
  console.log(await mysteries.getAllAsks());
  process.exit(0);
})();
