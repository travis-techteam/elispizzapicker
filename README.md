# Eli's Pizza Picker

A Progressive Web App (PWA) for group pizza ordering and voting. Users vote on their top 3 pizza choices with weighted priorities, specify how many slices they want, and admins receive optimized ordering recommendations.

## Features

- **SMS & Magic Link Authentication** - Phone-based login via Netsapiens API or email magic links via SMTP2Go
- **Weighted Voting** - Users pick their top 3 pizza choices (1st = 3 points, 2nd = 2 points, 3rd = 1 point)
- **Slice Count** - Users specify how many slices they plan to eat
- **Smart Ordering Algorithm** - Calculates optimal pizza order with half-pizza pairing
- **Real-time Results** - See what everyone voted for
- **Admin Dashboard** - Manage users, events, and pizza options
- **Mobile-First PWA** - Installable on home screen, works offline

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, React Query, Vite PWA
- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: PostgreSQL
- **Deployment**: Docker, Nginx, Let's Encrypt SSL

## Quick Start (Development)

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- Git

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd eli-pizza-picker

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Start Database

```bash
docker-compose -f docker-compose.dev.yml up -d
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 4. Initialize Database

```bash
cd backend
npx prisma migrate dev
npx prisma db seed
cd ..
```

### 5. Run Development Servers

In separate terminals:

```bash
# Backend
cd backend && npm run dev

# Frontend
cd frontend && npm run dev
```

Visit http://localhost:5173

## Production Deployment (EC2)

### 1. Server Setup

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Clone Repository

```bash
git clone <your-repo-url>
cd eli-pizza-picker
```

### 3. Configure Environment

```bash
cp .env.example .env
nano .env
```

Required environment variables:
- `JWT_SECRET` - Strong random string for JWT signing
- `POSTGRES_PASSWORD` - Database password
- `NETSAPIENS_*` - SMS API credentials (if using)
- `SMTP_*` - SMTP2Go credentials

### 4. SSL Certificate Setup

```bash
# Create directories
mkdir -p certbot/conf certbot/www

# Get initial certificate (replace with your domain)
docker run -it --rm -v $(pwd)/certbot/conf:/etc/letsencrypt -v $(pwd)/certbot/www:/var/www/certbot certbot/certbot certonly --webroot --webroot-path=/var/www/certbot -d elispizzapicker.com -d www.elispizzapicker.com
```

### 5. Deploy

```bash
# Build and start all services
docker-compose --profile production up -d --build

# Run database migrations
docker-compose exec app npx prisma migrate deploy

# Seed initial admin (optional)
docker-compose exec app npx prisma db seed
```

### 6. DNS Configuration

Point your domain to your EC2 instance's public IP:
- `elispizzapicker.com` → A record → your-ec2-ip
- `www.elispizzapicker.com` → CNAME → elispizzapicker.com

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret for JWT signing | Yes |
| `JWT_EXPIRES_IN` | Access token expiry (default: 1h) | No |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry (default: 7d) | No |
| `NETSAPIENS_API_URL` | Netsapiens API base URL | For SMS |
| `NETSAPIENS_DOMAIN` | Netsapiens domain | For SMS |
| `NETSAPIENS_USER` | Netsapiens user | For SMS |
| `NETSAPIENS_API_KEY` | Netsapiens API key | For SMS |
| `SMTP_HOST` | SMTP server host | For email |
| `SMTP_PORT` | SMTP server port | For email |
| `SMTP_USER` | SMTP username | For email |
| `SMTP_PASS` | SMTP password | For email |
| `SMTP_FROM` | From email address | For email |

## Project Structure

```
eli-pizza-picker/
├── frontend/           # React PWA
│   ├── src/
│   │   ├── components/ # UI components
│   │   ├── pages/      # Page components
│   │   ├── context/    # React context
│   │   ├── services/   # API service
│   │   └── types/      # TypeScript types
│   └── public/         # Static assets
├── backend/            # Express API
│   └── src/
│       ├── routes/     # API routes
│       ├── services/   # Business logic
│       ├── middleware/ # Auth middleware
│       └── config/     # Configuration
├── prisma/             # Database schema & migrations
├── docker-compose.yml  # Production Docker config
├── Dockerfile          # Multi-stage build
└── nginx.conf          # Nginx SSL config
```

## API Endpoints

### Authentication
- `POST /api/auth/request-code` - Request SMS code
- `POST /api/auth/request-magic-link` - Request magic link
- `POST /api/auth/verify-code` - Verify SMS code
- `POST /api/auth/verify-magic-link` - Verify magic link
- `POST /api/auth/refresh` - Refresh access token

### Users (Admin only)
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Events
- `GET /api/events` - List events
- `GET /api/events/active` - Get active event
- `POST /api/events` - Create event (Admin)
- `PUT /api/events/:id` - Update event (Admin)
- `DELETE /api/events/:id` - Delete event (Admin)

### Voting
- `GET /api/events/:eventId/votes` - Get all votes
- `GET /api/events/:eventId/votes/me` - Get my vote
- `POST /api/events/:eventId/votes` - Submit/update vote
- `DELETE /api/events/:eventId/votes/me` - Remove vote

### Reports (Admin only)
- `GET /api/events/:eventId/report` - Get order recommendation

## Adding Your Logo

Replace these files with your generated logo:
- `frontend/public/favicon.svg`
- `frontend/public/pwa-192x192.png`
- `frontend/public/pwa-512x512.png`
- `frontend/public/apple-touch-icon.png`

## License

Private - All rights reserved
