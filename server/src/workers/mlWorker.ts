import mlQueue from '../queues/mlQueue.js';
import mlPipelineService from '../services/mlPipelineService.js';
import logger from '../config/logger.js';

/**
 * Bull queue processor for ML pipeline jobs.
 * Can be run in the API process or a dedicated worker container.
 */
export function startMLWorker(): void {
  mlQueue.process(1, async (job) => {
    const { trigger, zoneIds } = job.data;
    logger.info(`ML job ${job.id} trigger=${trigger} zones=${zoneIds?.length ?? 'all'}`);

    const updated = await mlPipelineService.updateFloodZones(zoneIds);
    return { zonesUpdated: updated };
  });

  mlQueue.on('failed', (job, err) => {
    logger.error(`ML job ${job.id} failed:`, err.message);
  });

  mlQueue.on('completed', (job, result) => {
    logger.info(`ML job ${job.id} completed:`, result);
  });

  logger.info('ML worker started');
}

/**
 * Enqueue a periodic ML refresh (called from cron or API).
 */
export async function enqueueMLUpdate(trigger: 'cron' | 'manual' | 'api' = 'cron', zoneIds?: string[]): Promise<void> {
  await mlQueue.add({ trigger, zoneIds }, { priority: trigger === 'manual' ? 1 : 5 });
}

/**
 * Start cron-based ML updates (add repeatable job).
 */
export async function scheduleMLCron(intervalMinutes: number = 30): Promise<void> {
  await mlQueue.add(
    { trigger: 'cron' as const },
    {
      repeat: { every: intervalMinutes * 60 * 1000 },
      jobId: 'ml-cron',
    },
  );
  logger.info(`ML cron scheduled every ${intervalMinutes}min`);
}
