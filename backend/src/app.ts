import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';
import { swaggerSpec } from './config/swagger.js';
import logger from './utils/logger.js';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import eventRoutes from './routes/events.js';
import pizzaRoutes from './routes/pizzas.js';
import voteRoutes from './routes/votes.js';
import reportRoutes from './routes/reports.js';
import metricsRoutes from './routes/metrics.js';
import analyticsRoutes from './routes/analytics.js';
import pushRoutes from './routes/push.js';

// Import middleware
import { sanitizeBody } from './middleware/sanitize.js';

// Import Prisma for health check
import prisma from './utils/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust proxy (nginx) for correct IP detection and rate limiting
app.set('trust proxy', 1);

// CORS configuration
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  })
);

// HTTP request logging
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/api/health',
    },
  })
);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sanitize request body to prevent XSS attacks
app.use(sanitizeBody);

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later',
  },
});

// General rate limiting
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    success: false,
    error: 'Too many requests, please try again later',
  },
});

app.use('/api/auth', authLimiter);
app.use('/api', generalLimiter);

// Health check with database connectivity test
app.get('/api/health', async (_req, res) => {
  const health: {
    status: 'ok' | 'degraded';
    timestamp: string;
    uptime: number;
    checks: {
      database: 'ok' | 'error';
    };
    message?: string;
  } = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    checks: {
      database: 'ok',
    },
  };

  try {
    // Test database connectivity
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    health.status = 'degraded';
    health.checks.database = 'error';
    logger.error({ err: error }, 'Health check: database connection failed');
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json({
    success: health.status === 'ok',
    ...health,
  });
});

// API Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "Eli's Pizza Picker API Docs",
}));

// OpenAPI spec endpoint
app.get('/api/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/events', pizzaRoutes);
app.use('/api/events', voteRoutes);
app.use('/api/events', reportRoutes);
app.use('/api', metricsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/push', pushRoutes);

// Serve static frontend in production
if (config.nodeEnv === 'production') {
  const publicPath = path.join(__dirname, '..', 'public');
  app.use(express.static(publicPath));

  // Handle SPA routing - serve index.html for non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err, url: req.url, method: req.method }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: config.nodeEnv === 'development' ? err.message : 'Internal server error',
  });
});

export default app;
