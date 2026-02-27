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
let inviteTokenStore = null;
let inviteVerifyLimitStore = null;
let passwordFailedAttemptsStore = null;

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

  // Invite token store: 30 minutes TTL
  inviteTokenStore = new LRUCache({
    ...cacheOptions,
    ttl: 1800000, // 30 minutes
  });

  // Invite verify limit store: 1 minute TTL for rate limiting
  inviteVerifyLimitStore = new LRUCache({
    ...cacheOptions,
    ttl: 60000, // 1 minute
  });

  // Password failed attempts store: 15 minutes TTL
  passwordFailedAttemptsStore = new LRUCache({
    ...cacheOptions,
    ttl: 900000, // 15 minutes
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
 * Invite token operations
 */
function generateInviteToken(inviteCode) {
  const { v4: uuidv4 } = require('uuid');
  const token = uuidv4();
  inviteTokenStore.set(`invite:${token}`, {
    code: inviteCode,
    createdAt: Date.now(),
  });
  return token;
}

function getInviteToken(token) {
  return inviteTokenStore.get(`invite:${token}`);
}

function consumeInviteToken(token) {
  const key = `invite:${token}`;
  const data = inviteTokenStore.get(key);
  if (data) {
    inviteTokenStore.delete(key);
  }
  return data;
}

function isValidInviteToken(token) {
  return inviteTokenStore.has(`invite:${token}`);
}

/**
 * Invite verify rate limit operations
 */
function incrementInviteVerifyLimit(ip) {
  const key = `verify:${ip}`;
  const current = inviteVerifyLimitStore.get(key) || 0;
  inviteVerifyLimitStore.set(key, current + 1);
  return current + 1;
}

function getInviteVerifyCount(ip) {
  return inviteVerifyLimitStore.get(`verify:${ip}`) || 0;
}

/**
 * Password failed attempts operations
 */
function getPasswordFailedAttempts(phone) {
  return passwordFailedAttemptsStore.get(`pwd_failed:${phone}`) || 0;
}

function incrementPasswordFailedAttempts(phone) {
  const key = `pwd_failed:${phone}`;
  const current = passwordFailedAttemptsStore.get(key) || 0;
  passwordFailedAttemptsStore.set(key, current + 1);
  return current + 1;
}

function clearPasswordFailedAttempts(phone) {
  passwordFailedAttemptsStore.delete(`pwd_failed:${phone}`);
}

function isPasswordLocked(phone) {
  return getPasswordFailedAttempts(phone) >= 5;
}

/**
 * Clear all caches (for testing)
 */
function clearCache() {
  codeStore?.clear();
  cooldownStore?.clear();
  dailyLimitStore?.clear();
  ipLimitStore?.clear();
  inviteTokenStore?.clear();
  inviteVerifyLimitStore?.clear();
  passwordFailedAttemptsStore?.clear();
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
  // Invite token
  generateInviteToken,
  getInviteToken,
  consumeInviteToken,
  // Invite verify rate limit
  incrementInviteVerifyLimit,
  getInviteVerifyCount,
  // Password failed attempts
  getPasswordFailedAttempts,
  incrementPasswordFailedAttempts,
  clearPasswordFailedAttempts,
  isPasswordLocked,
};