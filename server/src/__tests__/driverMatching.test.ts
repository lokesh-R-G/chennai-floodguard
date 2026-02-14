import { describe, it, expect } from '@jest/globals';
import { DriverMatchingService } from '../../services/driverMatchingService.js';

// Keep backward-compat test file — main tests in driverMatchingService.test.ts
describe('Driver Matching (compat)', () => {
  const service = new DriverMatchingService();

  it('should calculate distance correctly', () => {
    const point1 = { lat: 13.0827, lon: 80.2707 };
    const point2 = { lat: 13.0850, lon: 80.2101 };
    
    const distance = service.calculateDistance(point1, point2);
    
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(10);
  });

  it('should calculate driver score correctly', () => {
    const score = service.calculateDriverScore(2, 4.5, 0.9, 10);
    
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
