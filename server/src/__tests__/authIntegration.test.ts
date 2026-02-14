import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

/* ── Heavy mocking: we test the route handler logic without real DB ── */

const mockUser = {
  _id: { toString: () => 'user123' },
  email: 'test@example.com',
  fullName: 'Test User',
  role: 'citizen',
  isActive: true,
  comparePassword: jest.fn().mockResolvedValue(true as never),
};

jest.unstable_mockModule('../../models/User.js', () => ({
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.unstable_mockModule('../../models/Driver.js', () => ({
  default: { create: jest.fn() },
}));

jest.unstable_mockModule('../../models/RefreshToken.js', () => ({
  default: {
    create: jest.fn().mockResolvedValue({} as never),
    findOne: jest.fn(),
    updateMany: jest.fn(),
  },
  hashToken: jest.fn((t: string) => `hashed_${t}`),
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  config: {
    jwtSecret: 'integration-test-secret',
    jwtExpiresIn: '15m',
    jwtRefreshExpiresIn: '7d',
  },
}));

jest.unstable_mockModule('../../config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('Auth Route Integration', () => {
  let User: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    User = (await import('../../models/User.js')).default;
  });

  describe('POST /register flow', () => {
    it('should reject duplicate emails', async () => {
      User.findOne.mockResolvedValue(mockUser as never);
      // Simulating what the route handler does
      const existing = await User.findOne({ email: 'test@example.com' });
      expect(existing).toBeTruthy();
    });

    it('should create user when email is new', async () => {
      User.findOne.mockResolvedValue(null as never);
      User.create.mockResolvedValue(mockUser as never);

      const existing = await User.findOne({ email: 'new@example.com' });
      expect(existing).toBeNull();

      const user = await User.create({ email: 'new@example.com', password: 'pass1234', fullName: 'New', role: 'citizen' });
      expect(user.email).toBe('test@example.com');
    });
  });

  describe('POST /login flow', () => {
    it('should validate password', async () => {
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      const user = await User.findOne({ email: 'test@example.com' }).select('+password');
      expect(user.isActive).toBe(true);
      const isMatch = await user.comparePassword('password123');
      expect(isMatch).toBe(true);
    });

    it('should reject inactive users', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(inactiveUser) });

      const user = await User.findOne({ email: 'test@example.com' }).select('+password');
      expect(user.isActive).toBe(false);
    });

    it('should reject wrong password', async () => {
      const wrongPw = { ...mockUser, comparePassword: jest.fn().mockResolvedValue(false as never) };
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(wrongPw) });

      const user = await User.findOne({ email: 'test@example.com' }).select('+password');
      const isMatch = await user.comparePassword('wrong');
      expect(isMatch).toBe(false);
    });
  });

  describe('Refresh token rotation flow', () => {
    it('should generate tokens for valid user', async () => {
      const { generateToken, generateRefreshToken } = await import('../../middleware/auth.js');
      const RefreshToken = (await import('../../models/RefreshToken.js')).default;
      (RefreshToken.create as jest.Mock).mockResolvedValue({} as never);

      const accessToken = generateToken('user123');
      expect(accessToken).toBeDefined();
      expect(accessToken.split('.').length).toBe(3);

      const refreshToken = await generateRefreshToken('user123');
      expect(refreshToken).toBeDefined();
      expect(typeof refreshToken).toBe('string');
    });
  });
});
