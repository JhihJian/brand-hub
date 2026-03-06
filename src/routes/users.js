/**
 * User Routes
 */

const { getDb } = require('../db');
const membershipService = require('../services/membership');
const tokenService = require('../services/token');
const { createError, ErrorCodes } = require('../utils/errors');
const validators = require('../utils/validators');

/**
 * GET /users/me
 * Get current user info
 */
async function getMe(request, reply) {
  const userSub = request.user.sub;
  const db = getDb();

  const user = db.prepare(`
    SELECT sub, phone, nickname, status, roles, created_at, updated_at
    FROM users WHERE sub = ?
  `).get(userSub);

  if (!user) {
    throw createError(ErrorCodes.NOT_FOUND, 'user not found');
  }

  const membership = membershipService.getActiveMembership(userSub);

  return reply.status(200).send({
    sub: user.sub,
    phone: user.phone,
    nickname: user.nickname,
    status: user.status,
    roles: user.roles.split(','),
    membership: {
      plan: membership?.plan || 'free',
      expires_at: membership?.expires_at || null,
      source: membership?.source || null,
    },
    created_at: user.created_at,
  });
}

/**
 * PATCH /users/me
 * Update current user nickname
 */
async function updateMe(request, reply) {
  const { nickname } = request.body;
  const userSub = request.user.sub;

  if (!validators.isValidNickname(nickname)) {
    throw createError(ErrorCodes.INVALID_PARAMS, 'invalid nickname');
  }

  const db = getDb();
  const trimmedNickname = nickname.trim();

  db.prepare(`
    UPDATE users SET nickname = ?, updated_at = datetime('now') WHERE sub = ?
  `).run(trimmedNickname, userSub);

  // Get membership for token
  const membership = membershipService.getActiveMembership(userSub);

  // Get updated user
  const user = db.prepare('SELECT * FROM users WHERE sub = ?').get(userSub);

  return reply.status(200).send({
    sub: user.sub,
    phone: user.phone,
    nickname: user.nickname,
    status: user.status,
    membership: membership?.plan || 'free',
  });
}

/**
 * Register user routes with Fastify instance
 * @param {FastifyInstance} fastify
 */
function registerRoutes(fastify) {
  fastify.get('/users/me', getMe);

  fastify.patch('/users/me', {
    schema: {
      body: {
        type: 'object',
        required: ['nickname'],
        properties: {
          nickname: { type: 'string', minLength: 1, maxLength: 50 },
        },
      },
    },
  }, updateMe);
}

module.exports = {
  registerRoutes,
  getMe,
  updateMe,
};