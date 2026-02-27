/**
 * Authentication Routes
 */

const { v4: uuidv4 } = require('uuid');
const router = require('fastify').fastify();
const { getDb } = require('../db');
const smsService = require('../services/sms');
const tokenService = require('../services/token');
const cache = require('../services/cache');
const invitationService = require('../services/invitation');
const membershipService = require('../services/membership');
const { createError, ErrorCodes } = require('../utils/errors');
const validators = require('../utils/validators');

/**
 * POST /auth/sms/send
 * Send SMS verification code
 */
async function sendSms(request, reply) {
  const { phone, scene, invite_token } = request.body;

  // Validate scene
  if (!validators.isValidScene(scene)) {
    throw createError(ErrorCodes.INVALID_SCENE);
  }

  // For register scene, require and validate invite_token
  if (scene === 'register') {
    if (!invite_token) {
      throw createError(ErrorCodes.INVITE_TOKEN_INVALID);
    }
    const tokenData = cache.getInviteToken(invite_token);
    if (!tokenData) {
      throw createError(ErrorCodes.INVITE_TOKEN_INVALID);
    }
  }

  const db = getDb();

  // For login scene, check if phone is registered
  if (scene === 'login') {
    const user = db.prepare('SELECT 1 FROM users WHERE phone = ?').get(phone);
    if (!user) {
      throw createError(ErrorCodes.PHONE_NOT_REGISTERED);
    }
  }

  // Check cooldown
  if (cache.isInCooldown(phone)) {
    throw createError(ErrorCodes.SMS_COOLDOWN);
  }

  // Check daily limit
  const dailyCount = cache.getDailyCount(phone);
  if (dailyCount >= 10) {
    throw createError(ErrorCodes.SMS_DAILY_LIMIT);
  }

  // Check IP limit
  const clientIp = request.ip;
  const ipCount = cache.getIpCount(clientIp);
  if (ipCount >= 20) {
    throw createError(ErrorCodes.SMS_IP_LIMIT);
  }

  // Increment limits
  cache.incrementDailyLimit(phone);
  cache.incrementIpLimit(clientIp);

  // Send SMS
  const result = await smsService.sendSmsCode(phone);

  return reply.status(200).send({
    success: true,
    cooldown: result.cooldown,
  });
}

/**
 * POST /auth/register
 * Register new user
 */
async function register(request, reply) {
  const { phone, code, invite_token, nickname } = request.body;

  // Validate invite_token
  if (!invite_token) {
    throw createError(ErrorCodes.INVITE_TOKEN_INVALID);
  }
  const tokenData = cache.getInviteToken(invite_token);
  if (!tokenData) {
    throw createError(ErrorCodes.INVITE_TOKEN_INVALID);
  }

  // Get invite code from token
  const invite_code = tokenData.code;

  // Validate inputs
  if (!validators.isValidPhone(phone)) {
    throw createError(ErrorCodes.INVALID_PARAMS, 'invalid phone number');
  }

  if (!validators.isValidSmsCode(code)) {
    throw createError(ErrorCodes.INVALID_PARAMS, 'invalid verification code');
  }

  if (!validators.isValidNickname(nickname)) {
    throw createError(ErrorCodes.INVALID_PARAMS, 'invalid nickname');
  }

  // Verify SMS code
  const codeResult = smsService.verifyCode(phone, code);
  if (!codeResult.valid) {
    if (codeResult.reason === 'max_attempts') {
      throw createError(ErrorCodes.SMS_CODE_MAX_ATTEMPTS);
    }
    throw createError(ErrorCodes.SMS_CODE_INCORRECT);
  }

  // Validate invitation code
  const invitation = invitationService.validateInvitationCode(invite_code);

  const db = getDb();

  // Check if phone already registered
  const existingUser = db.prepare('SELECT 1 FROM users WHERE phone = ?').get(phone);
  if (existingUser) {
    throw createError(ErrorCodes.PHONE_EXISTS);
  }

  // Create user in transaction
  const userSub = uuidv4();
  const trimmedNickname = nickname.trim();

  const transaction = db.transaction(() => {
    // Create user
    db.prepare(`
      INSERT INTO users (sub, phone, nickname, status, roles)
      VALUES (?, ?, ?, 'active', 'user')
    `).run(userSub, phone, trimmedNickname);

    // Create membership based on invitation
    const presetMembership = invitation.preset_membership;
    let expiresAt = null;

    if (presetMembership !== 'lifetime' && invitation.preset_duration_days) {
      expiresAt = new Date(Date.now() + invitation.preset_duration_days * 24 * 60 * 60 * 1000);
    }

    // Only create membership record if not free
    if (presetMembership !== 'free') {
      const membershipId = uuidv4();
      db.prepare(`
        INSERT INTO memberships (id, user_sub, plan, status, starts_at, expires_at, source)
        VALUES (?, ?, ?, 'active', datetime('now'), ?, 'invitation')
      `).run(membershipId, userSub, presetMembership, expiresAt?.toISOString());
    }

    // Mark invitation as used
    invitationService.markInvitationUsed(invite_code, userSub);
  });

  transaction();

  // Consume invite token
  cache.consumeInviteToken(invite_token);

  // Get membership
  const membership = membershipService.getActiveMembership(userSub);

  // Generate tokens
  const accessToken = tokenService.generateAccessToken(
    { sub: userSub, nickname: trimmedNickname, roles: 'user' },
    membership
  );
  const refreshToken = await tokenService.generateRefreshToken(
    userSub,
    request.headers['user-agent']
  );

  return reply.status(201).send({
    access_token: accessToken,
    refresh_token: refreshToken.token,
    token_type: 'Bearer',
    expires_in: 900, // 15 minutes
    user: {
      sub: userSub,
      phone,
      nickname: trimmedNickname,
      membership: membership?.plan || 'free',
    },
  });
}

