import cron, { ScheduledTask } from 'node-cron';
import mlPipelineService from '../services/mlPipelineService.js';
import logger from '../config/logger.js';

let mlCronTask: ScheduledTask | null = null;

export async function enqueueMLUpdate(trigger: 'cron' | 'manual' | 'api' = 'cron', zoneIds?: string[]): Promise<void> {
  logger.info(`ML update trigger=${trigger} zones=${zoneIds?.length ?? 'all'}`);
  const updated = await mlPipelineService.updateFloodZones(zoneIds);
  logger.info(`ML update completed: ${updated} zones updated`);
}

/**
 * Start cron-based ML updates.
 */
export async function scheduleMLCron(intervalMinutes: number = 30): Promise<void> {
  if (mlCronTask) {
    mlCronTask.stop();
    mlCronTask = null;
  }

  const expression = `*/${intervalMinutes} * * * *`;
  mlCronTask = cron.schedule(expression, async () => {
    try {
      await enqueueMLUpdate('cron');
    } catch (error) {
      logger.error('Scheduled ML update failed:', error);
    }
  });

  logger.info(`ML cron scheduled every ${intervalMinutes}min`);
}

export function stopMLCron(): void {
  if (mlCronTask) {
    mlCronTask.stop();
    mlCronTask = null;
    logger.info('ML cron stopped');
  }
}
