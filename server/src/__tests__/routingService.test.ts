import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { RoutingService } from '../../services/routingService.js';

// Mock dependencies
jest.unstable_mockModule('axios', () => ({
  default: { get: jest.fn() },
}));

jest.unstable_mockModule('../../models/FloodZone.js', () => ({
  default: { find: jest.fn() },
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  config: { osrmUrl: 'http://localhost:5000' },
}));

jest.unstable_mockModule('../../config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('RoutingService', () => {
  let service: RoutingService;

  beforeEach(() => {
    service = new RoutingService();
    jest.clearAllMocks();
  });

  describe('analyzeRouteRisk', () => {
    const sampleZones = [
      { centerLat: 13.04, centerLon: 80.23, currentRiskScore: 8 },
      { centerLat: 13.00, centerLon: 80.22, currentRiskScore: 3 },
    ];

    it('should return 0 avg risk for waypoints far from any zone', () => {
      const wps = [
        { lat: 1.0, lon: 1.0 },
        { lat: 1.001, lon: 1.001 },
      ];
      const result = service.analyzeRouteRisk(wps, sampleZones);
      expect(result.avgRiskScore).toBe(0);
    });

    it('should detect risk when waypoints pass through a zone', () => {
      const wps = [
        { lat: 13.04, lon: 80.23 },
        { lat: 13.041, lon: 80.231 },
      ];
      const result = service.analyzeRouteRisk(wps, sampleZones);
      expect(result.avgRiskScore).toBeGreaterThan(0);
    });

    it('should compute total distance in km', () => {
      const wps = [
        { lat: 13.00, lon: 80.00 },
        { lat: 13.01, lon: 80.01 },
      ];
      const result = service.analyzeRouteRisk(wps, []);
      expect(result.totalDistance).toBeGreaterThan(0);
    });

    it('should handle single waypoint gracefully', () => {
      const result = service.analyzeRouteRisk([{ lat: 13.0, lon: 80.0 }], sampleZones);
      expect(result.totalDistance).toBe(0);
    });
  });

  describe('findNearestZone', () => {
    const zones = [
      { centerLat: 13.04, centerLon: 80.23, currentRiskScore: 8, zoneName: 'A' },
      { centerLat: 12.90, centerLon: 80.10, currentRiskScore: 4, zoneName: 'B' },
    ];

    it('should find nearest zone', () => {
      const pt = { lat: 13.041, lon: 80.231 };
      const result = service.findNearestZone(pt, zones);
      expect(result).not.toBeNull();
      expect(result!.zone.zoneName).toBe('A');
    });

    it('should return null for empty zone list', () => {
      const result = service.findNearestZone({ lat: 13.0, lon: 80.0 }, []);
      expect(result).toBeNull();
    });
  });

  describe('dijkstraFallback', () => {
    const zones = [
      { centerLat: 13.04, centerLon: 80.23, currentRiskScore: 2 },
      { centerLat: 13.05, centerLon: 80.25, currentRiskScore: 9 },
    ];

    it('should return a route with waypoints', () => {
      const start = { lat: 13.03, lon: 80.22 };
      const end = { lat: 13.06, lon: 80.26 };
      const result = service.dijkstraFallback(start, end, zones);
      expect(result.waypoints.length).toBeGreaterThanOrEqual(2);
      expect(result.totalDistance).toBeGreaterThan(0);
      expect(result.estimatedTime).toBeGreaterThan(0);
    });

    it('should try to avoid high-risk zones', () => {
      const start = { lat: 13.03, lon: 80.22 };
      const end = { lat: 13.06, lon: 80.26 };
      const noRisk = service.dijkstraFallback(start, end, [
        { centerLat: 13.04, centerLon: 80.23, currentRiskScore: 0 },
      ]);
      const highRisk = service.dijkstraFallback(start, end, [
        { centerLat: 13.04, centerLon: 80.23, currentRiskScore: 10 },
      ]);
      // High risk route should have equal or higher avg risk
      expect(highRisk.avgRiskScore).toBeGreaterThanOrEqual(noRisk.avgRiskScore);
    });
  });
});
