import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Validate all required environment variables at startup.
 * Throws on first missing *required* variable.
 */
export function validateEnv(): void {
  const required: string[] = [
    'MONGODB_URI',
    'JWT_SECRET',
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Warn for recommended
  const recommended: string[] = [
    'VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
  ];
  const absent = recommended.filter((key) => !process.env[key]);
  if (absent.length > 0) {
    console.warn(`[env] Missing recommended environment variables (features degraded): ${absent.join(', ')}`);
  }
}

/**
 * Generate a correlation / request ID.
 */
export function generateRequestId(): string {
  return uuidv4();
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiVersion: process.env.API_VERSION || 'v1',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/chennai-floodguard',
  jwtSecret: process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION',
  jwtExpire: process.env.JWT_EXPIRES_IN || process.env.JWT_EXPIRE || '15m',
  jwtRefreshExpire: process.env.JWT_REFRESH_EXPIRES_IN || process.env.JWT_REFRESH_EXPIRE || '7d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  mlCron: process.env.ML_UPDATE_CRON || '*/15 * * * *',
  mlCronIntervalMin: parseInt(process.env.ML_CRON_INTERVAL_MIN || '30', 10),
  osrmUrl: process.env.OSRM_URL || process.env.OSRM_API_URL || 'http://router.project-osrm.org',
  maxDriverDistanceKm: parseFloat(process.env.MAX_DRIVER_DISTANCE_KM || '10'),
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
  vapidSubject: process.env.VAPID_SUBJECT || 'mailto:admin@chennaifloodguard.com',
  sentryDsn: process.env.SENTRY_DSN,
} as const;

export type AppConfig = typeof config;
