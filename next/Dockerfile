# ============================================================================
# Base stage: Node.js with Yarn
# ============================================================================
FROM node:22-slim AS base
ENV YARN_VERSION=4.12.0
RUN corepack enable && corepack prepare yarn@${YARN_VERSION} --activate
WORKDIR /app

# ============================================================================
# Dependencies stage: Install all dependencies
# ============================================================================
FROM base AS deps

# Copy package files for dependency installation
COPY package.json yarn.lock .yarnrc.yml ./
COPY next/package.json ./next/
COPY .yarn ./.yarn

# Install dependencies
RUN yarn install --immutable

# ============================================================================
# Builder stage: Build the Next.js application
# ============================================================================
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/next/node_modules ./next/node_modules
COPY --from=deps /app/.yarn ./.yarn

# Copy source code
COPY package.json yarn.lock .yarnrc.yml ./
COPY next ./next
COPY src ./src
COPY tsconfig.json ./

# Build the Next.js application
WORKDIR /app/next
RUN yarn build

# ============================================================================
# Runner stage: Production image
# ============================================================================
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application from standalone output
COPY --from=builder /app/next/.next/standalone ./
COPY --from=builder /app/next/.next/static ./next/.next/static

# Copy app directory assets (icon.svg is used as favicon)
COPY --from=builder /app/next/app/icon.svg ./next/app/icon.svg

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "next/server.js"]
