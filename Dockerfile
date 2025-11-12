# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Accept build arguments (only for NEXT_PUBLIC_* vars that need to be embedded in client bundle)
# Server-side variables (AUTH_API_BASE, RAG_SERVER_URL, RAG_API_BASE_URL) are set at runtime
# via docker-compose.yml environment section, not needed during build
ARG NEXT_PUBLIC_AUTH_API_URL
ARG NEXT_PUBLIC_SKIP_GOOGLE_CONNECT_MCP

# Set as environment variable for build (Next.js embeds NEXT_PUBLIC_* vars in client bundle)
ENV NEXT_PUBLIC_AUTH_API_URL=${NEXT_PUBLIC_AUTH_API_URL}
ENV NEXT_PUBLIC_SKIP_GOOGLE_CONNECT_MCP=${NEXT_PUBLIC_SKIP_GOOGLE_CONNECT_MCP}

# Copy package files
COPY package*.json ./

# Install dependencies
# Using npm ci for faster, reliable, reproducible builds
# Requires package-lock.json to be in sync with package.json
RUN npm ci

# Copy source code
COPY . .

# Remove Next.js cache to force fresh build
RUN rm -rf .next

# Disable Next.js build cache
ENV NEXT_DISABLE_CACHE=1

# Build the Next.js application
RUN npm install
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

# Set working directory
WORKDIR /app

# Set NODE_ENV to production
ENV NODE_ENV=production

# Add non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy package.json for reference (optional but good practice)
COPY --from=builder /app/package.json ./package.json

# Change ownership to nextjs user
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set environment variables
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application
CMD ["node", "server.js"]
