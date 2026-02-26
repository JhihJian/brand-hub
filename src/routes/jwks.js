/**
 * JWKS Endpoint Route
 * Exposes public key in JWKS format
 */

const { createPublicKey } = require('crypto');
const { config } = require('../config');
const tokenService = require('../services/token');

/**
 * GET /.well-known/jwks.json
 * Return JWKS public key
 */
async function getJwks(request, reply) {
  const publicKeyPem = tokenService.getPublicKeyPem();

  // Convert PEM to JWKS format
  const publicKeyObj = createPublicKey(publicKeyPem);
  const jwkKey = publicKeyObj.export({ format: 'jwk' });

  // Calculate thumbprint for kid
  const crypto = require('crypto');
  const thumbprint = crypto
    .createHash('sha256')
    .update(JSON.stringify({ kty: jwkKey.kty, n: jwkKey.n, e: jwkKey.e }))
    .digest('base64url');

  const jwks = {
    keys: [
      {
        kty: 'RSA',
        use: 'sig',
        alg: 'RS256',
        kid: thumbprint,
        n: jwkKey.n,
        e: jwkKey.e,
      },
    ],
  };

  // Cache for 24 hours
  reply.header('Cache-Control', 'public, max-age=86400');

  return reply.status(200).send(jwks);
}

/**
 * Register JWKS routes with Fastify instance
 * @param {FastifyInstance} fastify
 */
function registerRoutes(fastify) {
  fastify.get('/.well-known/jwks.json', getJwks);
}

module.exports = {
  registerRoutes,
  getJwks,
};