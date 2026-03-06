/**
 * Vitest Configuration
 */

module.exports = {
  testEnvironment: 'node',
  globalSetup: ['./tests/global-setup.js'],
  testMatch: ['**/*.test.js'],
  testTimeout: 30000,
  hookTimeout: 30000,
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html'],
    include: ['src/**/*.js'],
    exclude: ['src/index.js'],
  },
  // Force CommonJS mode for vitest
  deps: {
    interopDefault: true,
  },
};