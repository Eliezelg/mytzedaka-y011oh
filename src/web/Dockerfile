# Stage 1: Build environment
FROM node:18-alpine AS builder

# Set environment variables
ENV NODE_ENV=production \
    GENERATE_SOURCEMAP=false

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set working directory and permissions
WORKDIR /app
RUN chown appuser:appgroup /app

# Switch to non-root user
USER appuser

# Copy package files with hash verification
COPY --chown=appuser:appgroup package*.json yarn.lock ./

# Install dependencies with yarn for better performance
RUN yarn install --frozen-lockfile --production=false \
    && yarn cache clean

# Security audit
RUN yarn audit

# Copy source code with proper ownership
COPY --chown=appuser:appgroup . .

# Build production bundle with optimization flags
RUN yarn build

# Stage 2: Production environment
FROM nginx:alpine

# Create non-root nginx user
RUN adduser -S nginxuser -G nginx

# Copy custom nginx configuration
COPY --from=builder --chown=nginxuser:nginx /app/nginx.conf /etc/nginx/conf.d/default.conf

# Create required directories with proper permissions
RUN mkdir -p /var/cache/nginx /var/log/nginx \
    && chown -R nginxuser:nginx /var/cache/nginx /var/log/nginx /etc/nginx/conf.d

# Copy built assets with proper permissions
COPY --from=builder --chown=nginxuser:nginx /app/build /usr/share/nginx/html

# Set proper permissions for nginx directories
RUN chown -R nginxuser:nginx /usr/share/nginx/html \
    && chmod -R 755 /usr/share/nginx/html

# Switch to non-root user
USER nginxuser

# Configure security headers
RUN echo "add_header X-Content-Type-Options 'nosniff' always;" >> /etc/nginx/conf.d/security-headers.conf \
    && echo "add_header X-Frame-Options 'DENY' always;" >> /etc/nginx/conf.d/security-headers.conf \
    && echo "add_header X-XSS-Protection '1; mode=block' always;" >> /etc/nginx/conf.d/security-headers.conf \
    && echo "add_header Strict-Transport-Security 'max-age=31536000; includeSubDomains; preload' always;" >> /etc/nginx/conf.d/security-headers.conf

# Expose ports
EXPOSE 80 443

# Configure healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Set default command
CMD ["nginx", "-g", "daemon off;"]