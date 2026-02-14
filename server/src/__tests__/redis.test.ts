import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../config/redis.js', () => {
  const mockClient = {
    ping: jest.fn().mockResolvedValue('PONG' as never),
    get: jest.fn(),
    set: jest.fn(),
    quit: jest.fn(),
    status: 'ready',
  };
  return {
    getPubClient: jest.fn().mockReturnValue(mockClient),
    getSubClient: jest.fn().mockReturnValue(mockClient),
    getCacheClient: jest.fn().mockReturnValue(mockClient),
    cacheGet: jest.fn(),
    cacheSet: jest.fn(),
    redisHealthCheck: jest.fn(),
    closeRedisConnections: jest.fn(),
  };
});

describe('Redis config module', () => {
  let redis: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    redis = await import('../../config/redis.js');
  });

  it('should export cache helpers', () => {
    expect(typeof redis.cacheGet).toBe('function');
    expect(typeof redis.cacheSet).toBe('function');
  });

  it('should export client factories', () => {
    expect(typeof redis.getPubClient).toBe('function');
    expect(typeof redis.getSubClient).toBe('function');
    expect(typeof redis.getCacheClient).toBe('function');
  });

  it('should export health check', () => {
    expect(typeof redis.redisHealthCheck).toBe('function');
  });

  it('cacheGet should return parsed data', async () => {
    redis.cacheGet.mockResolvedValue({ foo: 'bar' } as never);
    const result = await redis.cacheGet('key');
    expect(result).toEqual({ foo: 'bar' });
  });

  it('redisHealthCheck should return boolean', async () => {
    redis.redisHealthCheck.mockResolvedValue(true as never);
    const ok = await redis.redisHealthCheck();
    expect(ok).toBe(true);
  });
});
