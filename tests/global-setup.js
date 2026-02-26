/**
 * Global Setup for Vitest
 * Sets up environment and provides teardown
 */

module.exports = async function() {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.DB_PATH = ':memory:';
  process.env.SMS_MOCK_MODE = 'true';
  process.env.JWT_ISSUER = 'https://test.com/hub';

  const path = require('path');
  const fs = require('fs');
  const { execSync } = require('child_process');

  // Create test keys directory
  const keysDir = path.join(__dirname, 'keys');
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }

  // Generate test keys if they don't exist
  const privateKeyPath = path.join(keysDir, 'private.pem');
  const publicKeyPath = path.join(keysDir, 'public.pem');

  if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
    try {
      execSync(`openssl genrsa -out "${privateKeyPath}" 2048 2>/dev/null`);
      execSync(`openssl rsa -in "${privateKeyPath}" -pubout -out "${publicKeyPath}" 2>/dev/null`);
      console.log('Test keys generated');
    } catch (e) {
      console.warn('Could not generate test keys');
    }
  }

  // Set key paths
  process.env.JWT_PRIVATE_KEY_PATH = privateKeyPath;
  process.env.JWT_PUBLIC_KEY_PATH = publicKeyPath;

  return {
    teardown() {
      // Cleanup if needed
    }
  };
};