import axios from 'axios';
import { getDistance } from 'geolib';
import FloodZone from '../models/FloodZone.js';
import { config } from '../config/env.js';
import logger from '../config/logger.js';

export interface Location {
  lat: number;
  lon: number;
}

export interface RouteWaypoint {
  lat: number;
  lon: number;
}

export interface SafeRoute {
  waypoints: RouteWaypoint[];
  totalDistance: number;   // km
  avgRiskScore: number;
  estimatedTime: number;  // minutes
}

export class RoutingService {
  private osrmURL: string;

  constructor() {
    this.osrmURL = config.osrmUrl;
  }

  /**
   * Primary entry point: get a safe route from start→end that avoids flood zones.
   * Pipeline: OSRM raw route → risk analysis → alternative if too risky → Dijkstra fallback.
   */
  async computeSafeRoute(start: Location, end: Location): Promise<SafeRoute> {
    const zones = await FloodZone.find();

    // 1. Try OSRM first
    try {
      const roadWps = await this.getOSRMRoute(start, end);
      const analyzed = this.analyzeRouteRisk(roadWps, zones);

      if (analyzed.avgRiskScore <= 7) return analyzed;

      // 2. If too risky, try alternative with mid-waypoint
      logger.info('Primary route too risky, trying alternative');
      const alt = await this.findAlternativeRoute(start, end, zones);
      if (alt && alt.avgRiskScore < analyzed.avgRiskScore) return alt;

      return analyzed; // return best available
    } catch {
      // 3. Dijkstra zone-based fallback
      logger.warn('OSRM unavailable, using Dijkstra zone-based fallback');
      return this.dijkstraFallback(start, end, zones);
    }
  }

  /* ── OSRM ──────────────────────────────────── */

  private async getOSRMRoute(start: Location, end: Location): Promise<RouteWaypoint[]> {
    const url = `${this.osrmURL}/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}`;
    const response = await axios.get(url, {
      params: { overview: 'full', geometries: 'geojson', steps: true },
      timeout: 8000,
    });

    if (response.data.code !== 'Ok' || !response.data.routes[0]) {
      throw new Error('OSRM returned no valid route');
    }

    return response.data.routes[0].geometry.coordinates.map((c: number[]) => ({
      lon: c[0],
      lat: c[1],
    }));
  }

  /* ── Risk analysis ─────────────────────────── */

  analyzeRouteRisk(waypoints: RouteWaypoint[], zones: any[]): SafeRoute {
    let totalRisk = 0;
    let riskPoints = 0;
    let totalDistance = 0;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const p = waypoints[i];
      const np = waypoints[i + 1];

      const seg = getDistance(
        { latitude: p.lat, longitude: p.lon },
        { latitude: np.lat, longitude: np.lon },
      );
      totalDistance += seg;

      const nearest = this.findNearestZone(p, zones);
      if (nearest && nearest.distance < 1000) {
        totalRisk += nearest.zone.currentRiskScore;
        riskPoints++;
      }
    }

    const avgRisk = riskPoints > 0 ? totalRisk / riskPoints : 0;
    const distKm = totalDistance / 1000;
    const estMin = distKm * 5; // ~12 km/h emergency avg

