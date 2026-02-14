import { describe, it, expect } from '@jest/globals';

// Config module doesn't need external mocks
describe('Env Config', () => {
  it('should export config object with defaults', async () => {
    // Set minimal env vars needed
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
    process.env.JWT_SECRET = 'test-secret';

    const { config } = await import('../../config/env.js');
    expect(config).toBeDefined();
    expect(config.port).toBeDefined();
    expect(config.mongodbUri).toBe('mongodb://localhost:27017/test');
    expect(config.jwtSecret).toBe('test-secret');
  });

  it('should use default port 5000', async () => {
    delete process.env.PORT;
    const { config } = await import('../../config/env.js');
    expect(config.port).toBe(5000);
  });

  it('should use default node env development', async () => {
    delete process.env.NODE_ENV;
    const { config } = await import('../../config/env.js');
    expect(config.nodeEnv).toBe('development');
  });

  it('validateEnv should not throw when required vars set', async () => {
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
    process.env.JWT_SECRET = 'test-secret';

    const { validateEnv } = await import('../../config/env.js');
    expect(() => validateEnv()).not.toThrow();
  });
});
