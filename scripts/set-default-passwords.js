/**
 * Set default password for existing users without passwords
 * Run: node scripts/set-default-passwords.js
 */

const path = require('path');

// Load config first
const configPath = path.join(__dirname, '..', 'src', 'config');
require(configPath);

// Now load modules that depend on config
const { getDb, initDatabase } = require('../src/db');
const { hashPassword } = require('../src/utils/password');

const DEFAULT_PASSWORD = 'wszz526418';

async function setDefaultPasswords() {
  // Initialize database
  const dbPath = process.env.DB_PATH || './data/brand.db';
  initDatabase(dbPath);

  const db = getDb();

  // Find users without password_hash
  const usersWithoutPassword = db.prepare(
    "SELECT sub, phone, nickname FROM users WHERE password_hash IS NULL OR password_hash = ''"
  ).all();

  if (usersWithoutPassword.length === 0) {
    console.log('All users already have passwords set.');
    return;
  }

  console.log(`Found ${usersWithoutPassword.length} users without passwords.`);

  // Hash the default password
  const hashedPassword = await hashPassword(DEFAULT_PASSWORD);

  // Update users
  const updateStmt = db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE sub = ?');

  const transaction = db.transaction(() => {
    for (const user of usersWithoutPassword) {
      updateStmt.run(hashedPassword, user.sub);
      console.log(`Set default password for user: ${user.phone} (${user.nickname})`);
    }
  });

  transaction();

  console.log(`\nSuccessfully set default password for ${usersWithoutPassword.length} users.`);
  console.log('Default password:', DEFAULT_PASSWORD);
  console.log('\nPlease remind users to change their password after first login.');
}

setDefaultPasswords().catch(err => {
  console.error('Error setting default passwords:', err);
  process.exit(1);
});
