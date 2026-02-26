# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Production stage
FROM node:20-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S brandhub && \
    adduser -S brandhub -u 1001 -G brandhub

# Copy dependencies from builder
COPY --from=builder --chown=brandhub:brandhub /app/node_modules ./node_modules

# Copy application code
COPY --chown=brandhub:brandhub src ./src
COPY --chown=brandhub:brandhub package*.json ./

# Create directories for data and keys
RUN mkdir -p /app/data /app/keys && \
    chown -R brandhub:brandhub /app/data /app/keys

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Switch to non-root user
USER brandhub

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "src/index.js"]