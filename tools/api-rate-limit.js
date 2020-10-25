const RateLimitStore = require('./rate-limit-store');
/**
 * @typedef {{
 *  windowMs: number,
 *  limit: number,
 *  store: import('./rate-limit-store').BaseRateLimitStore,
 *  clientIdCreator: (req: import('express').Request)=>void,
 *  onReachLimit: (
 *    req: import('express').Request,
 *    res: import('express').Response,
 *    next:  import('express').NextFunction) => void
 * }} ApiRateLimitOptions
 */

/**
 * @typedef {{
 *  limit: number,
 *  remain: number,
 *  resetAfter: number,
 * }} RateLimitInfo
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
      store: new RateLimitStore(),
    }));
  }

  /**
   *
   * @param {ApiRateLimitOptions} options
   */
  constructor(options) {
    this.options = { ...ApiRateLimit.DEFAULT_OPTIONS, ...options };
    /** @type {number} */
    this.resetDate = Date.now() + this.options.windowMs;
    /** @type {NodeJS.Timeout} */
    this.resetInterval = null;
    this.store = options.store || ApiRateLimit.DEFAULT_OPTIONS.store;
    this.startResetRateLimitInterval();

    this.middleware = this.middlewareInternal.bind(this);
  }

  async stop() {
    if (this.resetInterval) {
      clearInterval(this.resetInterval);
    }
    await this.store.clear();
  }

  /**
   * @private
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async middlewareInternal(req, res, next) {
    const { limit } = this.options;
    if (res.headersSent || req.rateLimit) {
      // skip if header sent or this request already handled
      next();
    }

    const clientKey = this.options.clientIdCreator(req);

    const clientRate = await this.store.increase(clientKey);
    res.setHeader('RateLimit-Limit', limit);
    const remain = Math.max(0, limit - clientRate);
    res.setHeader('RateLimit-Remaining', remain);
    const resetSecond = Math.max(0, Math.ceil((this.resetDate - Date.now()) / 1000));
    res.setHeader('RateLimit-Reset', resetSecond);
    req.rateLimit = {
      limit,
      remain,
      resetAfter: resetSecond,
    };
    if (clientRate > limit) {
      res.setHeader('Retry-After', resetSecond);
      this.options.onReachLimit(req, res, next);
      return;
    }
    next();
  }

  startResetRateLimitInterval() {
    const { windowMs } = this.options;
    this.resetInterval = setInterval(() => {
      this.store.clear();
      this.resetDate = Date.now() + windowMs;
    }, windowMs);
  }
};
