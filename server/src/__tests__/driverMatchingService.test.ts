import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { DriverMatchingService } from '../../services/driverMatchingService.js';

// Mock dependencies
jest.unstable_mockModule('../../models/Driver.js', () => ({
  default: {
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
  DriverStatus: { AVAILABLE: 'available', BUSY: 'busy', OFFLINE: 'offline' },
}));

jest.unstable_mockModule('../../models/Incident.js', () => ({
  default: {
    findById: jest.fn(),
    find: jest.fn(),
  },
  IncidentStatus: { PENDING: 'pending', ASSIGNED: 'assigned' },
}));

jest.unstable_mockModule('../../services/routingService.js', () => ({
  default: { computeSafeRoute: jest.fn() },
  routingService: { computeSafeRoute: jest.fn() },
}));

jest.unstable_mockModule('../../services/notificationService.js', () => ({
  default: { enqueueEmergencyAlert: jest.fn() },
  notificationService: { enqueueEmergencyAlert: jest.fn() },
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  config: { maxDriverDistanceKm: 25 },
}));

jest.unstable_mockModule('../../config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('DriverMatchingService', () => {
  let service: DriverMatchingService;

  beforeEach(() => {
    service = new DriverMatchingService();
    jest.clearAllMocks();
  });

  describe('calculateDistance', () => {
    it('should return distance in km between two valid points', () => {
      const a = { lat: 13.0827, lon: 80.2707 };
      const b = { lat: 13.0850, lon: 80.2101 };
      const dist = service.calculateDistance(a, b);
      expect(dist).toBeGreaterThan(5);
      expect(dist).toBeLessThan(10);
    });

    it('should return 0 for same point', () => {
      const p = { lat: 13.0827, lon: 80.2707 };
      const dist = service.calculateDistance(p, p);
      expect(dist).toBe(0);
    });

    it('should handle pole coordinates', () => {
      const a = { lat: 0, lon: 0 };
      const b = { lat: 0, lon: 1 };
      const dist = service.calculateDistance(a, b);
      expect(dist).toBeGreaterThan(100); // ~111km
    });
  });

  describe('calculateDriverScore', () => {
    it('should return value between 0 and 1', () => {
      const score = service.calculateDriverScore(5, 4.0, 0.8, 25);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should give higher score to closer drivers', () => {
      const close = service.calculateDriverScore(2, 4.0, 0.8, 25);
      const far = service.calculateDriverScore(20, 4.0, 0.8, 25);
      expect(close).toBeGreaterThan(far);
    });

    it('should give higher score to higher rated drivers', () => {
      const high = service.calculateDriverScore(5, 5.0, 0.8, 25);
      const low = service.calculateDriverScore(5, 2.0, 0.8, 25);
      expect(high).toBeGreaterThan(low);
    });

    it('should give higher score to better completion rate', () => {
      const good = service.calculateDriverScore(5, 4.0, 1.0, 25);
      const bad = service.calculateDriverScore(5, 4.0, 0.2, 25);
      expect(good).toBeGreaterThan(bad);
    });

    it('should return 0.1 (availability bonus) at max distance with 0 rating', () => {
      const score = service.calculateDriverScore(25, 0, 0, 25);
      expect(score).toBeCloseTo(0.1, 1);
    });

    it('should handle zero distance (perfect proximity)', () => {
      const score = service.calculateDriverScore(0, 5.0, 1.0, 25);
      // 0.4 (dist) + 0.3 (rating) + 0.2 (completion) + 0.1 (bonus) = 1.0
      expect(score).toBeCloseTo(1.0, 1);
    });
  });

  describe('findBestDriver', () => {
    it('should return null if no drivers available', async () => {
      const Driver = (await import('../../models/Driver.js')).default;
      (Driver.find as any).mockReturnValue({
        populate: jest.fn().mockResolvedValue([]),
      });

      const result = await service.findBestDriver({ lat: 13.08, lon: 80.27 }, 'flood');
      expect(result).toBeNull();
    });

    it('should rank closer driver higher', async () => {
      const Driver = (await import('../../models/Driver.js')).default;
      (Driver.find as any).mockReturnValue({
        populate: jest.fn().mockResolvedValue([
          { _id: { toString: () => 'd1' }, currentLat: 13.081, currentLon: 80.271, rating: 4, totalJobs: 10, completedJobs: 9 },
          { _id: { toString: () => 'd2' }, currentLat: 13.20, currentLon: 80.40, rating: 4, totalJobs: 10, completedJobs: 9 },
        ]),
      });

      const result = await service.findBestDriver({ lat: 13.08, lon: 80.27 }, 'flood');
      expect(result).not.toBeNull();
      expect(result!.driverId).toBe('d1');
    });
  });
});
