/**
 * Key generation script
 * Run: node scripts/generate-keys.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const keysDir = path.join(__dirname, '..', 'keys');
const privateKeyPath = path.join(keysDir, 'private.pem');
const publicKeyPath = path.join(keysDir, 'public.pem');

// Ensure keys directory exists
if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
  console.log('Created keys directory:', keysDir);
}

// Check if keys already exist
if (fs.existsSync(privateKeyPath) || fs.existsSync(publicKeyPath)) {
  console.log('Keys already exist. Delete them first if you want to regenerate.');
  console.log('Private key:', privateKeyPath);
  console.log('Public key:', publicKeyPath);
  process.exit(0);
}

// Generate private key
console.log('Generating RSA 2048-bit private key...');
execSync(`openssl genrsa -out "${privateKeyPath}" 2048`);
console.log('Private key saved:', privateKeyPath);

// Generate public key
console.log('Generating public key...');
execSync(`openssl rsa -in "${privateKeyPath}" -pubout -out "${publicKeyPath}"`);
console.log('Public key saved:', publicKeyPath);

// Set permissions
fs.chmodSync(privateKeyPath, 0o600);
fs.chmodSync(publicKeyPath, 0o644);
console.log('Permissions set: private 600, public 644');

console.log('\nKey generation complete!');
console.log('Add these files to your .gitignore:');
console.log('  keys/private.pem');
console.log('  keys/public.pem');