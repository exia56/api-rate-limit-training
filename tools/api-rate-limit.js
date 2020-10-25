/**
 * @typedef {{
 *  windowMs: number = 60000,
 *  limit: number = 60,
 *  clientIdCreator: (req: import('express').Request)=>void,
 *  onReachLimit: (
 *    req: import('express').Request,
 *    res: import('express').Response,
 *    next:  import('express').NextFunction) => void
 * }} ApiRateLimitOptions
 */

module.exports = class ApiRateLimit {
  static get DEFAULT_OPTIONS() {
    return Object.freeze(/** @type {ApiRateLimitOptions} */({
      windowMs: 60 * 1000,
      limit: 60,
      clientIdCreator: (req) => req.ip,
      onReachLimit: (res, req/** , next */) => {
        req.status(429).send('Too Many Requests');
      },
    }));
  }

  /**
   *
   * @param {ApiRateLimitOptions} options
   */
  constructor(options) {
    this.options = { ...ApiRateLimit.DEFAULT_OPTIONS, ...options };
    /** @type {Map<string, number>} */
    this.clientRateMapping = new Map();
    /** @type {number} */
    this.resetDate = Date.now() + this.options.windowMs;
    /** @type {NodeJS.Timeout} */
    this.resetInterval = null;
    this.startResetRateLimitInterval();

    this.middleware = this.middlewareInternal.bind(this);
  }

  stop() {
    if (this.resetInterval) {
      clearInterval(this.resetInterval);
    }
    this.clientRateMapping.clear();
  }

  /**
   * @private
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  middlewareInternal(req, res, next) {
    const { limit } = this.options;
    if (res.headersSent || req.rateLimit) {
      // skip if header sent or this request already handled
      next();
    }

    const clientKey = this.options.clientIdCreator(req);

    const clientRate = (this.clientRateMapping.get(clientKey) || 0) + 1;
    res.setHeader('RateLimit-Limit', limit);
    res.setHeader('RateLimit-Remaining', Math.max(0, limit - clientRate));
    const resetSecond = Math.max(0, Math.ceil((this.resetDate - Date.now()) / 1000));
    res.setHeader('RateLimit-Reset', resetSecond);
    req.rateLimit = {
      limit,
      remain: Math.max(clientRate - limit, 0),
      resetAfter: resetSecond,
    };
    if (clientRate <= limit) {
      this.clientRateMapping.set(clientKey, clientRate);
      next();
    } else {
      res.setHeader('Retry-After', resetSecond);
      this.options.onReachLimit(req, res, next);
    }
  }

  startResetRateLimitInterval() {
    const { windowMs } = this.options;
    this.resetInterval = setInterval(() => {
      this.clientRateMapping.clear();
      this.resetDate = Date.now() + windowMs;
    }, windowMs);
  }
};