    return { waypoints, totalDistance: distKm, avgRiskScore: avgRisk, estimatedTime: estMin };
  }

  findNearestZone(point: Location, zones: any[]): { zone: any; distance: number } | null {
    let nearest: any = null;
    let min = Infinity;

    for (const z of zones) {
      const d = getDistance(
        { latitude: point.lat, longitude: point.lon },
        { latitude: z.centerLat, longitude: z.centerLon },
      );
      if (d < min) {
        min = d;
        nearest = z;
      }
    }
    return nearest ? { zone: nearest, distance: min } : null;
  }

  /* ── Alternative route via safe mid-waypoint ── */

  private async findAlternativeRoute(
    start: Location,
    end: Location,
    zones: any[],
  ): Promise<SafeRoute | null> {
    try {
      const highRisk = zones.filter((z) => z.currentRiskScore > 7);
      if (highRisk.length === 0) return null;

      const mid = this.calculateSafeMidpoint(start, end, highRisk);
      const r1 = await this.getOSRMRoute(start, mid);
      const r2 = await this.getOSRMRoute(mid, end);
      return this.analyzeRouteRisk([...r1, ...r2], zones);
    } catch {
      return null;
    }
  }

  private calculateSafeMidpoint(start: Location, end: Location, hrz: any[]): Location {
    let midLat = (start.lat + end.lat) / 2;
    let midLon = (start.lon + end.lon) / 2;

    for (const z of hrz) {
      const d = getDistance(
        { latitude: midLat, longitude: midLon },
        { latitude: z.centerLat, longitude: z.centerLon },
      );
      if (d < 2000) {
        midLat += 0.02;
        midLon += 0.02;
        break;
      }
    }
    return { lat: midLat, lon: midLon };
  }

  /* ── Dijkstra zone-based fallback ──────────── */

  dijkstraFallback(start: Location, end: Location, zones: any[]): SafeRoute {
    // Build a simple weighted graph: start, each zone center, end
    const nodes: Location[] = [start, ...zones.map((z: any) => ({ lat: z.centerLat, lon: z.centerLon })), end];
    const n = nodes.length;
    const INF = Number.MAX_SAFE_INTEGER;

    // adjacency
    const dist: number[][] = Array.from({ length: n }, () => Array(n).fill(INF));
    for (let i = 0; i < n; i++) dist[i][i] = 0;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const d = getDistance(
          { latitude: nodes[i].lat, longitude: nodes[i].lon },
          { latitude: nodes[j].lat, longitude: nodes[j].lon },
        );
        if (d > 15000) continue; // skip edges > 15km
        const risk = j > 0 && j < n - 1 ? zones[j - 1].currentRiskScore : 0;
        const weight = d * (1 + risk / 5);
        dist[i][j] = weight;
        dist[j][i] = weight;
      }
    }

    // Dijkstra from node 0 (start) → node n-1 (end)
    const visited = new Array(n).fill(false);
    const shortest = new Array(n).fill(INF);
    const prev = new Array(n).fill(-1);
    shortest[0] = 0;

    for (let round = 0; round < n; round++) {
      let u = -1;
      let best = INF;
      for (let i = 0; i < n; i++) {
        if (!visited[i] && shortest[i] < best) {
          best = shortest[i];
          u = i;
        }
      }
      if (u === -1) break;
      visited[u] = true;
      for (let v = 0; v < n; v++) {
        if (!visited[v] && dist[u][v] < INF) {
          const nd = shortest[u] + dist[u][v];
          if (nd < shortest[v]) {
            shortest[v] = nd;
            prev[v] = u;
          }
        }
      }
    }

    // Reconstruct path
    const path: RouteWaypoint[] = [];
    let cur = n - 1;
    while (cur !== -1) {
      path.unshift(nodes[cur]);
      cur = prev[cur];
    }
    if (path.length === 0) path.push(start, end);

    // Compute metrics
    let totalDist = 0;
    let totalRisk = 0;
    let riskPts = 0;
    for (let i = 0; i < path.length - 1; i++) {
      totalDist += getDistance(
        { latitude: path[i].lat, longitude: path[i].lon },
        { latitude: path[i + 1].lat, longitude: path[i + 1].lon },
      );
      const nz = this.findNearestZone(path[i], zones);
      if (nz && nz.distance < 2000) {
        totalRisk += nz.zone.currentRiskScore;
        riskPts++;
      }
    }

    const km = totalDist / 1000;
    return {
      waypoints: path,
      totalDistance: km,
      avgRiskScore: riskPts > 0 ? totalRisk / riskPts : 0,
      estimatedTime: km * 5,
    };
  }
}

export const routingService = new RoutingService();
export default routingService;
