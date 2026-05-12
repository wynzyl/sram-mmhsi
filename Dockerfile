
# --- Builder stage ---
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --production=false
COPY . .
# Build the Next.js app (if using static build, adjust as needed)
RUN npm run build

# --- Runtime stage ---
FROM node:24-alpine AS runner
WORKDIR /app
# Create non-root user and group
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
# Copy only production dependencies and built output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/src ./src
# (Optional) Copy any other required files (e.g., drizzle config, etc.)
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Expose the default Next.js port
EXPOSE 3000

# Switch to non-root user
USER nextjs

# Healthcheck for /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Run the production server
CMD ["npm", "run", "start"]