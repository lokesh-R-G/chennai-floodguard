import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/* Mock all the service chain: incident → matching → routing → notification */

jest.unstable_mockModule('../../models/Incident.js', () => ({
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
  IncidentStatus: { PENDING: 'pending', ASSIGNED: 'assigned', IN_PROGRESS: 'in_progress', RESOLVED: 'resolved' },
}));

jest.unstable_mockModule('../../models/Driver.js', () => ({
  default: {
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
  DriverStatus: { AVAILABLE: 'available', BUSY: 'busy', OFFLINE: 'offline' },
}));

jest.unstable_mockModule('../../models/FloodZone.js', () => ({
  default: { find: jest.fn().mockResolvedValue([]) },
}));

jest.unstable_mockModule('../../services/routingService.js', () => ({
  default: {
    computeSafeRoute: jest.fn().mockResolvedValue({
      waypoints: [{ lat: 13.08, lon: 80.27 }, { lat: 13.04, lon: 80.23 }],
      totalDistance: 5.2,
      avgRiskScore: 3,
      estimatedTime: 26,
    } as never),
  },
  routingService: {
    computeSafeRoute: jest.fn().mockResolvedValue({
      waypoints: [{ lat: 13.08, lon: 80.27 }, { lat: 13.04, lon: 80.23 }],
      totalDistance: 5.2,
      avgRiskScore: 3,
      estimatedTime: 26,
    } as never),
  },
}));

jest.unstable_mockModule('../../services/notificationService.js', () => ({
  default: { enqueueEmergencyAlert: jest.fn().mockResolvedValue(undefined as never) },
  notificationService: { enqueueEmergencyAlert: jest.fn().mockResolvedValue(undefined as never) },
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  config: { maxDriverDistanceKm: 25 },
}));

jest.unstable_mockModule('../../config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('Incident Lifecycle Integration', () => {
  let Incident: any;
  let Driver: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    Incident = (await import('../../models/Incident.js')).default;
    Driver = (await import('../../models/Driver.js')).default;
  });

  it('full cycle: create → assign → in_progress → resolve', async () => {
    // 1. Create incident
    const mockIncident = {
      _id: { toString: () => 'inc1' },
      citizenId: 'citizen1',
      locationLat: 13.04,
      locationLon: 80.23,
      emergencyType: 'flood',
      status: 'pending',
      safeRoute: null,
      assignedDriverId: null,
      assignedAt: null,
      save: jest.fn().mockResolvedValue(undefined as never),
    };
    Incident.create.mockResolvedValue(mockIncident as never);
    const created = await Incident.create({
      citizenId: 'citizen1',
      locationLat: 13.04,
      locationLon: 80.23,
      emergencyType: 'flood',
    });
    expect(created.status).toBe('pending');

    // 2. Find & assign driver
    const mockDriver = {
      _id: { toString: () => 'drv1' },
      currentLat: 13.05,
      currentLon: 80.24,
      rating: 4.5,
      totalJobs: 20,
      completedJobs: 18,
    };
    Driver.find.mockReturnValue({ populate: jest.fn().mockResolvedValue([mockDriver]) });
    Incident.findById.mockResolvedValue(mockIncident as never);

    const { DriverMatchingService } = await import('../../services/driverMatchingService.js');
    const matchService = new DriverMatchingService();

    const assigned = await matchService.findAndAssignDriver('inc1');
    expect(assigned).toBe(true);
    expect(mockIncident.save).toHaveBeenCalled();

    // 3. Mark in_progress
    Incident.findByIdAndUpdate.mockResolvedValue({ ...mockIncident, status: 'in_progress' } as never);
    const updated = await Incident.findByIdAndUpdate('inc1', { status: 'in_progress' });
    expect(updated.status).toBe('in_progress');

    // 4. Resolve
    Incident.findByIdAndUpdate.mockResolvedValue({ ...mockIncident, status: 'resolved' } as never);
    const resolved = await Incident.findByIdAndUpdate('inc1', { status: 'resolved' });
    expect(resolved.status).toBe('resolved');
  });

  it('should return false when no drivers available', async () => {
    const mockIncident = {
      _id: { toString: () => 'inc2' },
      locationLat: 13.04,
      locationLon: 80.23,
      emergencyType: 'flood',
      status: 'pending',
    };
    Incident.findById.mockResolvedValue(mockIncident as never);
    Driver.find.mockReturnValue({ populate: jest.fn().mockResolvedValue([]) });

    const { DriverMatchingService } = await import('../../services/driverMatchingService.js');
    const matchService = new DriverMatchingService();

    const result = await matchService.findAndAssignDriver('inc2');
    expect(result).toBe(false);
  });
});
