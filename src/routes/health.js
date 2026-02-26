/**
 * Health check and utility routes
 */

/**
 * GET /health
 * Health check endpoint
 */
async function healthCheck(request, reply) {
  return reply.status(200).send({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Register utility routes
 * @param {FastifyInstance} fastify
 */
function registerRoutes(fastify) {
  fastify.get('/health', healthCheck);
}

module.exports = {
  registerRoutes,
  healthCheck,
};