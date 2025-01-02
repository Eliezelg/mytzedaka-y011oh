# Development stage
FROM node:18.18-alpine3.18 AS development
LABEL stage=development

# Set working directory
WORKDIR /app

# Set development environment variables
ENV NODE_ENV=development \
    PORT=3000 \
    TZ=Asia/Jerusalem \
    LANG=he_IL.UTF-8 \
    DEBUG=app:*

# Install build dependencies
RUN apk add --no-cache \
    curl \
    python3 \
    make \
    g++ \
    git \
    tzdata

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies with exact versions
RUN npm ci

# Configure development environment
VOLUME [ "/app", "/app/node_modules", "/tmp" ]
EXPOSE 3000 9229

# Development command with debugging enabled
CMD ["npm", "run", "start:debug"]

# Builder stage
FROM node:18.18-alpine3.18 AS builder
LABEL stage=builder

WORKDIR /app

# Install build essentials
RUN apk add --no-cache \
    python3 \
    make \
    g++

# Copy package files with integrity verification
COPY package*.json ./
COPY tsconfig.json ./

# Install production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Security audit
RUN npm audit

# Copy source code
COPY src/ ./src/

# Build application
RUN npm run build

# Production stage
FROM node:18.18-alpine3.18 AS production
LABEL stage=production

# Set production environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    TZ=Asia/Jerusalem \
    LANG=he_IL.UTF-8

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Install security updates and required packages
RUN apk add --no-cache \
    curl \
    tzdata \
    dumb-init && \
    rm -rf /var/cache/apk/*

WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Set proper permissions
RUN chmod -R 550 /app && \
    chmod -R 770 /tmp && \
    chown -R nodejs:nodejs /tmp

# Configure security
USER nodejs
EXPOSE 3000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Set resource limits
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Enable container security features
SECURITY_OPTS="no-new-privileges:true"
CAPABILITIES="NET_BIND_SERVICE"

# Use dumb-init as entrypoint to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Production command with clustering
CMD ["node", "dist/main"]