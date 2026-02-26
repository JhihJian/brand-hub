/**
 * E2E Tests - Complete Test Suite using Node Test Runner
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Setup environment before imports
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.SMS_MOCK_MODE = 'true';
process.env.JWT_ISSUER = 'https://test.com/hub';

// Generate test keys
const keysDir = path.join(__dirname, 'keys');
if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
}

const privateKeyPath = path.join(keysDir, 'private.pem');
const publicKeyPath = path.join(keysDir, 'public.pem');

if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
  try {
    execSync(`openssl genrsa -out "${privateKeyPath}" 2048 2>/dev/null`);
    execSync(`openssl rsa -in "${privateKeyPath}" -pubout -out "${publicKeyPath}" 2>/dev/null`);
  } catch (e) {
    console.warn('Could not generate test keys');
  }
}

process.env.JWT_PRIVATE_KEY_PATH = privateKeyPath;
process.env.JWT_PUBLIC_KEY_PATH = publicKeyPath;

// Import modules
const app = require('../src/app');
const db = require('../src/db');
const cache = require('../src/services/cache');
const tokenService = require('../src/services/token');
const invitationService = require('../src/services/invitation');
const membershipService = require('../src/services/membership');

// Shared state
let fastify = null;
let testDb = null;

// Helper to create test user
const createTestUser = (options = {}) => {
  const { sub, phone, nickname, status, roles } = {
    sub: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    phone: `+86138${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
    nickname: 'Test User',
    status: 'active',
    roles: 'user',
    ...options
  };

  testDb.prepare(`
    INSERT INTO users (sub, phone, nickname, status, roles)
    VALUES (?, ?, ?, ?, ?)
  `).run(sub, phone, nickname, status, roles);

  return { sub, phone, nickname, status, roles };
};

// Helper to generate auth token
const generateToken = (user, membership = null) => {
  return tokenService.generateAccessToken(
    { sub: user.sub, nickname: user.nickname, roles: user.roles },
    membership
  );
};

// Initialize once before all tests
before(async () => {
  fastify = await app.init();
  testDb = db.getDb();
  cache.clearCache();
});

// ============================================
// Health & JWKS
// ============================================
describe('Health & JWKS Endpoints', () => {
  it('should return healthy status', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/health'
    });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.json().status, 'ok');
    assert.ok(response.json().timestamp);
  });

  it('should return JWKS public key', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/.well-known/jwks.json'
    });

    assert.strictEqual(response.statusCode, 200);
    assert.ok(response.json().keys);
    assert.strictEqual(response.json().keys.length, 1);
    assert.strictEqual(response.json().keys[0].kty, 'RSA');
    assert.strictEqual(response.json().keys[0].alg, 'RS256');
  });
});

// ============================================
// SMS Verification Code
// ============================================
describe('POST /auth/sms/send', () => {
  it('should send SMS code for register scene', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/auth/sms/send',
      payload: { phone: '+8613800138001', scene: 'register' }
    });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.json().success, true);
    assert.strictEqual(response.json().cooldown, 60);
  });

  it('should return 401 for login scene with unregistered phone', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/auth/sms/send',
      payload: { phone: '+8613800138002', scene: 'login' }
    });

    assert.strictEqual(response.statusCode, 401);
    assert.strictEqual(response.json().error.code, 'PHONE_NOT_REGISTERED');
  });

  it('should send SMS code for login scene with registered phone', async () => {
    createTestUser({ phone: '+8613800138003' });

    const response = await fastify.inject({
      method: 'POST',
      url: '/auth/sms/send',
      payload: { phone: '+8613800138003', scene: 'login' }
    });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.json().success, true);
  });

  it('should return 429 when in cooldown', async () => {
    const phone = '+8613800138004';

    await fastify.inject({
      method: 'POST',
      url: '/auth/sms/send',
      payload: { phone, scene: 'register' }
    });

    const response = await fastify.inject({
      method: 'POST',
      url: '/auth/sms/send',
      payload: { phone, scene: 'register' }
    });

    assert.strictEqual(response.statusCode, 429);
    assert.strictEqual(response.json().error.code, 'SMS_COOLDOWN');
  });

  it('should return 400 for invalid scene', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/auth/sms/send',
      payload: { phone: '+8613800138005', scene: 'invalid' }
    });

    assert.strictEqual(response.statusCode, 400);
    // Fastify schema validation returns INVALID_PARAMS for invalid enum values
    assert.strictEqual(response.json().error.code, 'INVALID_PARAMS');
  });
});

// ============================================
// Registration
// ============================================
describe('POST /auth/register', () => {
  it('should register user with free invitation code', async () => {
    const codes = invitationService.createInvitations({
      count: 1,
      presetMembership: 'free',
      createdBy: null
    });
    const inviteCode = codes[0].code;
    const phone = '+8613800138010';

    cache.saveSmsCode(phone, '123456');

    const response = await fastify.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        phone,
        code: '123456',
        invite_code: inviteCode,
        nickname: 'New User'
      }
    });

    assert.strictEqual(response.statusCode, 201);
    assert.ok(response.json().access_token);
    assert.ok(response.json().refresh_token);
    assert.strictEqual(response.json().user.nickname, 'New User');
    assert.strictEqual(response.json().user.membership, 'free');
  });

  it('should register user with monthly invitation code', async () => {
    const codes = invitationService.createInvitations({
      count: 1,
      presetMembership: 'monthly',
      presetDurationDays: 30,
      createdBy: null
    });
    const inviteCode = codes[0].code;
    const phone = '+8613800138011';

    cache.saveSmsCode(phone, '123456');

    const response = await fastify.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        phone,
        code: '123456',
        invite_code: inviteCode,
        nickname: 'Monthly User'
      }
    });

    assert.strictEqual(response.statusCode, 201);
    assert.strictEqual(response.json().user.membership, 'monthly');
  });

  it('should return 422 for used invitation code', async () => {
    // Create a user to be the "used_by" reference
    const existingUser = createTestUser();

    const codes = invitationService.createInvitations({
      count: 1,
      presetMembership: 'free',
      createdBy: null
    });
    const inviteCode = codes[0].code;

    // Mark as used by an existing user
    testDb.prepare("UPDATE invitations SET used_by = ?, used_at = datetime('now') WHERE code = ?")
      .run(existingUser.sub, inviteCode);

    const phone = '+8613800138013';
    cache.saveSmsCode(phone, '123456');

    const response = await fastify.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        phone,
        code: '123456',
        invite_code: inviteCode,
        nickname: 'Test User'
      }
    });

    assert.strictEqual(response.statusCode, 422);
    assert.strictEqual(response.json().error.code, 'INVITE_CODE_USED');
  });

  it('should return 422 for invalid invitation code', async () => {
    const phone = '+8613800138014';
    cache.saveSmsCode(phone, '123456');

    const response = await fastify.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        phone,
        code: '123456',
        invite_code: 'FAKE-CODE',
        nickname: 'Test User'
      }
    });

    assert.strictEqual(response.statusCode, 422);
    assert.strictEqual(response.json().error.code, 'INVITE_CODE_INVALID');
  });

  it('should return 409 for existing phone', async () => {
    createTestUser({ phone: '+8613800138016' });

    const codes = invitationService.createInvitations({
      count: 1,
      presetMembership: 'free',
      createdBy: null
    });

    cache.saveSmsCode('+8613800138016', '123456');

    const response = await fastify.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        phone: '+8613800138016',
        code: '123456',
        invite_code: codes[0].code,
        nickname: 'Test User'
      }
    });

    assert.strictEqual(response.statusCode, 409);
    assert.strictEqual(response.json().error.code, 'PHONE_EXISTS');
  });

  it('should return 400 for incorrect SMS code', async () => {
    const codes = invitationService.createInvitations({
      count: 1,
      presetMembership: 'free',
      createdBy: null
    });

    const phone = '+8613800138017';
    cache.saveSmsCode(phone, '654321');

    const response = await fastify.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        phone,
        code: '123456',
        invite_code: codes[0].code,
        nickname: 'Test User'
      }
    });

    assert.strictEqual(response.statusCode, 400);
    assert.strictEqual(response.json().error.code, 'SMS_CODE_INCORRECT');
  });
});

// ============================================
// Login
// ============================================
describe('POST /auth/login', () => {
  it('should login successfully', async () => {
    const user = createTestUser({ phone: '+8613800138020' });
    cache.saveSmsCode(user.phone, '123456');

    const response = await fastify.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { phone: user.phone, code: '123456' }
    });

    assert.strictEqual(response.statusCode, 200);
    assert.ok(response.json().access_token);
    assert.ok(response.json().refresh_token);
    assert.strictEqual(response.json().user.nickname, user.nickname);
  });

  it('should return 401 for unregistered phone', async () => {
    cache.saveSmsCode('+8613800138021', '123456');

    const response = await fastify.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { phone: '+8613800138021', code: '123456' }
    });

    assert.strictEqual(response.statusCode, 401);
    assert.strictEqual(response.json().error.code, 'PHONE_NOT_REGISTERED');
  });

  it('should return 423 for suspended account', async () => {
    const user = createTestUser({
      phone: '+8613800138023',
      status: 'suspended'
    });
    cache.saveSmsCode(user.phone, '123456');

    const response = await fastify.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { phone: user.phone, code: '123456' }
    });

    assert.strictEqual(response.statusCode, 423);
    assert.strictEqual(response.json().error.code, 'ACCOUNT_SUSPENDED');
  });
});

// ============================================
// Token Refresh
// ============================================
describe('POST /auth/refresh', () => {
  it('should refresh token successfully', async () => {
    const user = createTestUser();
    const refreshToken = await tokenService.generateRefreshToken(user.sub);

    const response = await fastify.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refresh_token: refreshToken.token }
    });

    assert.strictEqual(response.statusCode, 200);
    assert.ok(response.json().access_token);
    assert.ok(response.json().refresh_token);
  });

  it('should return 401 for invalid refresh token', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refresh_token: 'invalid-token' }
    });

    assert.strictEqual(response.statusCode, 401);
    assert.strictEqual(response.json().error.code, 'TOKEN_REVOKED');
  });
});

// ============================================
// Logout
// ============================================
describe('POST /auth/logout', () => {
  it('should logout successfully', async () => {
    const user = createTestUser();
    const refreshToken = await tokenService.generateRefreshToken(user.sub);

    const response = await fastify.inject({
      method: 'POST',
      url: '/auth/logout',
      payload: { refresh_token: refreshToken.token }
    });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.json().success, true);
  });
});

// ============================================
// User Profile
// ============================================
describe('GET /users/me', () => {
  it('should return current user info', async () => {
    const user = createTestUser();
    const token = generateToken(user);

    const response = await fastify.inject({
      method: 'GET',
      url: '/users/me',
      headers: { authorization: `Bearer ${token}` }
    });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.json().sub, user.sub);
    assert.strictEqual(response.json().phone, user.phone);
    assert.strictEqual(response.json().nickname, user.nickname);
  });

  it('should return 401 without token', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/users/me'
    });

    assert.strictEqual(response.statusCode, 401);
  });
});

describe('PATCH /users/me', () => {
  it('should update nickname', async () => {
    const user = createTestUser();
    const token = generateToken(user);

    const response = await fastify.inject({
      method: 'PATCH',
      url: '/users/me',
      headers: { authorization: `Bearer ${token}` },
      payload: { nickname: 'Updated Name' }
    });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.json().nickname, 'Updated Name');
  });
});

// ============================================
// Membership
// ============================================
describe('GET /membership', () => {
  it('should return null for free user', async () => {
    const user = createTestUser();
    const token = generateToken(user);

    const response = await fastify.inject({
      method: 'GET',
      url: '/membership',
      headers: { authorization: `Bearer ${token}` }
    });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.json().current, null);
  });

  it('should return membership info', async () => {
    const user = createTestUser();
    membershipService.createMembership({
      userSub: user.sub,
      plan: 'monthly',
      durationDays: 30,
      source: 'self'
    });

    const token = generateToken(user);

    const response = await fastify.inject({
      method: 'GET',
      url: '/membership',
      headers: { authorization: `Bearer ${token}` }
    });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.json().current.plan, 'monthly');
  });
});

describe('POST /membership/subscribe', () => {
  it('should subscribe to monthly plan', async () => {
    const user = createTestUser();
    const token = generateToken(user);

    const response = await fastify.inject({
      method: 'POST',
      url: '/membership/subscribe',
      headers: { authorization: `Bearer ${token}` },
      payload: { plan: 'monthly' }
    });

    assert.strictEqual(response.statusCode, 201);
    assert.strictEqual(response.json().plan, 'monthly');
    assert.strictEqual(response.json().source, 'self');
  });

  it('should reject lifetime subscription', async () => {
    const user = createTestUser();
    const token = generateToken(user);

    const response = await fastify.inject({
      method: 'POST',
      url: '/membership/subscribe',
      headers: { authorization: `Bearer ${token}` },
      payload: { plan: 'lifetime' }
    });

    assert.strictEqual(response.statusCode, 400);
  });
});

describe('POST /membership/cancel', () => {
  it('should cancel membership', async () => {
    const user = createTestUser();
    const token = generateToken(user);

    await fastify.inject({
      method: 'POST',
      url: '/membership/subscribe',
      headers: { authorization: `Bearer ${token}` },
      payload: { plan: 'monthly' }
    });

    const response = await fastify.inject({
      method: 'POST',
      url: '/membership/cancel',
      headers: { authorization: `Bearer ${token}` }
    });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.json().status, 'cancelled');
  });

  it('should reject lifetime cancellation', async () => {
    const user = createTestUser();
    const token = generateToken(user);

    membershipService.grantMembership(user.sub, 'lifetime');

    const response = await fastify.inject({
      method: 'POST',
      url: '/membership/cancel',
      headers: { authorization: `Bearer ${token}` }
    });

    assert.strictEqual(response.statusCode, 400);
    assert.strictEqual(response.json().error.code, 'LIFETIME_CANNOT_CANCEL');
  });
});

// ============================================
// Admin - Invitations
// ============================================
describe('POST /admin/invitations/batch', () => {
  it('should create invitations as admin', async () => {
    const admin = createTestUser({ roles: 'admin,user' });
    const adminToken = generateToken(admin);

    const response = await fastify.inject({
      method: 'POST',
      url: '/admin/invitations/batch',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        count: 5,
        channel: 'test-channel',
        preset_membership: 'monthly',
        preset_duration_days: 30
      }
    });

    assert.strictEqual(response.statusCode, 201);
    assert.strictEqual(response.json().codes.length, 5);
    assert.strictEqual(response.json().count, 5);
  });

  it('should reject non-admin user', async () => {
    const user = createTestUser();
    const userToken = generateToken(user);

    const response = await fastify.inject({
      method: 'POST',
      url: '/admin/invitations/batch',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { count: 1 }
    });

    assert.strictEqual(response.statusCode, 403);
    assert.strictEqual(response.json().error.code, 'INSUFFICIENT_ROLE');
  });
});

describe('GET /admin/invitations', () => {
  it('should list invitations', async () => {
    const admin = createTestUser({ roles: 'admin,user' });
    const adminToken = generateToken(admin);

    invitationService.createInvitations({
      count: 3,
      channel: 'test',
      createdBy: admin.sub
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/admin/invitations',
      headers: { authorization: `Bearer ${adminToken}` }
    });

    assert.strictEqual(response.statusCode, 200);
    assert.ok(response.json().items.length >= 3);
    assert.ok(response.json().total >= 3);
  });
});

// ============================================
// Admin - Users
// ============================================
describe('GET /admin/users', () => {
  it('should list users', async () => {
    const admin = createTestUser({ roles: 'admin,user' });
    const adminToken = generateToken(admin);

    createTestUser({ nickname: 'User1' });
    createTestUser({ nickname: 'User2' });

    const response = await fastify.inject({
      method: 'GET',
      url: '/admin/users',
      headers: { authorization: `Bearer ${adminToken}` }
    });

    assert.strictEqual(response.statusCode, 200);
    assert.ok(response.json().items.length >= 3);
  });

  it('should reject non-admin', async () => {
    const user = createTestUser();
    const userToken = generateToken(user);

    const response = await fastify.inject({
      method: 'GET',
      url: '/admin/users',
      headers: { authorization: `Bearer ${userToken}` }
    });

    assert.strictEqual(response.statusCode, 403);
  });
});

describe('PATCH /admin/users/:sub/status', () => {
  it('should suspend user', async () => {
    const admin = createTestUser({ roles: 'admin,user' });
    const adminToken = generateToken(admin);
    const targetUser = createTestUser();

    const response = await fastify.inject({
      method: 'PATCH',
      url: `/admin/users/${targetUser.sub}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'suspended' }
    });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.json().status, 'suspended');
  });
});

describe('POST /admin/users/:sub/membership', () => {
  it('should grant lifetime membership', async () => {
    const admin = createTestUser({ roles: 'admin,user' });
    const adminToken = generateToken(admin);
    const targetUser = createTestUser();

    const response = await fastify.inject({
      method: 'POST',
      url: `/admin/users/${targetUser.sub}/membership`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { plan: 'lifetime' }
    });

    assert.strictEqual(response.statusCode, 201);
    assert.strictEqual(response.json().plan, 'lifetime');
    assert.strictEqual(response.json().source, 'admin');
    assert.strictEqual(response.json().expires_at, null);
  });
});

// ============================================
// Invitation Service Tests
// ============================================
describe('Invitation Service', () => {
  it('should create unique codes', () => {
    const codes = invitationService.createInvitations({
      count: 100,
      createdBy: null
    });

    const uniqueCodes = new Set(codes.map(c => c.code));
    assert.strictEqual(uniqueCodes.size, 100);
  });

  it('should create codes with correct format', () => {
    const codes = invitationService.createInvitations({
      count: 10,
      createdBy: null
    });

    codes.forEach(({ code }) => {
      assert.ok(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code));
    });
  });
});

// ============================================
// Membership Service Tests
// ============================================
describe('Membership Service', () => {
  it('should detect expired membership', () => {
    const user = createTestUser();

    const membershipId = require('uuid').v4();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    testDb.prepare(`
      INSERT INTO memberships (id, user_sub, plan, status, starts_at, expires_at, source)
      VALUES (?, ?, ?, 'active', ?, ?, 'self')
    `).run(membershipId, user.sub, 'monthly', yesterday, yesterday);

    const membership = membershipService.getActiveMembership(user.sub);
    assert.strictEqual(membership, null);
  });
});