import notificationQueue from '../queues/notificationQueue.js';
import notificationService from '../services/notificationService.js';
import logger from '../config/logger.js';

/**
 * Bull queue processor for notification jobs.
 * Runs in the same process (or can be extracted to separate worker binary).
 */
export function startNotificationWorker(): void {
  notificationQueue.process(5, async (job) => {
    const { type, userId, userIds, payload } = job.data;

    logger.info(`Processing notification job ${job.id} type=${type}`);

    try {
      if (userIds && userIds.length > 0) {
        const result = await notificationService.sendToMultipleUsers(userIds, payload);
        logger.info(`Batch notification: ${result.sent} sent, ${result.failed} failed`);
        return result;
      }

      if (userId) {
        const sent = await notificationService.sendToUser(userId, payload);
        return { sent: sent ? 1 : 0, failed: sent ? 0 : 1 };
      }

      logger.warn(`Notification job ${job.id} has no userId/userIds`);
      return { sent: 0, failed: 0 };
    } catch (err) {
      logger.error(`Notification job ${job.id} failed:`, err);
      throw err; // Bull will retry
    }
  });

  notificationQueue.on('failed', (job, err) => {
    logger.error(`Notification job ${job.id} finally failed:`, err.message);
  });

  notificationQueue.on('completed', (job, result) => {
    logger.debug(`Notification job ${job.id} completed:`, result);
  });

  logger.info('Notification worker started');
}
