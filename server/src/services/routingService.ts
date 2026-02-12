import axios from 'axios';
import { getDistance, findNearest } from 'geolib';
import FloodZone from '../models/FloodZone.js';
import logger from '../config/logger.js';

interface Location {
  lat: number;
  lon: number;
}

interface RouteWaypoint {
  lat: number;
  lon: number;
}

interface SafeRoute {
  waypoints: RouteWaypoint[];
  totalDistance: number;
  avgRiskScore: number;
  estimatedTime: number;
}

export class RoutingService {
  private osrmURL: string;

  constructor() {
    this.osrmURL = process.env.OSRM_API_URL || 'http://router.project-osrm.org';
  }

  /**
   * Compute safe route considering flood zones and road network
   */
  async computeSafeRoute(
    start: Location,
    end: Location
  ): Promise<SafeRoute> {
    try {
      // Get all flood zones
      const zones = await FloodZone.find();

      // Step 1: Get actual road route from OSRM
      const roadRoute = await this.getOSRMRoute(start, end);

      // Step 2: Analyze route through flood zones
      const analyzedRoute = this.analyzeRouteRisk(roadRoute, zones);

      // Step 3: If route is too risky, try alternative routes
      if (analyzedRoute.avgRiskScore > 7) {
        logger.info('Primary route too risky, searching for alternatives...');
        const alternativeRoute = await this.findAlternativeRoute(start, end, zones);
        if (alternativeRoute && alternativeRoute.avgRiskScore < analyzedRoute.avgRiskScore) {
          return alternativeRoute;
        }
      }

      return analyzedRoute;

    } catch (error) {
      logger.error('Error computing safe route:', error);
      // Fallback to simple zone-based routing
      return this.fallbackZoneBasedRoute(start, end);
    }
  }

  /**
   * Get actual road route from OSRM (OpenStreetMap Routing Machine)
   */
  private async getOSRMRoute(start: Location, end: Location): Promise<RouteWaypoint[]> {
    try {
      const url = `${this.osrmURL}/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}`;
      const response = await axios.get(url, {
        params: {
          overview: 'full',
          geometries: 'geojson',
          steps: true
        },
        timeout: 5000
      });

      if (response.data.code !== 'Ok' || !response.data.routes[0]) {
        throw new Error('OSRM routing failed');
      }

      // Extract waypoints from route geometry
      const coordinates = response.data.routes[0].geometry.coordinates;
      return coordinates.map((coord: number[]) => ({
        lon: coord[0],
        lat: coord[1]
      }));

    } catch (error) {
      logger.warn('OSRM API call failed:', error);
      throw error;
    }
  }

  /**
   * Analyze route risk based on flood zones
   */
  private analyzeRouteRisk(waypoints: RouteWaypoint[], zones: any[]): SafeRoute {
    let totalRisk = 0;
    let riskPoints = 0;
    let totalDistance = 0;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const point = waypoints[i];
      const nextPoint = waypoints[i + 1];

      // Calculate segment distance
      const segmentDistance = getDistance(
        { latitude: point.lat, longitude: point.lon },
        { latitude: nextPoint.lat, longitude: nextPoint.lon }
      );
      totalDistance += segmentDistance;

      // Find nearest flood zone
      const nearestZone = this.findNearestZone(point, zones);
      if (nearestZone && nearestZone.distance < 1000) { // Within 1km
        totalRisk += nearestZone.zone.currentRiskScore;
        riskPoints++;
      }
    }

    const avgRiskScore = riskPoints > 0 ? totalRisk / riskPoints : 0;
    const estimatedTime = (totalDistance / 1000) * 5; // Rough estimate: 5 min per km in emergency

