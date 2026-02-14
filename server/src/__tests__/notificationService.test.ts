import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock all dependencies
jest.unstable_mockModule('web-push', () => ({
  default: {
    setVapidDetails: jest.fn(),
    sendNotification: jest.fn(),
  },
}));

jest.unstable_mockModule('../../models/User.js', () => ({
  default: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.unstable_mockModule('../../queues/notificationQueue.js', () => ({
  default: { add: jest.fn() },
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  config: {
    vapidPublicKey: 'test-pub',
    vapidPrivateKey: 'test-priv',
    vapidSubject: 'mailto:test@test.com',
  },
}));

jest.unstable_mockModule('../../config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('NotificationService', () => {
  let NotificationService: any;
  let webpush: any;
  let User: any;
  let notificationQueue: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    webpush = (await import('web-push')).default;
    User = (await import('../../models/User.js')).default;
    notificationQueue = (await import('../../queues/notificationQueue.js')).default;
    const mod = await import('../../services/notificationService.js');
    NotificationService = mod.NotificationService;
  });

  describe('sendToUser', () => {
    it('should send push notification to user with subscription', async () => {
      const sub = { endpoint: 'https://push.example.com', keys: { p256dh: 'a', auth: 'b' } };
      User.findById.mockResolvedValue({ pushSubscription: sub } as never);
      webpush.sendNotification.mockResolvedValue(undefined as never);

      const service = new NotificationService();
      const result = await service.sendToUser('user1', { title: 'Test', body: 'Hello' });
      expect(result).toBe(true);
      expect(webpush.sendNotification).toHaveBeenCalledWith(sub, expect.any(String));
    });

    it('should return false if user has no subscription', async () => {
      User.findById.mockResolvedValue({ pushSubscription: null } as never);

      const service = new NotificationService();
      const result = await service.sendToUser('user1', { title: 'Test', body: 'Hello' });
      expect(result).toBe(false);
    });

    it('should remove stale subscription on 410 error', async () => {
      const sub = { endpoint: 'https://push.example.com' };
      User.findById.mockResolvedValue({ pushSubscription: sub } as never);
      webpush.sendNotification.mockRejectedValue({ statusCode: 410 } as never);
      User.findByIdAndUpdate.mockResolvedValue(undefined as never);

      const service = new NotificationService();
      const result = await service.sendToUser('user1', { title: 'Test', body: 'Hello' });
      expect(result).toBe(false);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user1', { $unset: { pushSubscription: 1 } });
    });
  });

  describe('sendToMultipleUsers', () => {
    it('should aggregate results from batch send', async () => {
      User.findById
        .mockResolvedValueOnce({ pushSubscription: { endpoint: 'e1' } } as never)
        .mockResolvedValueOnce(null as never);
      webpush.sendNotification.mockResolvedValue(undefined as never);

      const service = new NotificationService();
      const result = await service.sendToMultipleUsers(['u1', 'u2'], { title: 'T', body: 'B' });
      expect(result.sent).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  describe('queue-backed helpers', () => {
    it('should enqueue emergency alert', async () => {
      notificationQueue.add.mockResolvedValue(undefined as never);

      const service = new NotificationService();
      await service.enqueueEmergencyAlert('user1', 'inc1', 'flood');
      expect(notificationQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'push', userId: 'user1' }),
      );
    });

    it('should enqueue flood risk alert for multiple users', async () => {
      notificationQueue.add.mockResolvedValue(undefined as never);

      const service = new NotificationService();
      await service.enqueueFloodRiskAlert(['u1', 'u2'], 'Velachery', 8.5);
      expect(notificationQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'flood_alert', userIds: ['u1', 'u2'] }),
      );
    });
  });
});