/**
 * POST /auth/login
 * Login with phone and SMS code
 */
async function login(request, reply) {
  const { phone, code } = request.body;

  // Validate inputs
  if (!validators.isValidPhone(phone)) {
    throw createError(ErrorCodes.INVALID_PARAMS, 'invalid phone number');
  }

  if (!validators.isValidSmsCode(code)) {
    throw createError(ErrorCodes.INVALID_PARAMS, 'invalid verification code');
  }

  // Verify SMS code
  const codeResult = smsService.verifyCode(phone, code);
  if (!codeResult.valid) {
    if (codeResult.reason === 'max_attempts') {
      throw createError(ErrorCodes.SMS_CODE_MAX_ATTEMPTS);
    }
    throw createError(ErrorCodes.SMS_CODE_INCORRECT);
  }

  const db = getDb();

  // Find user
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user) {
    throw createError(ErrorCodes.PHONE_NOT_REGISTERED);
  }

  // Check status
  if (user.status === 'suspended') {
    throw createError(ErrorCodes.ACCOUNT_SUSPENDED);
  }

  // Get membership
  const membership = membershipService.getActiveMembership(user.sub);

  // Generate tokens
  const accessToken = tokenService.generateAccessToken(user, membership);
  const refreshToken = await tokenService.generateRefreshToken(
    user.sub,
    request.headers['user-agent']
  );

  return reply.status(200).send({
    access_token: accessToken,
    refresh_token: refreshToken.token,
    token_type: 'Bearer',
    expires_in: 900,
    user: {
      sub: user.sub,
      phone: user.phone,
      nickname: user.nickname,
      membership: membership?.plan || 'free',
    },
  });
}

/**
 * POST /auth/refresh
 * Refresh access token
 */
async function refresh(request, reply) {
  const { refresh_token } = request.body;

  if (!refresh_token) {
    throw createError(ErrorCodes.INVALID_PARAMS, 'refresh_token is required');
  }

  // Verify and rotate refresh token
  const result = await tokenService.verifyAndRotateRefreshToken(refresh_token);

  // Get membership
  const membership = membershipService.getActiveMembership(result.user.sub);

  // Generate new access token
  const accessToken = tokenService.generateAccessToken(result.user, membership);

  return reply.status(200).send({
    access_token: accessToken,
    refresh_token: result.newToken.token,
    token_type: 'Bearer',
    expires_in: 900,
  });
}

/**
 * POST /auth/logout
 * Logout (revoke refresh token)
 */
async function logout(request, reply) {
  const { refresh_token } = request.body;

  if (refresh_token) {
    tokenService.revokeRefreshToken(refresh_token);
  }

  return reply.status(200).send({ success: true });
}

/**
 * POST /auth/invite/verify
 * Verify invite code and return invite token
 */
async function verifyInvite(request, reply) {
  const { invite_code } = request.body;
  const clientIp = request.ip;

  // Rate limit: max 10 attempts per IP per minute
  const verifyCount = cache.incrementInviteVerifyLimit(clientIp);
  if (verifyCount > 10) {
    throw createError(ErrorCodes.RATE_LIMITED, 'too many attempts, please try again later');
  }

  // Validate invite code format
  if (!validators.isValidInviteCode(invite_code)) {
    throw createError(ErrorCodes.INVITE_CODE_INVALID, 'invalid invite code format');
  }

  // Validate invite code
  const invitation = invitationService.validateInvitationCode(invite_code);

  // Generate invite token (valid for 30 minutes)
  const inviteToken = cache.generateInviteToken(invite_code);

  return reply.status(200).send({
    success: true,
    invite_token: inviteToken,
    preset_membership: invitation.preset_membership,
  });
}

/**
 * Register auth routes with Fastify instance
 * @param {FastifyInstance} fastify
 */
function registerRoutes(fastify) {
  // Invite verification (must be first, no auth required)
  fastify.post('/auth/invite/verify', {
    schema: {
      body: {
        type: 'object',
        required: ['invite_code'],
        properties: {
          invite_code: { type: 'string' },
        },
      },
    },
  }, verifyInvite);

  fastify.post('/auth/sms/send', {
    schema: {
      body: {
        type: 'object',
        required: ['phone', 'scene'],
        properties: {
          phone: { type: 'string' },
          scene: { type: 'string', enum: ['login', 'register'] },
          invite_token: { type: 'string' },
        },
      },
    },
  }, sendSms);

  fastify.post('/auth/register', {
    schema: {
      body: {
        type: 'object',
        required: ['phone', 'code', 'invite_token', 'nickname'],
        properties: {
          phone: { type: 'string' },
          code: { type: 'string' },
          invite_token: { type: 'string' },
          nickname: { type: 'string', minLength: 1, maxLength: 50 },
        },
      },
    },
  }, register);

  fastify.post('/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['phone', 'code'],
        properties: {
          phone: { type: 'string' },
          code: { type: 'string' },
        },
      },
    },
  }, login);

  fastify.post('/auth/refresh', {
    schema: {
      body: {
        type: 'object',
        required: ['refresh_token'],
        properties: {
          refresh_token: { type: 'string' },
        },
      },
    },
  }, refresh);

  fastify.post('/auth/logout', logout);
}

module.exports = {
  registerRoutes,
  sendSms,
  register,
  login,
  refresh,
  logout,
  verifyInvite,
};