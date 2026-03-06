/**
 * SMS Service
 * Integrates with spug SMS provider
 */

const { config } = require('../config');
const { generateSmsCode } = require('../utils/validators');
const cache = require('./cache');

const SPUG_API_URL = 'https://push.spug.cc/send';

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
    if (!config.sms.spugToken) {
      console.error('SMS: SPUG_TOKEN not configured');
      return {
        success: false,
        error: '短信服务未配置',
      };
    }

    try {
      const url = `${SPUG_API_URL}/${config.sms.spugToken}`;

      // Spug API 使用 application/x-www-form-urlencoded 格式
      const formData = new URLSearchParams();
      formData.append('name', config.sms.spugTemplateName);
      formData.append('code', actualCode);
      formData.append('targets', phone);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const result = await response.json();

      if (result.code !== 200) {
        console.error('SMS provider error:', result);
        return {
          success: false,
          error: result.message || result.msg || '发送失败',
        };
      }
    } catch (error) {
      console.error('SMS provider error:', error.message);
      return {
        success: false,
        error: '短信发送失败，请稍后重试',
      };
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