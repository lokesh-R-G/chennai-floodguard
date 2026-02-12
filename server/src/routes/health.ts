import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * @route   GET /api/v1/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: dbStatus,
        name: mongoose.connection.name
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      }
    };

    if (dbStatus === 'disconnected') {
      res.status(503).json({
        success: false,
        ...health,
        status: 'degraded'
      });
    } else {
      res.json({
        success: true,
        ...health
      });
    }
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      success: false,
      status: 'error',
      message: 'Health check failed'
    });
  }
});

/**
 * @route   GET /api/v1/health/db
 * @desc    Database health check
 * @access  Public
 */
router.get('/db', async (req: Request, res: Response) => {
  try {
    await mongoose.connection.db.admin().ping();
    
    res.json({
      success: true,
      status: 'ok',
      database: 'connected'
    });
  } catch (error) {
    logger.error('Database health check failed:', error);
    res.status(503).json({
      success: false,
      status: 'error',
      database: 'disconnected'
    });
  }
});

export default router;