    return {
      waypoints,
      totalDistance: totalDistance / 1000, // Convert to km
      avgRiskScore,
      estimatedTime
    };
  }

  /**
   * Find nearest flood zone to a point
   */
  private findNearestZone(point: Location, zones: any[]): { zone: any; distance: number } | null {
    let nearest = null;
    let minDistance = Infinity;

    for (const zone of zones) {
      const distance = getDistance(
        { latitude: point.lat, longitude: point.lon },
        { latitude: zone.centerLat, longitude: zone.centerLon }
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearest = zone;
      }
    }

    return nearest ? { zone: nearest, distance: minDistance } : null;
  }

  /**
   * Find alternative route by avoiding high-risk zones
   */
  private async findAlternativeRoute(
    start: Location,
    end: Location,
    zones: any[]
  ): Promise<SafeRoute | null> {
    try {
      // Get high-risk zones (score > 7)
      const highRiskZones = zones.filter(z => z.currentRiskScore > 7);

      if (highRiskZones.length === 0) {
        return null;
      }

      // Use OSRM with waypoints to avoid high-risk areas
      // Add intermediate waypoint away from high-risk zones
      const midPoint = this.calculateSafeMidpoint(start, end, highRiskZones);

      const route1 = await this.getOSRMRoute(start, midPoint);
      const route2 = await this.getOSRMRoute(midPoint, end);

      const combinedRoute = [...route1, ...route2];
      return this.analyzeRouteRisk(combinedRoute, zones);

    } catch (error) {
      logger.error('Error finding alternative route:', error);
      return null;
    }
  }

  /**
   * Calculate a safe midpoint between start and end, avoiding high-risk zones
   */
  private calculateSafeMidpoint(
    start: Location,
    end: Location,
    highRiskZones: any[]
  ): Location {
    const midLat = (start.lat + end.lat) / 2;
    const midLon = (start.lon + end.lon) / 2;

    // Check if midpoint is in high-risk zone
    let safeMid = { lat: midLat, lon: midLon };
    
    for (const zone of highRiskZones) {
      const distance = getDistance(
        { latitude: safeMid.lat, longitude: safeMid.lon },
        { latitude: zone.centerLat, longitude: zone.centerLon }
      );

      if (distance < 2000) { // Within 2km of high-risk zone
        // Offset midpoint perpendicular to direct line
        const offset = 0.02; // ~2km offset
        safeMid = {
          lat: midLat + offset,
          lon: midLon + offset
        };
        break;
      }
    }

    return safeMid;
  }

  /**
   * Fallback to simple zone-based routing if OSRM fails
   */
  private async fallbackZoneBasedRoute(start: Location, end: Location): Promise<SafeRoute> {
    logger.info('Using fallback zone-based routing');

    const zones = await FloodZone.find().sort({ currentRiskScore: 1 });

    // Create simple waypoints through low-risk zones
    const waypoints: RouteWaypoint[] = [
      { lat: start.lat, lon: start.lon }
    ];

    // Add intermediate waypoints through safer zones if needed
    const distance = getDistance(
      { latitude: start.lat, longitude: start.lon },
      { latitude: end.lat, longitude: end.lon }
    );

    if (distance > 5000) { // > 5km, add intermediate point
      const lowRiskZones = zones.filter(z => z.currentRiskScore < 6);
      if (lowRiskZones.length > 0) {
        const intermediateZone = lowRiskZones[0];
        waypoints.push({
          lat: intermediateZone.centerLat,
          lon: intermediateZone.centerLon
        });
      }
    }

    waypoints.push({ lat: end.lat, lon: end.lon });

    // Calculate total distance and average risk
    let totalDistance = 0;
    let totalRisk = 0;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const segmentDistance = getDistance(
        { latitude: waypoints[i].lat, longitude: waypoints[i].lon },
        { latitude: waypoints[i + 1].lat, longitude: waypoints[i + 1].lon }
      );
      totalDistance += segmentDistance;

      // Find nearest zone
      const nearestZone = this.findNearestZone(waypoints[i], zones);
      if (nearestZone) {
        totalRisk += nearestZone.zone.currentRiskScore;
      }
    }

    return {
      waypoints,
      totalDistance: totalDistance / 1000,
      avgRiskScore: totalRisk / (waypoints.length - 1),
      estimatedTime: (totalDistance / 1000) * 5
    };
  }

  /**
   * Get distance between two points in km
   */
  getDistanceKm(point1: Location, point2: Location): number {
    return getDistance(
      { latitude: point1.lat, longitude: point1.lon },
      { latitude: point2.lat, longitude: point2.lon }
    ) / 1000;
  }
}

export default new RoutingService();
