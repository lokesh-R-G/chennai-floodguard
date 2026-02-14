import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../models/RefreshToken.js', () => ({
  default: {
    create: jest.fn(),
    findOne: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  hashToken: jest.fn((t: string) => `hashed_${t}`),
}));

jest.unstable_mockModule('../../models/User.js', () => ({
  default: {
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  config: {
    jwtSecret: 'test-secret-key-for-testing',
    jwtExpiresIn: '15m',
    jwtRefreshExpiresIn: '7d',
  },
}));

jest.unstable_mockModule('../../config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('Auth Middleware', () => {
  let generateToken: any;
  let jwt: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const auth = await import('../../middleware/auth.js');
    generateToken = auth.generateToken;
    jwt = (await import('jsonwebtoken')).default;
  });

  describe('generateToken', () => {
    it('should return a valid JWT string', () => {
      const token = generateToken('user123');
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });

    it('should encode the user id in the payload', () => {
      const token = generateToken('user123');
      const decoded = jwt.decode(token) as any;
      expect(decoded.id).toBe('user123');
    });

    it('should be verifiable with the correct secret', () => {
      const token = generateToken('user123');
      const decoded = jwt.verify(token, 'test-secret-key-for-testing') as any;
      expect(decoded.id).toBe('user123');
    });
  });

  describe('generateRefreshToken', () => {
    it('should return a raw token string', async () => {
      const auth = await import('../../middleware/auth.js');
      const RefreshToken = (await import('../../models/RefreshToken.js')).default;
      (RefreshToken.create as jest.Mock).mockResolvedValue({} as never);

      const token = await auth.generateRefreshToken('user123');
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(20);
    });
  });

  describe('revokeAllTokens', () => {
    it('should call updateMany to revoke', async () => {
      const auth = await import('../../middleware/auth.js');
      const RefreshToken = (await import('../../models/RefreshToken.js')).default;
      (RefreshToken.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 3 } as never);

      await auth.revokeAllTokens('user123');
      expect(RefreshToken.updateMany).toHaveBeenCalledWith(
        { userId: 'user123', revoked: false },
        { revoked: true },
      );
    });
  });
});
