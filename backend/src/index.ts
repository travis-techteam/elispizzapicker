import app from './app.js';
import { config } from './config/index.js';
import prisma from './utils/prisma.js';
import { schedulerService } from './services/scheduler.service.js';
import logger from './utils/logger.js';

const start = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Connected to database');

    // Start the reminder scheduler
    schedulerService.start();

    // Start server
    app.listen(config.port, () => {
      logger.info({ port: config.port, env: config.nodeEnv }, 'Server started');
    });
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start server');
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully (SIGINT)...');
  schedulerService.stop();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down gracefully (SIGTERM)...');
  schedulerService.stop();
  await prisma.$disconnect();
  process.exit(0);
});

start();
