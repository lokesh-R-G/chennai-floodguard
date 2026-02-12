import Driver, { DriverStatus } from '../models/Driver.js';
import Incident from '../models/Incident.js';
import routingService from './routingService.js';
import notificationService from './notificationService.js';
import logger from '../config/logger.js';
import { getDistance } from 'geolib';

interface Location {
  lat: number;
  lon: number;
}

interface DriverScore {
  driverId: string;
  driver: any;
  score: number;
  distance: number;
  rating: number;
  completionRate: number;
}

export class DriverMatchingService {
  /**
   * Find and assign the best available driver to an incident
   */
  async findAndAssignDriver(incidentId: string): Promise<boolean> {
    try {
      const incident = await Incident.findById(incidentId);
      
      if (!incident) {
        throw new Error('Incident not found');
      }

      if (incident.status !== 'pending') {
        logger.warn(`Incident ${incidentId} is not pending, skip assignment`);
        return false;
      }

      const incidentLocation = {
        lat: incident.locationLat,
        lon: incident.locationLon
      };

      // Find best driver
      const bestDriver = await this.findBestDriver(incidentLocation, incident.emergencyType);

      if (!bestDriver) {
        logger.warn(`No available driver found for incident ${incidentId}`);
        return false;
      }

      // Compute safe route
      const driverLocation = {
        lat: bestDriver.driver.currentLat,
        lon: bestDriver.driver.currentLon
      };

      const safeRoute = await routingService.computeSafeRoute(
        driverLocation,
        incidentLocation
      );

      // Assign driver to incident
      incident.assignedDriverId = bestDriver.driverId as any;
      incident.status = 'assigned';
      incident.safeRoute = safeRoute;
      incident.assignedAt = new Date();
      await incident.save();

      // Update driver status
      await Driver.findByIdAndUpdate(bestDriver.driverId, {
        status: DriverStatus.BUSY
      });

      // Send notifications
      await notificationService.sendEmergencyAlert(
        bestDriver.driverId,
        incidentId,
        incident.emergencyType
      );

      logger.info(`Driver ${bestDriver.driverId} assigned to incident ${incidentId}`);
      return true;

    } catch (error) {
      logger.error('Error in driver assignment:', error);
      return false;
    }
  }

  /**
   * Find best available driver using intelligent matching algorithm
   */
  async findBestDriver(location: Location, emergencyType: string): Promise<DriverScore | null> {
    const maxDistanceKm = parseFloat(process.env.MAX_DRIVER_DISTANCE_KM || '10');

    // Get all available drivers with their details
    const drivers = await Driver.find({
      status: DriverStatus.AVAILABLE,
      currentLat: { $exists: true },
      currentLon: { $exists: true }
    }).populate('vehicleId userId');

    if (drivers.length === 0) {
      return null;
    }

    // Score each driver
    const scoredDrivers: DriverScore[] = [];

    for (const driver of drivers) {
      // Calculate distance
      const distance = this.calculateDistance(
        location,
        { lat: driver.currentLat!, lon: driver.currentLon! }
      );

      // Skip if too far
      if (distance > maxDistanceKm) {
        continue;
      }

      // Calculate completion rate
      const completionRate = driver.totalJobs > 0
        ? driver.completedJobs / driver.totalJobs
        : 1.0;

      // Calculate composite score
      const score = this.calculateDriverScore(
        distance,
        driver.rating,
        completionRate,
        maxDistanceKm
      );

      scoredDrivers.push({
        driverId: driver._id.toString(),
        driver,
        score,
        distance,
        rating: driver.rating,
        completionRate
      });
    }

    // Sort by score (higher is better)
    scoredDrivers.sort((a, b) => b.score - a.score);

    logger.debug(`Found ${scoredDrivers.length} suitable drivers`, {
      topDriver: scoredDrivers[0] ? {
        id: scoredDrivers[0].driverId,
        score: scoredDrivers[0].score,
        distance: scoredDrivers[0].distance
      } : null
    });

    return scoredDrivers[0] || null;
  }

  /**
   * Calculate driver matching score
   * Factors: distance (40%), rating (30%), completion rate (20%), availability (10%)
   */
  private calculateDriverScore(
    distance: number,
    rating: number,
    completionRate: number,
    maxDistance: number
  ): number {
    // Distance score (closer is better, normalized 0-1)
    const distanceScore = 1 - (distance / maxDistance);

    // Rating score (normalized 0-1)
    const ratingScore = rating / 5.0;

    // Completion rate score (already 0-1)
    const completionScore = completionRate;

    // Weighted composite score
    const compositeScore =
      distanceScore * 0.4 +
      ratingScore * 0.3 +
      completionScore * 0.2 +
      0.1; // Availability bonus (10%)

    return compositeScore;
  }

  /**
   * Calculate distance between two points in km
   */
  private calculateDistance(point1: Location, point2: Location): number {
    return getDistance(
      { latitude: point1.lat, longitude: point1.lon },
      { latitude: point2.lat, longitude: point2.lon }
    ) / 1000; // Convert to km
  }

  /**
   * Auto-assign drivers to all pending incidents
   */
  async autoAssignPendingIncidents(): Promise<void> {
    try {
      const pendingIncidents = await Incident.find({ status: 'pending' });

      logger.info(`Auto-assigning ${pendingIncidents.length} pending incidents`);

      for (const incident of pendingIncidents) {
        await this.findAndAssignDriver(incident._id.toString());
        // Small delay to avoid race conditions
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (error) {
      logger.error('Error in auto-assignment:', error);
    }
  }

  /**
   * Get available drivers count within range
   */
  async getAvailableDriversCount(location: Location, maxDistanceKm: number = 10): Promise<number> {
    const drivers = await Driver.find({
      status: DriverStatus.AVAILABLE,
      currentLat: { $exists: true },
      currentLon: { $exists: true }
    });

    let count = 0;
    for (const driver of drivers) {
      const distance = this.calculateDistance(
        location,
        { lat: driver.currentLat!, lon: driver.currentLon! }
      );
      if (distance <= maxDistanceKm) {
        count++;
      }
    }

    return count;
  }
}

export default new DriverMatchingService();
