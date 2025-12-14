# Build stage for frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
ARG VITE_GOOGLE_MAPS_API_KEY
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
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
COPY prisma/ ./prisma/
RUN npm run build
RUN npx prisma generate --schema=./prisma/schema.prisma
# Compile seed file
RUN npx tsc ./prisma/seed.ts --outDir ./dist --esModuleInterop --module NodeNext --moduleResolution NodeNext --target ES2022

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Install production dependencies
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy Prisma schema and generate client
COPY prisma/ ./prisma/
RUN npx prisma generate --schema=./prisma/schema.prisma

# Copy built backend
COPY --from=backend-build /app/backend/dist ./dist

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
