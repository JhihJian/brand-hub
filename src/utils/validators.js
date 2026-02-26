/**
 * Validation utilities
 */

/**
 * Phone number validation (supports international format)
 */
function isValidPhone(phone) {
  // Basic validation: starts with + followed by digits, at least 10 digits total
  if (!phone || typeof phone !== 'string') return false;
  return /^\+\d{10,15}$/.test(phone);
}

/**
 * SMS verification code validation (6 digits)
 */
function isValidSmsCode(code) {
  if (!code || typeof code !== 'string') return false;
  return /^\d{6}$/.test(code);
}

/**
 * Invite code validation (format: XXXX-XXXX)
 */
function isValidInviteCode(code) {
  if (!code || typeof code !== 'string') return false;
  return /^[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(code);
}

/**
 * Nickname validation (1-50 characters, no special restrictions for now)
 */
function isValidNickname(nickname) {
  if (!nickname || typeof nickname !== 'string') return false;
  const trimmed = nickname.trim();
  return trimmed.length >= 1 && trimmed.length <= 50;
}

/**
 * Membership plan validation
 */
function isValidPlan(plan) {
  const validPlans = ['free', 'monthly', 'yearly', 'lifetime'];
  return validPlans.includes(plan);
}

/**
 * User status validation
 */
function isValidStatus(status) {
  const validStatuses = ['active', 'suspended'];
  return validStatuses.includes(status);
}

/**
 * Scene validation for SMS
 */
function isValidScene(scene) {
  const validScenes = ['login', 'register'];
  return validScenes.includes(scene);
}

/**
 * Generate invite code
 */
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing characters
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Generate 6-digit SMS code
 */
function generateSmsCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = {
  isValidPhone,
  isValidSmsCode,
  isValidInviteCode,
  isValidNickname,
  isValidPlan,
  isValidStatus,
  isValidScene,
  generateInviteCode,
  generateSmsCode,
};