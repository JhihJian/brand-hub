/**
 * JWT Token Service
 * Handles Access Token and Refresh Token generation and verification
 */

const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { config } = require('../config');
const { getDb } = require('../db');
const { createError, ErrorCodes } = require('../utils/errors');

let privateKey = null;
let publicKey = null;

/**
 * Load JWT keys
 */
function loadKeys() {
  const privateKeyPath = path.resolve(config.jwt.privateKeyPath);
  const publicKeyPath = path.resolve(config.jwt.publicKeyPath);

  if (!fs.existsSync(privateKeyPath)) {
    throw new Error(`Private key not found: ${privateKeyPath}`);
  }

  if (!fs.existsSync(publicKeyPath)) {
    throw new Error(`Public key not found: ${publicKeyPath}`);
  }

  privateKey = fs.readFileSync(privateKeyPath, 'utf8');
  publicKey = fs.readFileSync(publicKeyPath, 'utf8');
}

/**
 * Generate Access Token
 * @param {Object} user - User object with sub, nickname, roles
 * @param {Object} membership - Membership object with plan, expires_at
 * @param {Array<string>} audiences - List of product names
 * @returns {string} JWT token
 */
function generateAccessToken(user, membership, audiences = []) {
  const finalAudiences = audiences.length > 0 ? audiences : config.jwt.audiences;
  const payload = {
    sub: user.sub,
    iss: config.jwt.issuer,
    aud: finalAudiences,
    iat: Math.floor(Date.now() / 1000),
    nickname: user.nickname,
    'brand.membership': membership?.plan || 'free',
    'brand.membership_exp': membership?.expires_at || null,
    'brand.roles': user.roles?.split(',') || ['user'],
  };

  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: config.jwt.accessExpiresIn,
  });
}

/**
 * Verify Access Token
 * @param {string} token - JWT token
 * @returns {Object} Decoded payload
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: config.jwt.issuer,
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw createError(ErrorCodes.TOKEN_EXPIRED);
    }
    throw createError(ErrorCodes.TOKEN_INVALID);
  }
}

/**
 * Generate Refresh Token
 * @param {string} userSub - User subject ID
 * @param {string} deviceInfo - User agent string
 * @returns {Promise<{token: string, id: string}>}
 */
async function generateRefreshToken(userSub, deviceInfo = null) {
  const db = getDb();
  const id = uuidv4();
  const token = uuidv4(); // Simple random token
  const tokenHash = hashToken(token);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

  db.prepare(`
    INSERT INTO refresh_tokens (id, user_sub, token_hash, device_info, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userSub, tokenHash, deviceInfo, expiresAt.toISOString());

  return { token, id };
}

/**
 * Verify Refresh Token and rotate
 * @param {string} token - Refresh token
 * @returns {Promise<{user: Object, newToken: Object}>}
 */
async function verifyAndRotateRefreshToken(token) {
  const db = getDb();
  const tokenHash = hashToken(token);

  // Check if token was already used (replay detection)
  const usedToken = db.prepare('SELECT user_sub FROM used_token_hashes WHERE token_hash = ?').get(tokenHash);
  if (usedToken) {
    // Replay attack detected! Revoke all tokens for this user
    revokeAllRefreshTokens(usedToken.user_sub);
    throw createError(ErrorCodes.TOKEN_REVOKED);
  }

  // Find the token
  const storedToken = db.prepare(`
    SELECT rt.*, u.sub as user_sub, u.phone, u.nickname, u.status, u.roles
    FROM refresh_tokens rt
    JOIN users u ON rt.user_sub = u.sub
    WHERE rt.token_hash = ?
  `).get(tokenHash);

  if (!storedToken) {
    throw createError(ErrorCodes.TOKEN_REVOKED);
  }

  // Check expiration
  if (new Date(storedToken.expires_at) < new Date()) {
    db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(storedToken.id);
    throw createError(ErrorCodes.TOKEN_REVOKED);
  }

  // Check user status
  if (storedToken.status === 'suspended') {
    throw createError(ErrorCodes.ACCOUNT_SUSPENDED);
  }

  // Mark old token as used (for replay detection)
  db.prepare(`
    INSERT INTO used_token_hashes (token_hash, user_sub)
    VALUES (?, ?)
  `).run(tokenHash, storedToken.user_sub);

  // Delete old token
  db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(storedToken.id);

  // Get active membership
  const membership = db.prepare(`
    SELECT plan, expires_at
    FROM memberships
    WHERE user_sub = ? AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(storedToken.user_sub);

  // Generate new token
  const newToken = await generateRefreshToken(storedToken.user_sub, storedToken.device_info);

  return {
    user: {
      sub: storedToken.user_sub,
      phone: storedToken.phone,
      nickname: storedToken.nickname,
      roles: storedToken.roles,
    },
    membership,
    newToken,
  };
}

/**
 * Revoke refresh token
 * @param {string} token - Refresh token
 */
function revokeRefreshToken(token) {
  const db = getDb();
  const tokenHash = hashToken(token);
  db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(tokenHash);
}

/**
 * Revoke all refresh tokens for a user
 * @param {string} userSub - User subject ID
 */
function revokeAllRefreshTokens(userSub) {
  const db = getDb();
  db.prepare('DELETE FROM refresh_tokens WHERE user_sub = ?').run(userSub);
}

/**
 * Hash token for storage
 * @param {string} token
 * @returns {string}
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Get public key for JWKS
 * @returns {Object} JWKS format public key
 */
function getJwksPublicKey() {
  const { fromKey } = require('jose/dist/node/cjs/runtime/key.js');
  return fromKey(publicKey, { alg: 'RS256' });
}

/**
 * Get public key in PEM format
 * @returns {string}
 */
function getPublicKeyPem() {
  return publicKey;
}

module.exports = {
  loadKeys,
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  verifyAndRotateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  hashToken,
  getPublicKeyPem,
};