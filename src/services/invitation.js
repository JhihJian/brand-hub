/**
 * Invitation Service
 * Manages invitation codes
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { generateInviteCode } = require('../utils/validators');
const { createError, ErrorCodes } = require('../utils/errors');

/**
 * Create invitations batch
 * @param {Object} options
 * @param {number} options.count - Number of codes to generate (1-500)
 * @param {string} options.channel - Channel tag
 * @param {string} options.expiresAt - Expiration date
 * @param {string} options.presetMembership - Preset membership level
 * @param {number} options.presetDurationDays - Duration for monthly/yearly
 * @param {string} options.createdBy - Admin user sub
 * @returns {Array<{code: string}>}
 */
function createInvitations(options) {
  const {
    count,
    channel,
    expiresAt,
    presetMembership = 'free',
    presetDurationDays,
    createdBy,
  } = options;

  // Validate count
  if (count < 1 || count > 500) {
    throw createError(ErrorCodes.INVALID_PARAMS, 'count must be between 1 and 500');
  }

  // Validate membership
  const validMemberships = ['free', 'monthly', 'yearly', 'lifetime'];
  if (!validMemberships.includes(presetMembership)) {
    throw createError(ErrorCodes.INVALID_PARAMS, 'invalid preset_membership');
  }

  // Validate duration for monthly/yearly
  if ((presetMembership === 'monthly' || presetMembership === 'yearly') && !presetDurationDays) {
    throw createError(ErrorCodes.INVALID_PARAMS, 'preset_duration_days required for monthly/yearly');
  }

  const db = getDb();
  const codes = [];
  const insert = db.prepare(`
    INSERT INTO invitations (code, created_by, channel, preset_membership, preset_duration_days, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    for (let i = 0; i < count; i++) {
      let code;
      let attempts = 0;

      // Ensure unique code
      while (attempts < 10) {
        code = generateInviteCode();
        const existing = db.prepare('SELECT 1 FROM invitations WHERE code = ?').get(code);
        if (!existing) break;
        attempts++;
      }

      if (attempts >= 10) {
        throw new Error('Failed to generate unique invitation code');
      }

      insert.run(
        code,
        createdBy,
        channel,
        presetMembership,
        presetDurationDays,
        expiresAt
      );

      codes.push({ code });
    }
  });

  transaction();

  return codes;
}

/**
 * Validate invitation code
 * @param {string} code - Invitation code
 * @returns {Object} Invitation record
 */
function validateInvitationCode(code) {
  const db = getDb();
  const invitation = db.prepare('SELECT * FROM invitations WHERE code = ?').get(code);

  if (!invitation) {
    throw createError(ErrorCodes.INVITE_CODE_INVALID);
  }

  if (invitation.used_by) {
    throw createError(ErrorCodes.INVITE_CODE_USED);
  }

  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    throw createError(ErrorCodes.INVITE_CODE_EXPIRED);
  }

  return invitation;
}

/**
 * Mark invitation code as used
 * @param {string} code - Invitation code
 * @param {string} userSub - User who used the code
 */
function markInvitationUsed(code, userSub) {
  const db = getDb();
  db.prepare(`
    UPDATE invitations
    SET used_by = ?, used_at = datetime('now')
    WHERE code = ?
  `).run(userSub, code);
}

/**
 * Get invitations list with filters
 * @param {Object} options
 * @param {string} options.status - Filter by status (unused, used, expired)
 * @param {string} options.channel - Filter by channel
 * @param {string} options.presetMembership - Filter by preset membership
 * @param {number} options.page - Page number
 * @param {number} options.limit - Items per page
 * @returns {{items: Array, total: number}}
 */
function getInvitations(options = {}) {
  const db = getDb();
  const { status, channel, presetMembership, page = 1, limit = 20 } = options;
  const offset = (page - 1) * limit;

  let sql = 'SELECT * FROM invitations WHERE 1=1';
  const params = [];

  if (status) {
    if (status === 'unused') {
      sql += ' AND used_by IS NULL AND (expires_at IS NULL OR expires_at > datetime("now"))';
    } else if (status === 'used') {
      sql += ' AND used_by IS NOT NULL';
    } else if (status === 'expired') {
      sql += ' AND expires_at IS NOT NULL AND expires_at <= datetime("now") AND used_by IS NULL';
    }
  }

  if (channel) {
    sql += ' AND channel = ?';
    params.push(channel);
  }

  if (presetMembership) {
    sql += ' AND preset_membership = ?';
    params.push(presetMembership);
  }

  // Count total
  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
  const countResult = db.prepare(countSql).get(...params);
  const total = countResult.count;

  // Get items
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const items = db.prepare(sql).all(...params);

  return { items, total, page, limit };
}

module.exports = {
  createInvitations,
  validateInvitationCode,
  markInvitationUsed,
  getInvitations,
};