/**
 * Authentication Middleware
 * Verifies JWT tokens and injects user info into request
 */

const tokenService = require('../services/token');
const { createError, ErrorCodes } = require('../utils/errors');

/**
 * Auth middleware for protected routes
 */
async function authMiddleware(request, reply) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError(ErrorCodes.TOKEN_INVALID);
  }

  const token = authHeader.slice(7);

  try {
    const decoded = tokenService.verifyAccessToken(token);
    request.user = decoded;
  } catch (error) {
    throw error;
  }
}

/**
 * Optional auth middleware - populates user if token present but doesn't require it
 */
async function optionalAuthMiddleware(request, reply) {
  const authHeader = request.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = tokenService.verifyAccessToken(token);
      request.user = decoded;
    } catch (error) {
      // Ignore errors for optional auth
    }
  }
}

/**
 * Admin role middleware - must be used after authMiddleware
 */
async function adminMiddleware(request, reply) {
  const roles = request.user?.['brand.roles'] || [];

  if (!roles.includes('admin')) {
    throw createError(ErrorCodes.INSUFFICIENT_ROLE);
  }
}

/**
 * Membership middleware factory
 * @param {string} requiredLevel - Required membership level
 */
function membershipMiddleware(requiredLevel) {
  const levels = {
    free: 0,
    monthly: 1,
    yearly: 2,
    lifetime: 3,
  };

  return async function (request, reply) {
    const membership = request.user?.['brand.membership'] || 'free';
    const userLevel = levels[membership] || 0;
    const required = levels[requiredLevel] || 0;

    if (userLevel < required) {
      throw createError(ErrorCodes.MEMBERSHIP_REQUIRED);
    }
  };
}

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
  adminMiddleware,
  membershipMiddleware,
};