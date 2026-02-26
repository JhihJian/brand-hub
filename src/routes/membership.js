/**
 * Membership Routes
 */

const membershipService = require('../services/membership');
const tokenService = require('../services/token');
const { createError, ErrorCodes } = require('../utils/errors');
const validators = require('../utils/validators');

/**
 * GET /membership
 * Get current membership status
 */
async function getMembership(request, reply) {
  const userSub = request.user.sub;
  const membership = membershipService.getActiveMembership(userSub);
  const history = membershipService.getMembershipHistory(userSub);

  return reply.status(200).send({
    current: membership ? {
      id: membership.id,
      plan: membership.plan,
      status: membership.status,
      starts_at: membership.starts_at,
      expires_at: membership.expires_at,
      source: membership.source,
    } : null,
    history: history.map(m => ({
      id: m.id,
      plan: m.plan,
      status: m.status,
      starts_at: m.starts_at,
      expires_at: m.expires_at,
      source: m.source,
      cancelled_at: m.cancelled_at,
    })),
  });
}

/**
 * POST /membership/subscribe
 * Subscribe to a membership plan
 */
async function subscribe(request, reply) {
  const { plan } = request.body;
  const userSub = request.user.sub;

  if (!validators.isValidPlan(plan)) {
    throw createError(ErrorCodes.INVALID_PARAMS, 'invalid plan');
  }

  if (plan === 'free') {
    throw createError(ErrorCodes.INVALID_PARAMS, 'cannot subscribe to free plan');
  }

  if (plan === 'lifetime') {
    throw createError(ErrorCodes.INVALID_PARAMS, 'lifetime membership must be granted by admin');
  }

  const membership = membershipService.subscribe(userSub, plan);

  return reply.status(201).send({
    id: membership.id,
    plan: membership.plan,
    status: membership.status,
    starts_at: membership.starts_at,
    expires_at: membership.expires_at,
    source: membership.source,
  });
}

/**
 * POST /membership/cancel
 * Cancel current membership
 */
async function cancelMembership(request, reply) {
  const userSub = request.user.sub;

  const membership = membershipService.cancelMembership(userSub);

  return reply.status(200).send({
    id: membership.id,
    plan: membership.plan,
    status: membership.status,
    cancelled_at: new Date().toISOString(),
  });
}

/**
 * Register membership routes with Fastify instance
 * @param {FastifyInstance} fastify
 */
function registerRoutes(fastify) {
  fastify.get('/membership', getMembership);

  fastify.post('/membership/subscribe', {
    schema: {
      body: {
        type: 'object',
        required: ['plan'],
        properties: {
          plan: { type: 'string', enum: ['monthly', 'yearly'] },
        },
      },
    },
  }, subscribe);

  fastify.post('/membership/cancel', cancelMembership);
}

module.exports = {
  registerRoutes,
  getMembership,
  subscribe,
  cancelMembership,
};