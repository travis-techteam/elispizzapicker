# Build stage for frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Build stage for backend
FROM node:20-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
COPY prisma/ ../prisma/
RUN npm run build
RUN npx prisma generate

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Install production dependencies
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy built backend
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=backend-build /app/node_modules/.prisma ./node_modules/.prisma

# Copy Prisma schema for migrations
COPY prisma/ ./prisma/

# Copy built frontend to serve as static files
COPY --from=frontend-build /app/frontend/dist ./public

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]
