import Queue, { Job } from 'bull';
import logger from '../config/logger.js';
import { config } from '../config/env.js';

export interface MLJobData {
  trigger: 'cron' | 'manual' | 'api';
  zoneIds?: string[]; // empty = all zones
}

const mlQueue = new Queue<MLJobData>('ml-pipeline', {
  redis: {
    host: config.redisHost,
    port: config.redisPort,
    password: config.redisPassword,
    maxRetriesPerRequest: null,
  },
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 200,
    attempts: 2,
    backoff: { type: 'fixed', delay: 5000 },
  },
});

mlQueue.on('error', (err) => {
  logger.error('ML queue error:', err.message);
});

mlQueue.on('failed', (job: Job, err: Error) => {
  logger.error(`ML job ${job.id} failed:`, err.message);
});

mlQueue.on('completed', (job: Job) => {
  logger.info(`ML job ${job.id} completed`);
});

export default mlQueue;
