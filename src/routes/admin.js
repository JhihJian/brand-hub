/**
 * Admin Routes
 */

const { getDb } = require('../db');
const invitationService = require('../services/invitation');
const membershipService = require('../services/membership');
const tokenService = require('../services/token');
const { createError, ErrorCodes } = require('../utils/errors');
const validators = require('../utils/validators');

/**
 * POST /admin/invitations/batch
 * Generate invitation codes in batch
 */
async function createInvitationsBatch(request, reply) {
  const adminSub = request.user.sub;
  const {
    count,
    channel,
    expires_at,
    preset_membership = 'free',
    preset_duration_days,
  } = request.body;

  const codes = invitationService.createInvitations({
    count,
    channel,
    expiresAt: expires_at,
    presetMembership: preset_membership,
    presetDurationDays: preset_duration_days,
    createdBy: adminSub,
  });

  return reply.status(201).send({
    codes,
    count: codes.length,
  });
}

/**
 * GET /admin/invitations
 * List invitations with filters
 */
async function listInvitations(request, reply) {
  const { status, channel, preset_membership, page = 1, limit = 20 } = request.query;

  const result = invitationService.getInvitations({
    status,
    channel,
    presetMembership: preset_membership,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  });

  return reply.status(200).send(result);
}

/**
 * GET /admin/users
 * List users with search and pagination
 */
async function listUsers(request, reply) {
  const { search, page = 1, limit = 20 } = request.query;
  const db = getDb();
  const offset = (page - 1) * limit;

  let sql = `
    SELECT u.sub, u.phone, u.nickname, u.status, u.roles, u.created_at,
           m.plan as membership_plan, m.expires_at as membership_expires
    FROM users u
    LEFT JOIN memberships m ON u.sub = m.user_sub AND m.status = 'active'
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    sql += ' AND u.phone LIKE ?';
    params.push(`%${search}%`);
  }

  // Count total
  const countSql = sql.replace(
    /SELECT u\.sub.*FROM users u/,
    'SELECT COUNT(*) as count FROM users u'
  );
  const countResult = db.prepare(countSql).get(...params);
  const total = countResult.count;

  // Get items
  sql += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const users = db.prepare(sql).all(...params);

  return reply.status(200).send({
    items: users.map(u => ({
      sub: u.sub,
      phone: u.phone,
      nickname: u.nickname,
      status: u.status,
      roles: u.roles.split(','),
      membership: {
        plan: u.membership_plan || 'free',
        expires_at: u.membership_expires,
      },
      created_at: u.created_at,
    })),
    total,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  });
}

/**
 * GET /admin/users/:sub
 * Get user details
 */
async function getUser(request, reply) {
  const { sub } = request.params;
  const db = getDb();

  const user = db.prepare(`
    SELECT sub, phone, nickname, status, roles, created_at, updated_at
    FROM users WHERE sub = ?
  `).get(sub);

  if (!user) {
    throw createError(ErrorCodes.NOT_FOUND, 'user not found');
  }

  // Get membership history
  const memberships = membershipService.getMembershipHistory(sub);

  // Get invitation used
  const invitation = db.prepare(`
    SELECT code, preset_membership, used_at
    FROM invitations WHERE used_by = ?
  `).get(sub);

  return reply.status(200).send({
    sub: user.sub,
    phone: user.phone,
    nickname: user.nickname,
    status: user.status,
    roles: user.roles.split(','),
    invitation: invitation ? {
      code: invitation.code,
      preset_membership: invitation.preset_membership,
      used_at: invitation.used_at,
    } : null,
    memberships: memberships.map(m => ({
      id: m.id,
      plan: m.plan,
      status: m.status,
      starts_at: m.starts_at,
      expires_at: m.expires_at,
      source: m.source,
      cancelled_at: m.cancelled_at,
    })),
    created_at: user.created_at,
  });
}

/**
 * PATCH /admin/users/:sub/status
 * Update user status
 */
async function updateUserStatus(request, reply) {
  const { sub } = request.params;
  const { status } = request.body;

  if (!validators.isValidStatus(status)) {
    throw createError(ErrorCodes.INVALID_PARAMS, 'invalid status');
  }

  const db = getDb();

  const user = db.prepare('SELECT 1 FROM users WHERE sub = ?').get(sub);
  if (!user) {
    throw createError(ErrorCodes.NOT_FOUND, 'user not found');
  }

  db.prepare(`
    UPDATE users SET status = ?, updated_at = datetime('now') WHERE sub = ?
  `).run(status, sub);

  // If suspended, revoke all refresh tokens
  if (status === 'suspended') {
    tokenService.revokeAllRefreshTokens(sub);
  }

  return reply.status(200).send({
    sub,
    status,
  });
}

/**
 * POST /admin/users/:sub/membership
 * Grant membership to user
 */
async function grantUserMembership(request, reply) {
  const { sub } = request.params;
  const { plan, duration_days } = request.body;

  if (!validators.isValidPlan(plan)) {
    throw createError(ErrorCodes.INVALID_PARAMS, 'invalid plan');
  }

  const db = getDb();

  const user = db.prepare('SELECT 1 FROM users WHERE sub = ?').get(sub);
  if (!user) {
    throw createError(ErrorCodes.NOT_FOUND, 'user not found');
  }

  const membership = membershipService.grantMembership(sub, plan, duration_days);

  return reply.status(201).send({
    id: membership.id,
    user_sub: sub,
    plan: membership.plan,
    status: membership.status,
    starts_at: membership.starts_at,
    expires_at: membership.expires_at,
    source: 'admin',
  });
}

/**
 * Register admin routes with Fastify instance
 * @param {FastifyInstance} fastify
 */
function registerRoutes(fastify) {
  // Invitations
  fastify.post('/admin/invitations/batch', {
    schema: {
      body: {
        type: 'object',
        required: ['count'],
        properties: {
          count: { type: 'integer', minimum: 1, maximum: 500 },
          channel: { type: 'string' },
          expires_at: { type: 'string', format: 'date-time' },
          preset_membership: { type: 'string', enum: ['free', 'monthly', 'yearly', 'lifetime'] },
          preset_duration_days: { type: 'integer', minimum: 1 },
        },
      },
    },
  }, createInvitationsBatch);

  fastify.get('/admin/invitations', listInvitations);

  // Users
  fastify.get('/admin/users', listUsers);

  fastify.get('/admin/users/:sub', getUser);

  fastify.patch('/admin/users/:sub/status', {
    schema: {
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['active', 'suspended'] },
        },
      },
    },
  }, updateUserStatus);

  fastify.post('/admin/users/:sub/membership', {
    schema: {
      body: {
        type: 'object',
        required: ['plan'],
        properties: {
          plan: { type: 'string', enum: ['free', 'monthly', 'yearly', 'lifetime'] },
          duration_days: { type: 'integer', minimum: 1 },
        },
      },
    },
  }, grantUserMembership);
}

module.exports = {
  registerRoutes,
  createInvitationsBatch,
  listInvitations,
  listUsers,
  getUser,
  updateUserStatus,
  grantUserMembership,
};