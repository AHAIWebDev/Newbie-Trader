/**
 * Cache Service
 *
 * In-memory cache to avoid hammering external APIs during development.
 *
 * EDUCATIONAL NOTE: In production you'd replace this with Redis,
 * but for a hobby project running on one machine, in-memory is perfect.
 *
 * Cache TTLs (Time To Live) by data type:
 *   Stock prices:      5 minutes  (prices change, but not second-to-second for swing trading)
 *   Company details:   24 hours   (name/sector/description rarely changes)
 *   AI analysis:       10 minutes (expensive to generate, okay to reuse briefly)
 *   Historical bars:   15 minutes (daily bars don't change during the day)
 */
const NodeCache = require('node-cache');

// stdTTL: default seconds before a cached item expires
// checkperiod: how often (seconds) to scan for and delete expired items
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const TTL = {
  PRICE:      5 * 60,   // 5 minutes
  COMPANY:    24 * 60 * 60, // 24 hours
  ANALYSIS:   10 * 60,  // 10 minutes
  HISTORY:    15 * 60   // 15 minutes
};

/**
 * Get a cached value. Returns null if missing or expired.
 * @param {string} key
 */
const get = (key) => {
  const value = cache.get(key);
  if (value === undefined) return null;
  console.log(`[Cache HIT] ${key}`);
  return value;
};

/**
 * Store a value in the cache.
 * @param {string} key
 * @param {*}      value
 * @param {number} ttl   - Seconds until expiry (use TTL constants above)
 */
const set = (key, value, ttl) => {
  cache.set(key, value, ttl);
  console.log(`[Cache SET] ${key} (expires in ${ttl}s)`);
};

/**
 * Delete a specific cache entry.
 * Useful when you know data has changed.
 */
const del = (key) => cache.del(key);

/**
 * Clear the entire cache.
 * Useful during development when you want fresh data.
 */
const flush = () => {
  cache.flushAll();
  console.log('[Cache] Flushed all entries');
};

/**
 * Get cache statistics — helpful for debugging.
 */
const stats = () => cache.getStats();

module.exports = { get, set, del, flush, stats, TTL };