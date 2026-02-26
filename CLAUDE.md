# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Brand Hub is a central authentication and membership platform that provides unified user identity management for sub-products. Sub-products consume APIs to verify user identity and membership status.

## Common Commands

```bash
# Development
npm run dev          # Start with watch mode (node --watch)
npm start            # Production start

# Testing
npm test             # Run E2E tests (uses Node.js built-in test runner)
npm run test:watch   # Run tests in watch mode

# Code Quality
npm run lint         # ESLint on src/ and tests/
npm run format       # Prettier formatting

# Key Management
node scripts/generate-keys.js  # Generate RS256 key pair in ./keys/
```

## Architecture

### Tech Stack
- **Framework**: Fastify (v5)
- **Database**: SQLite with better-sqlite3 (WAL mode enabled)
- **Caching**: lru-cache (in-memory, process-bound)
- **Auth**: RS256 JWT with JWKS endpoint at `/.well-known/jwks.json`
- **SMS**: External spug service (mock mode available)

### Core Module Pattern

**Routes** export `registerRoutes(fastify)` function:
```javascript
function registerRoutes(fastify) {
  fastify.post('/endpoint', { schema: {...} }, handler);
}
module.exports = { registerRoutes };
```

**Services** are plain CommonJS modules with business logic.

**Middleware** (in `src/middleware/auth.js`):
- `authMiddleware` - Validates JWT, populates `request.user`
- `adminMiddleware` - Checks for `admin` role
- `membershipMiddleware(level)` - Factory for membership requirements

### JWT Claims Structure

Tokens contain namespaced claims prefixed with `brand.`:
- `brand.roles` - Array of user roles (e.g., `['user', 'admin']`)
- `brand.membership` - Current membership level (`free`, `monthly`, `yearly`, `lifetime`)
- `brand.membership_exp` - Membership expiration timestamp

### Error Handling

Use `AppError` with predefined `ErrorCodes` from `src/utils/errors.js`:
```javascript
const { createError, ErrorCodes } = require('./utils/errors');
throw createError(ErrorCodes.PHONE_EXISTS);
```

### Database Transactions

SQLite transactions use better-sqlite3 pattern:
```javascript
const transaction = db.transaction(() => {
  // Multiple statements
});
transaction();
```

## Key Files

| File | Purpose |
|------|---------|
| `src/index.js` | Entry point, graceful shutdown handlers |
| `src/app.js` | Fastify setup, plugin/route registration |
| `src/config.js` | Environment configuration with defaults |
| `src/db/index.js` | Database connection, schema, seed data |
| `src/services/token.js` | JWT generation, refresh token management |
| `src/utils/errors.js` | Error codes and handler |

## Environment Variables

See `.env.example` for all configurable values. Key variables:
- `DB_PATH` - SQLite database path (default: `./data/brand.db`)
- `JWT_PRIVATE_KEY_PATH` / `JWT_PUBLIC_KEY_PATH` - RS256 key paths
- `SMS_MOCK_MODE` - Set to `true` for development (fixed code: `123456`)

## Testing

Tests use Node.js built-in test runner (`node:test`), not vitest. Tests run against in-memory SQLite with auto-generated test keys. The test file handles its own environment setup before importing modules.
