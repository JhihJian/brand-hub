/**
 * PM2 Ecosystem Configuration Example
 * Copy to ecosystem.config.cjs and fill in production values
 */
module.exports = {
  apps: [
    {
      name: 'brand-hub',
      script: './src/index.js',
      cwd: '/data/dev/brand-hub',
      env_production: {
        NODE_ENV: 'production',
        PORT: '4001',
        DB_PATH: '/data/app/brand-hub/data/brand.db',
        JWT_PRIVATE_KEY_PATH: '/data/app/brand-hub/keys/private.pem',
        JWT_PUBLIC_KEY_PATH: '/data/app/brand-hub/keys/public.pem',
        JWT_ISSUER: 'https://your-domain.com/hub',
        JWT_ACCESS_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '30d',
        JWT_AUDIENCES: 'brand-hub,your-product',
        SPUG_TOKEN: 'your-spug-token',
        SPUG_TEMPLATE_NAME: 'your-template-name',
        SMS_MOCK_MODE: 'false',
      },
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};
