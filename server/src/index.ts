import express, { Express, Request, Response } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';

// Load environment variables FIRST
dotenv.config();

import { config, validateEnv } from './config/env.js';
import connectDB from './config/database.js';
import logger from './config/logger.js';
import { closeRedisConnections } from './config/redis.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestIdMiddleware, requestLoggerMiddleware } from './middleware/requestId.js';
import WebSocketServer from './websocket/index.js';
import mlPipelineService from './services/mlPipelineService.js';
import { startNotificationWorker } from './workers/notificationWorker.js';
import { startMLWorker, scheduleMLCron } from './workers/mlWorker.js';
import notificationQueue from './queues/notificationQueue.js';
import mlQueue from './queues/mlQueue.js';

// Import routes
import authRoutes from './routes/auth.js';
import incidentRoutes from './routes/incidents.js';
import driverRoutes from './routes/drivers.js';
import floodZoneRoutes from './routes/floodZones.js';
import campRoutes from './routes/camps.js';
import healthRoutes from './routes/health.js';

// Validate environment on startup
validateEnv();

// Initialize Express app
const app: Express = express();
const httpServer = createServer(app);

// Initialize Sentry (if configured)
if (config.sentryDsn) {
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.nodeEnv,
    tracesSampleRate: 1.0,
  });
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

// ── Middleware ────────────────────────────────
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Structured logging via morgan
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(
    morgan('combined', {
      stream: { write: (message) => logger.info(message.trim()) },
    }),
  );
}

// Rate limiting
app.use(
  '/api/',
  rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// ── Routes ───────────────────────────────────
const API_VERSION = config.apiVersion;

app.use(`/api/${API_VERSION}/health`, healthRoutes);
app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/incidents`, incidentRoutes);
app.use(`/api/${API_VERSION}/drivers`, driverRoutes);
app.use(`/api/${API_VERSION}/flood-zones`, floodZoneRoutes);
app.use(`/api/${API_VERSION}/camps`, campRoutes);

// Root
app.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Chennai FloodGuard API',
    version: API_VERSION,
    health: `/api/${API_VERSION}/health`,
  });
});

// 404
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Sentry error handler
if (config.sentryDsn) {
  app.use(Sentry.Handlers.errorHandler());
}

// Global error handler
app.use(errorHandler);

// ── WebSocket ────────────────────────────────
const wsServer = new WebSocketServer(httpServer);

// ── Startup ──────────────────────────────────
const PORT = config.port;

const startServer = async () => {
  try {
    await connectDB();

    // Seed flood zones if empty
    await mlPipelineService.initializeFloodZones();

    // Start Bull workers (in-process; split to separate binary for horizontal scale)
    startNotificationWorker();
    startMLWorker();

    // Schedule repeating ML cron job
    await scheduleMLCron(config.mlCronIntervalMin);

    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`API: http://localhost:${PORT}/api/${API_VERSION}`);
      logger.info('WebSocket server running');
      logger.info('Bull workers started (notification + ML)');
    });

    // ── Graceful shutdown ──────────────────────
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received — shutting down gracefully…`);

      // 1. Stop accepting new connections
      httpServer.close(() => logger.info('HTTP server closed'));

      // 2. Close Bull queues (wait for active jobs)
      await notificationQueue.close().catch(() => {});
      await mlQueue.close().catch(() => {});
      logger.info('Bull queues closed');

      // 3. Close Redis
      await closeRedisConnections();
      logger.info('Redis connections closed');

      // 4. Exit
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Force kill after 15s
    const forceExit = () => {
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 15000).unref();
    };
    process.on('SIGTERM', forceExit);
    process.on('SIGINT', forceExit);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();

export { app, wsServer };
