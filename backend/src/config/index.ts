import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  appUrl: process.env.APP_URL || 'http://localhost:5173',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  netsapiens: {
    apiUrl: process.env.NETSAPIENS_API_URL || 'https://pbx.truevoip.com/ns-api/v2',
    domain: process.env.NETSAPIENS_DOMAIN || '',
    user: process.env.NETSAPIENS_USER || '',
    apiKey: process.env.NETSAPIENS_API_KEY || '',
  },

  smtp: {
    apiKey: process.env.SMTP2GO_API_KEY || '',
    from: process.env.SMTP_FROM || 'noreply@elispizzapicker.com',
  },

  database: {
    url: process.env.DATABASE_URL || '',
  },
};

export default config;
