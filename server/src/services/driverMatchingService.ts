import Driver, { DriverStatus } from '../models/Driver.js';
import Incident, { IncidentStatus } from '../models/Incident.js';
import routingService from './routingService.js';
import notificationService from './notificationService.js';
import { config } from '../config/env.js';
import logger from '../config/logger.js';
import { getDistance } from 'geolib';

export interface Location {
  lat: number;
  lon: number;
}

export interface DriverScore {
  driverId: string;
  driver: any;
  score: number;
  distance: number;
  rating: number;
  completionRate: number;
}

export class DriverMatchingService {
  /**
   * Find and assign the best driver to a pending incident.
   */
  async findAndAssignDriver(incidentId: string): Promise<boolean> {
    const incident = await Incident.findById(incidentId);
    if (!incident) throw new Error('Incident not found');
    if (incident.status !== IncidentStatus.PENDING) {
      logger.warn(`Incident ${incidentId} not pending, skipping`);
      return false;
    }

    const incidentLoc: Location = { lat: incident.locationLat, lon: incident.locationLon };
    const bestDriver = await this.findBestDriver(incidentLoc, incident.emergencyType);

    if (!bestDriver) {
      logger.warn(`No driver available for incident ${incidentId}`);
      return false;
    }

    // Compute safe route
    const driverLoc: Location = {
      lat: bestDriver.driver.currentLat,
      lon: bestDriver.driver.currentLon,
    };
    const safeRoute = await routingService.computeSafeRoute(driverLoc, incidentLoc);

    // Assign
    incident.assignedDriverId = bestDriver.driverId as any;
    incident.status = IncidentStatus.ASSIGNED;
    incident.safeRoute = safeRoute;
    incident.assignedAt = new Date();
    await incident.save();

    await Driver.findByIdAndUpdate(bestDriver.driverId, { status: DriverStatus.BUSY });

    // Notification (enqueued, non-blocking)
    await notificationService.enqueueEmergencyAlert(
      bestDriver.driverId,
      incidentId,
      incident.emergencyType,
    );

    logger.info(`Driver ${bestDriver.driverId} assigned to ${incidentId} (score=${bestDriver.score.toFixed(3)})`);
    return true;
  }

  /**
   * Score & rank all available drivers within radius.
   */
  async findBestDriver(location: Location, emergencyType: string): Promise<DriverScore | null> {
    const maxDist = config.maxDriverDistanceKm;

    const drivers = await Driver.find({
      status: DriverStatus.AVAILABLE,
      currentLat: { $exists: true, $ne: null },
      currentLon: { $exists: true, $ne: null },
    }).populate('vehicleId userId');

    if (drivers.length === 0) return null;

    const scored: DriverScore[] = [];

    for (const d of drivers) {
      const dist = this.calculateDistance(location, { lat: d.currentLat!, lon: d.currentLon! });
      if (dist > maxDist) continue;

      const completionRate = d.totalJobs > 0 ? d.completedJobs / d.totalJobs : 1.0;
      const score = this.calculateDriverScore(dist, d.rating, completionRate, maxDist);

      scored.push({
        driverId: d._id.toString(),
        driver: d,
        score,
        distance: dist,
        rating: d.rating,
        completionRate,
      });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored[0] ?? null;
  }

  /**
   * Weighted composite score.
   * Distance 40%, Rating 30%, Completion 20%, Availability bonus 10%.
   */
  calculateDriverScore(
    distance: number,
    rating: number,
    completionRate: number,
    maxDistance: number,
  ): number {
    const distScore = Math.max(0, 1 - distance / maxDistance);
    const ratingScore = rating / 5.0;
    const completionScore = completionRate;

    return distScore * 0.4 + ratingScore * 0.3 + completionScore * 0.2 + 0.1;
  }

  /**
   * Haversine distance in km.
   */
  calculateDistance(a: Location, b: Location): number {
    return (
      getDistance(
        { latitude: a.lat, longitude: a.lon },
        { latitude: b.lat, longitude: b.lon },
      ) / 1000
    );
  }

  /**
   * Auto-assign all pending incidents.
   */
  async autoAssignPendingIncidents(): Promise<number> {
    const pending = await Incident.find({ status: IncidentStatus.PENDING }).sort({ priority: -1 });
    let assigned = 0;
    for (const inc of pending) {
      const ok = await this.findAndAssignDriver(inc._id.toString());
      if (ok) assigned++;
    }
    logger.info(`Auto-assign: ${assigned}/${pending.length} pending incidents assigned`);
    return assigned;
  }
}

export const driverMatchingService = new DriverMatchingService();
export default driverMatchingService;
