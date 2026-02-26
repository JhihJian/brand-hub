/**
 * Cache service using lru-cache
 * Manages SMS verification codes and rate limits
 */

const { LRUCache } = require('lru-cache');
const { config } = require('../config');

// Cache instances
let codeStore = null;
let cooldownStore = null;
let dailyLimitStore = null;
let ipLimitStore = null;

/**
 * Initialize all cache stores
 */
function initCache() {
  const cacheOptions = {
    max: 10000,
    ttlAutopurge: true,
  };

  codeStore = new LRUCache({
    ...cacheOptions,
    ttl: config.rateLimits.smsCodeExpiry * 1000, // 5 minutes
  });

  cooldownStore = new LRUCache({
    ...cacheOptions,
    ttl: config.rateLimits.smsCooldown * 1000, // 60 seconds
  });

  // Daily limit: TTL until end of day
  dailyLimitStore = new LRUCache({
    ...cacheOptions,
    ttl: getTtlUntilMidnight(),
  });

  ipLimitStore = new LRUCache({
    ...cacheOptions,
    ttl: 3600000, // 1 hour
  });
}

/**
 * Calculate TTL until midnight (for daily limits)
 */
function getTtlUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight - now;
}

/**
 * Get current date string for daily limit keys
 */
function getDateString() {
  return new Date().toISOString().split('T')[0];
}

/**
 * SMS Code operations
 */
function saveSmsCode(phone, code) {
  const key = `code:${phone}`;
  codeStore.set(key, { code, attempts: 0 });
}

function getSmsCode(phone) {
  const key = `code:${phone}`;
  return codeStore.get(key);
}

function verifySmsCode(phone, inputCode) {
  const key = `code:${phone}`;
  const stored = codeStore.get(key);

  if (!stored) {
    return { valid: false, reason: 'expired' };
  }

  if (stored.attempts >= config.rateLimits.smsMaxAttempts) {
    codeStore.delete(key);
    return { valid: false, reason: 'max_attempts' };
  }

  if (stored.code !== inputCode) {
    stored.attempts += 1;
    codeStore.set(key, stored);
    return { valid: false, reason: 'incorrect', attempts: stored.attempts };
  }

  // Valid code, delete it
  codeStore.delete(key);
  return { valid: true };
}

function deleteSmsCode(phone) {
  codeStore.delete(`code:${phone}`);
}

/**
 * Cooldown operations
 */
function setCooldown(phone) {
  cooldownStore.set(`cooldown:${phone}`, true);
}

function isInCooldown(phone) {
  return cooldownStore.has(`cooldown:${phone}`);
}

function getCooldownRemaining(phone) {
  const key = `cooldown:${phone}`;
  const ttl = cooldownStore.getRemainingTTL(key);
  return ttl > 0 ? Math.ceil(ttl / 1000) : 0;
}

/**
 * Daily limit operations
 */
function incrementDailyLimit(phone) {
  const key = `daily:${phone}:${getDateString()}`;
  const current = dailyLimitStore.get(key) || 0;
  dailyLimitStore.set(key, current + 1);
  return current + 1;
}

function getDailyCount(phone) {
  const key = `daily:${phone}:${getDateString()}`;
  return dailyLimitStore.get(key) || 0;
}

/**
 * IP limit operations
 */
function incrementIpLimit(ip) {
  const key = `ip:${ip}`;
  const current = ipLimitStore.get(key) || 0;
  ipLimitStore.set(key, current + 1);
  return current + 1;
}

function getIpCount(ip) {
  return ipLimitStore.get(`ip:${ip}`) || 0;
}

/**
 * Clear all caches (for testing)
 */
function clearCache() {
  codeStore?.clear();
  cooldownStore?.clear();
  dailyLimitStore?.clear();
  ipLimitStore?.clear();
}

module.exports = {
  initCache,
  clearCache,
  // SMS Code
  saveSmsCode,
  getSmsCode,
  verifySmsCode,
  deleteSmsCode,
  // Cooldown
  setCooldown,
  isInCooldown,
  getCooldownRemaining,
  // Daily limit
  incrementDailyLimit,
  getDailyCount,
  // IP limit
  incrementIpLimit,
  getIpCount,
};