/**
 * @typedef {{
 *  increase: (clientKey: string) => Promise<number>,
 *  clear: () => Promise,
 * }} BaseRateLimitStore
 */

/**
 * @implements {BaseRateLimitStore}
 * @extends {Map<string, number}
*/
module.exports = class RateLimitStore extends Map {
  /**
   *
   * @param {sting} clientKey
   */
  async increase(clientKey) {
    const clientRate = (this.get(clientKey) || 0) + 1;
    this.set(clientKey, clientRate);
    return clientRate;
  }

  /**
   * @override
   */
  async clear() {
    super.clear();
  }
};
