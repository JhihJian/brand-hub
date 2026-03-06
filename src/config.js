/**
 * Configuration management for Brand Hub
 */

require('dotenv').config();

/**
 * Parse expiresIn string to seconds
 * @param {string} expiresIn - e.g. '12h', '30d', '3600s', '60m'
 * @returns {number} seconds
 */
function parseExpiresIn(expiresIn) {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) {
    return parseInt(expiresIn, 10) || 43200; // default 12h
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 24 * 60 * 60;
    default: return value;
  }
}

const config = {
  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',

  // Server
  port: parseInt(process.env.PORT, 10) || 3000,

  // Database
  dbPath: process.env.DB_PATH || './data/brand.db',

  // JWT
  jwt: {
    privateKeyPath: process.env.JWT_PRIVATE_KEY_PATH || './keys/private.pem',
    publicKeyPath: process.env.JWT_PUBLIC_KEY_PATH || './keys/public.pem',
    issuer: process.env.JWT_ISSUER || 'https://yourbrand.com/hub',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '12h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    audiences: process.env.JWT_AUDIENCES ? process.env.JWT_AUDIENCES.split(',').map(a => a.trim()) : ['brand-hub'],
    // Derived value for API responses
    accessExpiresInSeconds: parseExpiresIn(process.env.JWT_ACCESS_EXPIRES_IN || '12h'),
  },

  // SMS (spug)
  sms: {
    spugToken: process.env.SPUG_TOKEN || '',
    spugTemplateName: process.env.SPUG_TEMPLATE_NAME || '品牌中心短信验证码',
    mockMode: process.env.SMS_MOCK_MODE === 'true' || process.env.NODE_ENV === 'test',
    mockCode: process.env.SMS_MOCK_CODE || '123456',
  },

  // Rate limits
  rateLimits: {
    smsCooldown: 60, // seconds
    smsDailyLimit: 10,
    smsIpLimit: 20,
    smsCodeExpiry: 300, // 5 minutes
    smsMaxAttempts: 5,
  },
};

// Validation
function validateConfig() {
  const errors = [];

  if (config.nodeEnv === 'production') {
    if (!config.sms.spugToken) {
      errors.push('SPUG_TOKEN is required in production');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }

  return config;
}

module.exports = {
  config,
  validateConfig,
};
