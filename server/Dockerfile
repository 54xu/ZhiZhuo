# =============================================================================
# ZhiZhuo POS Server - Multi-stage Docker Build
# =============================================================================

# ---- Stage 1: Builder ----
FROM node:18-alpine AS builder

# Install OpenSSL for Prisma engine compatibility
RUN apk add --no-cache openssl openssl-dev

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and Prisma schema
COPY src/ ./src/
COPY tsconfig.json ./
COPY prisma/ ./prisma/

# Generate Prisma client (with correct binary target for Alpine/musl)
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Compile seed.ts separately (for production seeding)
RUN npx tsc prisma/seed.ts --outDir dist/ --esModuleInterop --module commonjs --target ES2020 --skipLibCheck

# ---- Stage 2: Runner ----
FROM node:18-alpine AS runner

# Install curl for health check + OpenSSL for Prisma engine
RUN apk add --no-cache curl openssl

WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy production artifacts from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Set ownership
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/app.js"]
