const express = require('express');
const ApiRateLimit = require('./tools/api-rate-limit');

// using default options
const apiRateLimit = new ApiRateLimit({
  onReachLimit: (req, res, next) => {
    console.log(req.ip, 'had reach rate limit', req.ratelimit);
    res.status(429).send('Error');
  },
});

const app = express();

app.use(apiRateLimit.middleware);

app.use('/some-api', (req, res) => {
  res.status(200).send('ok');
});

app.get('/', (req, res) => {
  const { rateLimit } = req;
  res.status(200).json(rateLimit);
});

app.listen(80, () => {
  console.log('server listen on 80 port');
});
