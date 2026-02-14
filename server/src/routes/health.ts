import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { redisHealthCheck } from '../config/redis.js';
import notificationQueue from '../queues/notificationQueue.js';
import mlQueue from '../queues/mlQueue.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * @route   GET /api/v1/health
 * @desc    Comprehensive health check
 * @access  Public
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const redisOk = await redisHealthCheck();

    // Queue stats
    const [notifCounts, mlCounts] = await Promise.all([
      notificationQueue.getJobCounts().catch(() => null),
      mlQueue.getJobCounts().catch(() => null),
    ]);

    const health = {
      status: dbStatus === 'connected' && redisOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      database: { status: dbStatus, name: mongoose.connection.name },
      redis: { status: redisOk ? 'connected' : 'disconnected' },
      queues: {
        notification: notifCounts,
        ml: mlCounts,
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB',
      },
    };

    const code = health.status === 'ok' ? 200 : 503;
    res.status(code).json({ success: health.status === 'ok', ...health });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({ success: false, status: 'error', message: 'Health check failed' });
  }
});

/**
 * @route   GET /api/v1/health/db
 * @desc    Database health check
 * @access  Public
 */
router.get('/db', async (_req: Request, res: Response) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ success: true, status: 'ok', database: 'connected' });
  } catch (error) {
    logger.error('Database health check failed:', error);
    res.status(503).json({ success: false, status: 'error', database: 'disconnected' });
  }
});

/**
 * @route   GET /api/v1/health/redis
 * @desc    Redis health check
 * @access  Public
 */
router.get('/redis', async (_req: Request, res: Response) => {
  try {
    const ok = await redisHealthCheck();
    if (ok) {
      res.json({ success: true, status: 'ok', redis: 'connected' });
    } else {
      res.status(503).json({ success: false, status: 'error', redis: 'disconnected' });
    }
  } catch (error) {
    logger.error('Redis health check failed:', error);
    res.status(503).json({ success: false, status: 'error', redis: 'disconnected' });
  }
});

export default router;
