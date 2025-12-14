#!/bin/bash

# =============================================================================
# Eli's Pizza Picker - Production Deployment Script
# =============================================================================
# Usage: ./deploy.sh [options]
#
# Options:
#   --no-backup       Skip database backup
#   --no-migrate      Skip database migrations
#   --rebuild         Force rebuild of Docker images (no cache)
#   --generate-vapid  Generate VAPID keys for push notifications
#   --check-env       Check environment variables only (no deploy)
#   --help            Show this help message
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/backups"
LOG_FILE="${SCRIPT_DIR}/deploy.log"
COMPOSE_PROFILE="production"

# Default options
SKIP_BACKUP=false
SKIP_MIGRATE=false
FORCE_REBUILD=false
GENERATE_VAPID=false
CHECK_ENV_ONLY=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --no-migrate)
            SKIP_MIGRATE=true
            shift
            ;;
        --rebuild)
            FORCE_REBUILD=true
            shift
            ;;
        --generate-vapid)
            GENERATE_VAPID=true
            shift
            ;;
        --check-env)
            CHECK_ENV_ONLY=true
            shift
            ;;
        --help)
            head -20 "$0" | tail -17
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Logging function
log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${BLUE}[$timestamp]${NC} $1"
    echo "[$timestamp] $1" >> "$LOG_FILE"
}

log_success() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${GREEN}[$timestamp] ✓ $1${NC}"
    echo "[$timestamp] ✓ $1" >> "$LOG_FILE"
}

log_warning() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${YELLOW}[$timestamp] ⚠ $1${NC}"
    echo "[$timestamp] ⚠ $1" >> "$LOG_FILE"
}

log_error() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${RED}[$timestamp] ✗ $1${NC}"
    echo "[$timestamp] ✗ $1" >> "$LOG_FILE"
}

# Generate VAPID keys for push notifications
generate_vapid_keys() {
    log "Generating VAPID keys for push notifications..."

    # Check if Node.js is available (either locally or in Docker)
    if command -v npx &> /dev/null; then
        # Generate keys using web-push
        local keys=$(npx web-push generate-vapid-keys --json 2>/dev/null)

        if [ -n "$keys" ]; then
            local public_key=$(echo "$keys" | grep -o '"publicKey":"[^"]*"' | cut -d'"' -f4)
            local private_key=$(echo "$keys" | grep -o '"privateKey":"[^"]*"' | cut -d'"' -f4)

            echo ""
            echo "=============================================="
            echo "  VAPID Keys Generated Successfully!"
            echo "=============================================="
            echo ""
            echo "Add these to your .env file:"
            echo ""
            echo "VAPID_PUBLIC_KEY=${public_key}"
            echo "VAPID_PRIVATE_KEY=${private_key}"
            echo "VAPID_CONTACT_EMAIL=your-email@example.com"
            echo ""
            echo "=============================================="
            echo ""

            # Offer to append to .env
            read -p "Would you like to append these to .env now? (y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                echo "" >> "${SCRIPT_DIR}/.env"
                echo "# Push Notification VAPID Keys (generated $(date '+%Y-%m-%d'))" >> "${SCRIPT_DIR}/.env"
                echo "VAPID_PUBLIC_KEY=${public_key}" >> "${SCRIPT_DIR}/.env"
                echo "VAPID_PRIVATE_KEY=${private_key}" >> "${SCRIPT_DIR}/.env"
                echo "VAPID_CONTACT_EMAIL=admin@example.com" >> "${SCRIPT_DIR}/.env"
                log_success "VAPID keys added to .env"
                log_warning "Remember to update VAPID_CONTACT_EMAIL with your actual email"
            fi
        else
            log_error "Failed to generate VAPID keys. Make sure web-push is installed."
            log "Run: npm install -g web-push"
            exit 1
        fi
    else
        log_error "npx not found. Please install Node.js or run inside the container."
        exit 1
    fi
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi

    if ! command -v git &> /dev/null; then
        log_error "Git is not installed"
        exit 1
    fi

    if [ ! -f "${SCRIPT_DIR}/.env" ]; then
        log_error ".env file not found. Please create one from .env.example"
        exit 1
    fi

    # Check for required environment variables
    source "${SCRIPT_DIR}/.env"
    if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "REPLACE_WITH_SECURE_RANDOM_STRING" ]; then
        log_error "JWT_SECRET is not set or is using default value. Please update .env"
        exit 1
    fi

    # Check for VAPID keys (optional but recommended for push notifications)
    if [ -z "$VAPID_PUBLIC_KEY" ] || [ -z "$VAPID_PRIVATE_KEY" ]; then
        log_warning "VAPID keys not configured - push notifications will be disabled"
        log_warning "Run './deploy.sh --generate-vapid' to generate keys"
    else
        log_success "VAPID keys configured for push notifications"
    fi

    log_success "Prerequisites check passed"
}

# Backup database
backup_database() {
    if [ "$SKIP_BACKUP" = true ]; then
        log_warning "Skipping database backup (--no-backup flag)"
        return
    fi

    log "Creating database backup..."

    mkdir -p "$BACKUP_DIR"

    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local backup_file="${BACKUP_DIR}/backup_${timestamp}.sql"

    # Check if database container is running
    if docker ps --format '{{.Names}}' | grep -q 'pizza-picker-db'; then
        docker exec pizza-picker-db pg_dump -U postgres eli_pizza_picker > "$backup_file" 2>/dev/null

        if [ -f "$backup_file" ] && [ -s "$backup_file" ]; then
            gzip "$backup_file"
            log_success "Database backup created: ${backup_file}.gz"

            # Keep only last 7 backups
            ls -t "${BACKUP_DIR}"/backup_*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm
        else
            log_warning "Database backup may be empty (new installation?)"
            rm -f "$backup_file"
        fi
    else
        log_warning "Database container not running, skipping backup"
    fi
}

