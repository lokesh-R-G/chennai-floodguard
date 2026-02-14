import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { MLPipelineService } from '../../services/mlPipelineService.js';

// Mock dependencies
jest.unstable_mockModule('../../models/FloodZone.js', () => ({
  default: {
    find: jest.fn(),
    countDocuments: jest.fn(),
    insertMany: jest.fn(),
  },
}));

jest.unstable_mockModule('../../services/weatherService.js', () => ({
  default: {
    getCurrentWeather: jest.fn(),
    getForecast: jest.fn(),
  },
  weatherService: {
    getCurrentWeather: jest.fn(),
    getForecast: jest.fn(),
  },
}));

jest.unstable_mockModule('../../services/driverMatchingService.js', () => ({
  default: { autoAssignPendingIncidents: jest.fn() },
  driverMatchingService: { autoAssignPendingIncidents: jest.fn() },
}));

jest.unstable_mockModule('../../config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('MLPipelineService', () => {
  let service: MLPipelineService;

  beforeEach(() => {
    service = new MLPipelineService();
    jest.clearAllMocks();
  });

  describe('computeRiskScore', () => {
    it('should return 0 for no rainfall and no flood depth', () => {
      const s = service.computeRiskScore(0, 0, 10, 50, 30);
      expect(s).toBe(0);
    });

    it('should return max 10 for extreme conditions', () => {
      const s = service.computeRiskScore(200, 20, 60, 95, 15);
      expect(s).toBe(10);
    });

    it('should increase with rainfall', () => {
      const low = service.computeRiskScore(10, 2, 10, 50, 30);
      const high = service.computeRiskScore(80, 2, 10, 50, 30);
      expect(high).toBeGreaterThan(low);
    });

    it('should increase with flood depth', () => {
      const shallow = service.computeRiskScore(30, 1, 10, 50, 30);
      const deep = service.computeRiskScore(30, 8, 10, 50, 30);
      expect(deep).toBeGreaterThan(shallow);
    });

    it('should apply wind multiplier above 40 km/h', () => {
      const calm = service.computeRiskScore(50, 5, 30, 50, 30);
      const windy = service.computeRiskScore(50, 5, 50, 50, 30);
      expect(windy).toBeGreaterThan(calm);
    });

    it('should apply humidity multiplier above 85%', () => {
      const dry = service.computeRiskScore(50, 5, 10, 60, 30);
      const humid = service.computeRiskScore(50, 5, 10, 90, 30);
      expect(humid).toBeGreaterThan(dry);
    });

    it('should apply cold temperature multiplier below 20°C', () => {
      const warm = service.computeRiskScore(50, 5, 10, 50, 30);
      const cold = service.computeRiskScore(50, 5, 10, 50, 15);
      expect(cold).toBeGreaterThan(warm);
    });

    it('should never return negative', () => {
      const s = service.computeRiskScore(0, 0, 0, 0, 40);
      expect(s).toBeGreaterThanOrEqual(0);
    });

    it('should clamp to 10 max', () => {
      const s = service.computeRiskScore(500, 50, 100, 100, 0);
      expect(s).toBeLessThanOrEqual(10);
    });
  });

  describe('initializeFloodZones', () => {
    it('should skip if zones already exist', async () => {
      const FloodZone = (await import('../../models/FloodZone.js')).default;
      (FloodZone.countDocuments as jest.Mock).mockResolvedValue(12 as never);

      await service.initializeFloodZones();
      expect(FloodZone.insertMany).not.toHaveBeenCalled();
    });

    it('should seed zones when collection is empty', async () => {
      const FloodZone = (await import('../../models/FloodZone.js')).default;
      (FloodZone.countDocuments as jest.Mock).mockResolvedValue(0 as never);
      (FloodZone.insertMany as jest.Mock).mockResolvedValue([] as never);

      await service.initializeFloodZones();
      expect(FloodZone.insertMany).toHaveBeenCalled();

      const arg = (FloodZone.insertMany as jest.Mock).mock.calls[0][0] as any[];
      expect(arg.length).toBe(12); // 12 Chennai zones
    });
  });

  describe('updateFloodZones', () => {
    it('should update zones with weather data', async () => {
      const FloodZone = (await import('../../models/FloodZone.js')).default;
      const weatherService = (await import('../../services/weatherService.js')).default;

      const mockZone = {
        centerLat: 13.04,
        centerLon: 80.23,
        avgFloodDepth: 3,
        currentRiskScore: 0,
        predictedRainfall: 0,
        historicalData: [],
        zoneName: 'T. Nagar',
        lastUpdated: new Date(),
        save: jest.fn().mockResolvedValue(undefined as never),
      };
      (FloodZone.find as jest.Mock).mockResolvedValue([mockZone] as never);

      (weatherService.getCurrentWeather as jest.Mock).mockResolvedValue({
        temperature: 28, humidity: 80, rainfall: 10, windSpeed: 15, pressure: 1010, timestamp: new Date(),
      } as never);

      (weatherService.getForecast as jest.Mock).mockResolvedValue({
        hourly: [
          { time: '2024-01-01T01:00', temperature: 28, precipitation: 5, humidity: 80 },
          { time: '2024-01-01T02:00', temperature: 27, precipitation: 8, humidity: 82 },
          { time: '2024-01-01T03:00', temperature: 26, precipitation: 3, humidity: 85 },
        ],
      } as never);

      const updated = await service.updateFloodZones();
      expect(updated).toBe(1);
      expect(mockZone.save).toHaveBeenCalled();
      expect(mockZone.currentRiskScore).toBeGreaterThan(0);
    });
  });
});
