/**
 * Membership Service
 * Manages user membership status
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { createError, ErrorCodes } = require('../utils/errors');

/**
 * Create or update membership
 * @param {Object} options
 * @param {string} options.userSub - User subject ID
 * @param {string} options.plan - Membership plan
 * @param {number} options.durationDays - Duration in days
 * @param {string} options.source - Source (self, invitation, admin)
 * @returns {Object} Membership record
 */
function createMembership(options) {
  const { userSub, plan, durationDays, source } = options;
  const db = getDb();

  // Check for active membership
  const existing = db.prepare(`
    SELECT * FROM memberships
    WHERE user_sub = ? AND status = 'active'
  `).get(userSub);

  if (existing) {
    throw createError(ErrorCodes.ACTIVE_MEMBERSHIP_EXISTS);
  }

  const id = uuidv4();
  const now = new Date();
  let expiresAt = null;

  if (plan !== 'lifetime' && durationDays) {
    expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
  }

  db.prepare(`
    INSERT INTO memberships (id, user_sub, plan, status, starts_at, expires_at, source)
    VALUES (?, ?, ?, 'active', ?, ?, ?)
  `).run(id, userSub, plan, now.toISOString(), expiresAt?.toISOString(), source);

  return getActiveMembership(userSub);
}

/**
 * Get active membership for user
 * @param {string} userSub - User subject ID
 * @returns {Object|null} Membership record
 */
function getActiveMembership(userSub) {
  const db = getDb();

  // Get the latest active membership
  const membership = db.prepare(`
    SELECT * FROM memberships
    WHERE user_sub = ? AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(userSub);

  // Check if expired
  if (membership && membership.expires_at) {
    if (new Date(membership.expires_at) < new Date()) {
      // Mark as expired
      db.prepare(`
        UPDATE memberships SET status = 'expired' WHERE id = ?
      `).run(membership.id);
      return null;
    }
  }

  return membership;
}

/**
 * Subscribe to membership
 * @param {string} userSub - User subject ID
 * @param {string} plan - Plan to subscribe (monthly, yearly)
 * @returns {Object} Membership record
 */
function subscribe(userSub, plan) {
  if (plan === 'lifetime') {
    throw createError(ErrorCodes.INVALID_PARAMS, 'lifetime membership cannot be self-subscribed');
  }

  if (plan === 'free') {
    throw createError(ErrorCodes.INVALID_PARAMS, 'cannot subscribe to free plan');
  }

  const durationDays = plan === 'monthly' ? 30 : 365;

  return createMembership({
    userSub,
    plan,
    durationDays,
    source: 'self',
  });
}

/**
 * Cancel membership
 * @param {string} userSub - User subject ID
 * @returns {Object} Cancelled membership
 */
function cancelMembership(userSub) {
  const db = getDb();

  const membership = getActiveMembership(userSub);

  if (!membership) {
    throw createError(ErrorCodes.NOT_FOUND, 'no active membership found');
  }

  if (membership.plan === 'lifetime') {
    throw createError(ErrorCodes.LIFETIME_CANNOT_CANCEL);
  }

  db.prepare(`
    UPDATE memberships
    SET status = 'cancelled', cancelled_at = datetime('now')
    WHERE id = ?
  `).run(membership.id);

  return { ...membership, status: 'cancelled' };
}

/**
 * Admin: Grant membership to user
 * @param {string} userSub - User subject ID
 * @param {string} plan - Membership plan
 * @param {number} durationDays - Duration (optional for lifetime)
 * @returns {Object} Membership record
 */
function grantMembership(userSub, plan, durationDays = null) {
  const db = getDb();

  // Cancel any existing active membership
  db.prepare(`
    UPDATE memberships
    SET status = 'cancelled', cancelled_at = datetime('now')
    WHERE user_sub = ? AND status = 'active'
  `).run(userSub);

  // Determine duration
  let expiresAt = null;
  if (plan !== 'lifetime') {
    const days = durationDays || (plan === 'monthly' ? 30 : 365);
    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO memberships (id, user_sub, plan, status, starts_at, expires_at, source)
    VALUES (?, ?, ?, 'active', datetime('now'), ?, 'admin')
  `).run(id, userSub, plan, expiresAt?.toISOString());

  return getActiveMembership(userSub);
}

/**
 * Get membership history for user
 * @param {string} userSub - User subject ID
 * @returns {Array} Membership records
 */
function getMembershipHistory(userSub) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM memberships
    WHERE user_sub = ?
    ORDER BY created_at DESC
  `).all(userSub);
}

module.exports = {
  createMembership,
  getActiveMembership,
  subscribe,
  cancelMembership,
  grantMembership,
  getMembershipHistory,
};