import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/* Mock dependencies to avoid needing mongo/redis in tests */
jest.unstable_mockModule('mongoose', () => ({
  default: {
    connection: { readyState: 1, name: 'test-db', db: { admin: () => ({ ping: jest.fn().mockResolvedValue({ ok: 1 }) }) } },
  },
}));

jest.unstable_mockModule('../../config/redis.js', () => ({
  redisHealthCheck: jest.fn().mockResolvedValue(true as never),
}));

jest.unstable_mockModule('../../queues/notificationQueue.js', () => ({
  default: { getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0 } as never) },
}));

jest.unstable_mockModule('../../queues/mlQueue.js', () => ({
  default: { getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0 } as never) },
}));

jest.unstable_mockModule('../../config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('Health Route Logic', () => {
  it('should have health check endpoint handler', async () => {
    const healthModule = await import('../../routes/health.js');
    expect(healthModule.default).toBeDefined();
  });

  it('redisHealthCheck should be callable', async () => {
    const { redisHealthCheck } = await import('../../config/redis.js');
    const result = await redisHealthCheck();
    expect(result).toBe(true);
  });
});
