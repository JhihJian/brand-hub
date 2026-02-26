/**
 * SMS Service
 * Integrates with spug SMS provider
 */

const { config } = require('../config');
const { generateSmsCode } = require('../utils/validators');
const cache = require('./cache');

/**
 * Send SMS verification code
 * @param {string} phone - Phone number with country code
 * @returns {Promise<{success: boolean, cooldown?: number, error?: string}>}
 */
async function sendSmsCode(phone) {
  // Generate code
  const code = generateSmsCode();

  // In mock mode, use fixed code
  const actualCode = config.sms.mockMode ? config.sms.mockCode : code;

  // Save to cache
  cache.saveSmsCode(phone, actualCode);

  // Set cooldown
  cache.setCooldown(phone);

  // Send via SMS provider (skip in mock mode)
  if (!config.sms.mockMode) {
    try {
      const response = await fetch(config.sms.providerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.sms.providerKey}`,
        },
        body: JSON.stringify({
          phone,
          code: actualCode,
        }),
      });

      if (!response.ok) {
        // Log error but don't fail - code is already saved
        console.error('SMS provider error:', response.status);
      }
    } catch (error) {
      console.error('SMS provider error:', error.message);
    }
  }

  return {
    success: true,
    cooldown: config.rateLimits.smsCooldown,
  };
}

/**
 * Verify SMS code
 * @param {string} phone - Phone number
 * @param {string} code - Verification code
 * @returns {{valid: boolean, reason?: string, attempts?: number}}
 */
function verifyCode(phone, code) {
  return cache.verifySmsCode(phone, code);
}

module.exports = {
  sendSmsCode,
  verifyCode,
};