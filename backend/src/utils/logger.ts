import pino from 'pino';
import { config } from '../config/index.js';

const logger = pino({
  level: config.isProduction ? 'info' : 'debug',
  transport: config.isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
  base: {
    env: config.nodeEnv,
  },
  redact: {
    paths: ['req.headers.authorization', 'password', 'token', 'code'],
    censor: '[REDACTED]',
  },
});

export default logger;
