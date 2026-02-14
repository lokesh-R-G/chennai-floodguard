import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../queues/notificationQueue.js', () => ({
  default: {
    add: jest.fn().mockResolvedValue(undefined as never),
    process: jest.fn(),
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined as never),
    getJobCounts: jest.fn().mockResolvedValue({
      waiting: 0, active: 0, completed: 10, failed: 1, delayed: 0,
    } as never),
  },
}));

jest.unstable_mockModule('../../queues/mlQueue.js', () => ({
  default: {
    add: jest.fn().mockResolvedValue(undefined as never),
    process: jest.fn(),
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined as never),
    getJobCounts: jest.fn().mockResolvedValue({
      waiting: 0, active: 0, completed: 5, failed: 0, delayed: 0,
    } as never),
  },
}));

jest.unstable_mockModule('../../config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.unstable_mockModule('../../services/notificationService.js', () => ({
  default: {
    sendToUser: jest.fn().mockResolvedValue(true as never),
    sendToMultipleUsers: jest.fn().mockResolvedValue({ sent: 2, failed: 0 } as never),
  },
  notificationService: {
    sendToUser: jest.fn().mockResolvedValue(true as never),
    sendToMultipleUsers: jest.fn().mockResolvedValue({ sent: 2, failed: 0 } as never),
  },
}));

jest.unstable_mockModule('../../services/mlPipelineService.js', () => ({
  default: { updateFloodZones: jest.fn().mockResolvedValue(5 as never) },
  mlPipelineService: { updateFloodZones: jest.fn().mockResolvedValue(5 as never) },
}));

describe('Workers', () => {
  describe('notificationWorker', () => {
    it('should register queue processor', async () => {
      const notificationQueue = (await import('../../queues/notificationQueue.js')).default;
      const { startNotificationWorker } = await import('../../workers/notificationWorker.js');

      startNotificationWorker();
      expect(notificationQueue.process).toHaveBeenCalledWith(5, expect.any(Function));
      expect(notificationQueue.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(notificationQueue.on).toHaveBeenCalledWith('completed', expect.any(Function));
    });
  });

  describe('mlWorker', () => {
    it('should register queue processor', async () => {
      const mlQueue = (await import('../../queues/mlQueue.js')).default;
      const { startMLWorker } = await import('../../workers/mlWorker.js');

      startMLWorker();
      expect(mlQueue.process).toHaveBeenCalledWith(1, expect.any(Function));
      expect(mlQueue.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mlQueue.on).toHaveBeenCalledWith('completed', expect.any(Function));
    });

    it('should enqueue ML update', async () => {
      const mlQueue = (await import('../../queues/mlQueue.js')).default;
      const { enqueueMLUpdate } = await import('../../workers/mlWorker.js');

      await enqueueMLUpdate('manual', ['zone1']);
      expect(mlQueue.add).toHaveBeenCalledWith(
        { trigger: 'manual', zoneIds: ['zone1'] },
        { priority: 1 },
      );
    });

    it('should schedule cron with repeat config', async () => {
      const mlQueue = (await import('../../queues/mlQueue.js')).default;
      const { scheduleMLCron } = await import('../../workers/mlWorker.js');

      await scheduleMLCron(15);
      expect(mlQueue.add).toHaveBeenCalledWith(
        { trigger: 'cron' },
        expect.objectContaining({ repeat: { every: 900000 }, jobId: 'ml-cron' }),
      );
    });
  });
});
