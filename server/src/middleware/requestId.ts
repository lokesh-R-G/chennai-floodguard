import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

/**
 * Attach a unique request-id to every incoming request.
 * Respects an existing X-Request-Id header (proxy pass-through).
 */
export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const existing = req.headers['x-request-id'];
  req.requestId = (typeof existing === 'string' ? existing : uuidv4());
  next();
}

/**
 * Log every request with its correlation ID.
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const meta = {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };

    if (res.statusCode >= 500) {
      logger.error('request completed', meta);
    } else if (res.statusCode >= 400) {
      logger.warn('request completed', meta);
    } else {
      logger.info('request completed', meta);
    }
  });

  // Attach request-id to response headers for client tracing
  res.setHeader('X-Request-Id', req.requestId);
  next();
}
