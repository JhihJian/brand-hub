/**
 * Fastify Application Setup
 */

const fastify = require('fastify')({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
      level: (label) => ({ level: label }),
    },
    serializers: {
      req(req) {
        return {
          method: req.method,
          url: req.url,
          headers: {
            'user-agent': req.headers['user-agent'],
          },
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  },
});

const cors = require('@fastify/cors');
const { config, validateConfig } = require('./config');
const db = require('./db');
const cache = require('./services/cache');
const tokenService = require('./services/token');
const { errorHandler } = require('./utils/errors');
const { authMiddleware, adminMiddleware } = require('./middleware/auth');

// Routes
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const membershipRoutes = require('./routes/membership');
const adminRoutes = require('./routes/admin');
const jwksRoutes = require('./routes/jwks');

/**
 * Initialize application
 */
async function init() {
  // Validate configuration
  validateConfig();

  // Initialize database
  db.initDatabase();

  // Initialize cache
  cache.initCache();

  // Load JWT keys
  tokenService.loadKeys();

  // Register plugins
  await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Set error handler
  fastify.setErrorHandler(errorHandler);

  // Register public routes
  healthRoutes.registerRoutes(fastify);
  jwksRoutes.registerRoutes(fastify);
  authRoutes.registerRoutes(fastify);

  // Register protected routes (require auth)
  fastify.register(async function (fastify) {
    // Add auth middleware
    fastify.addHook('onRequest', authMiddleware);

    // User routes
    usersRoutes.registerRoutes(fastify);

    // Membership routes
    membershipRoutes.registerRoutes(fastify);
  });

  // Register admin routes (require admin role)
  fastify.register(async function (fastify) {
    // Add auth and admin middleware
    fastify.addHook('onRequest', async (request, reply) => {
      await authMiddleware(request, reply);
      await adminMiddleware(request, reply);
    });

    adminRoutes.registerRoutes(fastify);
  });

  return fastify;
}

/**
 * Start server
 */
async function start() {
  try {
    await init();

    await fastify.listen({ port: config.port, host: '0.0.0.0' });

    fastify.log.info(`Brand Hub server running on port ${config.port}`);
    fastify.log.info(`Environment: ${config.nodeEnv}`);
    fastify.log.info(`JWKS endpoint: ${config.jwt.issuer}/.well-known/jwks.json`);

    return fastify;
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

/**
 * Close server
 */
async function close() {
  await fastify.close();
  db.closeDatabase();
}

module.exports = {
  fastify,
  init,
  start,
  close,
};