import Queue, { Job } from 'bull';
import logger from '../config/logger.js';
import { config } from '../config/env.js';

export interface NotificationJobData {
  type: 'push' | 'flood_alert' | 'driver_assigned' | 'job_completed' | 'low_stock';
  userId?: string;
  userIds?: string[];
  payload: Record<string, unknown>;
}

const notificationQueue = new Queue<NotificationJobData>('notifications', {
  redis: {
    host: config.redisHost,
    port: config.redisPort,
    password: config.redisPassword,
    maxRetriesPerRequest: null,
  },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  },
});

notificationQueue.on('error', (err) => {
  logger.error('Notification queue error:', err.message);
});

notificationQueue.on('failed', (job: Job, err: Error) => {
  logger.error(`Notification job ${job.id} failed (attempt ${job.attemptsMade}):`, err.message);
});

notificationQueue.on('completed', (job: Job) => {
  logger.debug(`Notification job ${job.id} completed`);
});

export default notificationQueue;
