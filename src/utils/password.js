/**
 * Password utilities using bcrypt
 */

const bcrypt = require('bcrypt');
const { config } = require('../config');

const BCRYPT_COST = config.bcryptCost || 12;

/**
 * Hash a password
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_COST);
}

/**
 * Verify a password against a hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if password matches
 */
async function verifyPassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

/**
 * Check if a hash needs rehashing (e.g., cost factor changed)
 * @param {string} hash - Hashed password
 * @returns {boolean} True if rehashing is needed
 */
function needsRehash(hash) {
  return bcrypt.getRounds(hash) !== BCRYPT_COST;
}

module.exports = {
  hashPassword,
  verifyPassword,
  needsRehash,
};
