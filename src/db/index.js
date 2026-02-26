/**
 * Database connection and initialization
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { config } = require('../config');

let db = null;

/**
 * Initialize database connection and create tables
 */
function initDatabase(dbPath = config.dbPath) {
  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Create connection
  db = new Database(dbPath);

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  // Create tables
  createTables();

  return db;
}

/**
 * Create all tables
 */
function createTables() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      sub TEXT PRIMARY KEY,
      phone TEXT UNIQUE NOT NULL,
      nickname TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      roles TEXT DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
  `);

  // Invitations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS invitations (
      code TEXT PRIMARY KEY,
      created_by TEXT,
      used_by TEXT,
      channel TEXT,
      preset_membership TEXT DEFAULT 'free',
      preset_duration_days INTEGER,
      expires_at TEXT,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(sub),
      FOREIGN KEY (used_by) REFERENCES users(sub)
    );

    CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(used_at);
    CREATE INDEX IF NOT EXISTS idx_invitations_channel ON invitations(channel);
    CREATE INDEX IF NOT EXISTS idx_invitations_created_by ON invitations(created_by);
  `);

  // Memberships table
  db.exec(`
    CREATE TABLE IF NOT EXISTS memberships (
      id TEXT PRIMARY KEY,
      user_sub TEXT NOT NULL,
      plan TEXT DEFAULT 'free',
      status TEXT DEFAULT 'active',
      starts_at TEXT NOT NULL,
      expires_at TEXT,
      cancelled_at TEXT,
      source TEXT DEFAULT 'self',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_sub) REFERENCES users(sub)
    );

    CREATE INDEX IF NOT EXISTS idx_memberships_user_sub ON memberships(user_sub);
    CREATE INDEX IF NOT EXISTS idx_memberships_status ON memberships(status);
  `);

  // Refresh tokens table
  db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_sub TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      device_info TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_sub) REFERENCES users(sub) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_sub ON refresh_tokens(user_sub);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
  `);

  // Products table
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      name TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Used token hashes for replay detection
  db.exec(`
    CREATE TABLE IF NOT EXISTS used_token_hashes (
      token_hash TEXT PRIMARY KEY,
      user_sub TEXT NOT NULL,
      used_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_used_token_hashes_user_sub ON used_token_hashes(user_sub);
  `);
}

/**
 * Get database instance
 */
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Close database connection
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Run seed data (for testing/development)
 */
function runSeed() {
  const db = getDb();

  // Check if admin user exists
  const adminExists = db.prepare('SELECT 1 FROM users WHERE roles LIKE ?').get('%admin%');

  if (!adminExists) {
    const { v4: uuidv4 } = require('uuid');
    const adminSub = uuidv4();

    db.prepare(`
      INSERT INTO users (sub, phone, nickname, roles, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(adminSub, 'admin', 'Admin', 'admin,user', 'active');

    console.log(`Created admin user: ${adminSub}`);
  }

  // Check if default product exists
  const productExists = db.prepare('SELECT 1 FROM products WHERE name = ?').get('eat-healthy');

  if (!productExists) {
    db.prepare(`
      INSERT INTO products (name, display_name, status)
      VALUES (?, ?, ?)
    `).run('eat-healthy', 'Eat Healthy', 'active');

    console.log('Created default product: eat-healthy');
  }
}

module.exports = {
  initDatabase,
  getDb,
  closeDatabase,
  runSeed,
};