# Pull latest changes from git
pull_changes() {
    log "Pulling latest changes from git..."

    cd "$SCRIPT_DIR"

    # Check for local changes
    if ! git diff --quiet HEAD 2>/dev/null; then
        log_warning "Local changes detected. Stashing..."
        git stash
    fi

    # Pull changes
    git pull origin main

    if [ $? -eq 0 ]; then
        log_success "Git pull completed"

        # Show recent commits
        log "Recent changes:"
        git log --oneline -5
    else
        log_error "Git pull failed"
        exit 1
    fi
}

# Build and restart containers
deploy_containers() {
    log "Building and deploying containers..."

    cd "$SCRIPT_DIR"

    # Determine docker compose command
    if docker compose version &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
    else
        DOCKER_COMPOSE="docker-compose"
    fi

    # Build options
    BUILD_OPTS=""
    if [ "$FORCE_REBUILD" = true ]; then
        BUILD_OPTS="--no-cache"
        log "Force rebuilding (no cache)..."
    fi

    # Build and restart
    $DOCKER_COMPOSE --profile $COMPOSE_PROFILE build $BUILD_OPTS

    if [ $? -ne 0 ]; then
        log_error "Docker build failed"
        exit 1
    fi

    log "Restarting containers..."
    $DOCKER_COMPOSE --profile $COMPOSE_PROFILE up -d

    if [ $? -eq 0 ]; then
        log_success "Containers deployed successfully"
    else
        log_error "Container deployment failed"
        exit 1
    fi
}

# Run database migrations
run_migrations() {
    if [ "$SKIP_MIGRATE" = true ]; then
        log_warning "Skipping database migrations (--no-migrate flag)"
        return
    fi

    log "Running database migrations..."

    # Wait for database to be ready
    log "Waiting for database to be ready..."
    sleep 5

    # Run migrations inside the app container
    docker exec pizza-picker-app npx prisma migrate deploy --schema=./prisma/schema.prisma

    if [ $? -eq 0 ]; then
        log_success "Database migrations completed"
    else
        log_warning "Migration command returned non-zero (may be OK if no pending migrations)"
    fi
}

# Verify deployment
verify_deployment() {
    log "Verifying deployment..."

    # Wait for app to start
    log "Waiting for application to start..."
    sleep 10

    # Check health endpoint
    local max_attempts=12
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -s -f http://localhost:3001/api/health > /dev/null 2>&1; then
            log_success "Health check passed"
            break
        fi

        if [ $attempt -eq $max_attempts ]; then
            log_error "Health check failed after $max_attempts attempts"
            log "Checking container logs..."
            docker logs pizza-picker-app --tail 50
            exit 1
        fi

        log "Waiting for app to be ready (attempt $attempt/$max_attempts)..."
        sleep 5
        ((attempt++))
    done

    # Show running containers
    log "Running containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep pizza-picker

    # Show API docs URL
    log_success "API Documentation available at: /api/docs"
}

# Cleanup old images
cleanup() {
    log "Cleaning up old Docker images..."
    docker image prune -f > /dev/null 2>&1
    log_success "Cleanup completed"
}

# Show environment status
show_env_status() {
    echo ""
    echo "=============================================="
    echo "  Environment Status"
    echo "=============================================="
    echo ""

    source "${SCRIPT_DIR}/.env"

    log "Checking environment variables..."

    # Required variables
    if [ -n "$DATABASE_URL" ]; then
        log_success "DATABASE_URL: configured"
    else
        log_error "DATABASE_URL: missing"
    fi

    if [ -n "$JWT_SECRET" ] && [ "$JWT_SECRET" != "REPLACE_WITH_SECURE_RANDOM_STRING" ]; then
        log_success "JWT_SECRET: configured"
    else
        log_error "JWT_SECRET: missing or default"
    fi

    # Optional but recommended
    if [ -n "$VAPID_PUBLIC_KEY" ] && [ -n "$VAPID_PRIVATE_KEY" ]; then
        log_success "VAPID keys: configured (push notifications enabled)"
    else
        log_warning "VAPID keys: not configured (push notifications disabled)"
    fi

    if [ -n "$NETSAPIENS_API_KEY" ]; then
        log_success "SMS (Netsapiens): configured"
    else
        log_warning "SMS (Netsapiens): not configured"
    fi

    if [ -n "$SMTP_HOST" ]; then
        log_success "Email (SMTP): configured"
    else
        log_warning "Email (SMTP): not configured"
    fi

    echo ""
    echo "=============================================="
    echo ""
}

# Main deployment flow
main() {
    # Handle special commands first
    if [ "$GENERATE_VAPID" = true ]; then
        generate_vapid_keys
        exit 0
    fi

    if [ "$CHECK_ENV_ONLY" = true ]; then
        show_env_status
        exit 0
    fi

    echo ""
    echo "=============================================="
    echo "  Eli's Pizza Picker - Deployment"
    echo "=============================================="
    echo ""

    local start_time=$(date +%s)

    check_prerequisites
    backup_database
    pull_changes
    deploy_containers
    run_migrations
    verify_deployment
    cleanup

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo ""
    echo "=============================================="
    log_success "Deployment completed in ${duration} seconds"
    echo "=============================================="
    echo ""

    # Show helpful post-deployment info
    log "Post-deployment checklist:"
    echo "  - API Health: curl http://localhost:3001/api/health"
    echo "  - API Docs:   http://localhost:3001/api/docs"
    echo "  - Metrics:    curl http://localhost:3001/api/metrics"
    echo ""
}

# Run main function
main
