import FloodZone from '../models/FloodZone.js';
import weatherService from './weatherService.js';
import driverMatchingService from './driverMatchingService.js';
import logger from '../config/logger.js';

/**
 * Pure-logic ML pipeline — no cron, no child_process.
 * Called by the ML worker via Bull queue.
 */
export class MLPipelineService {
  /**
   * Main entry: update all (or selected) flood zones from live weather.
   */
  async updateFloodZones(zoneIds?: string[]): Promise<number> {
    const filter = zoneIds?.length ? { _id: { $in: zoneIds } } : {};
    const zones = await FloodZone.find(filter);
    let updated = 0;

    for (const zone of zones) {
      try {
        const weather = await weatherService.getCurrentWeather(zone.centerLat, zone.centerLon);
        const forecast = await weatherService.getForecast(zone.centerLat, zone.centerLon, 24);

        const predictedRainfall = forecast.hourly
          .slice(0, 3)
          .reduce((s, h) => s + h.precipitation, 0);

        const newRisk = this.computeRiskScore(
          predictedRainfall,
          zone.avgFloodDepth,
          weather.windSpeed,
          weather.humidity,
          weather.temperature,
        );

        // Push historical
        zone.historicalData.push({
          timestamp: new Date(),
          riskScore: newRisk,
          rainfall: weather.rainfall,
          floodDepth: zone.avgFloodDepth,
        });

        // Trim >30 days
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        zone.historicalData = zone.historicalData.filter((h) => h.timestamp >= cutoff);

        zone.currentRiskScore = newRisk;
        zone.predictedRainfall = predictedRainfall;
        zone.lastUpdated = new Date();
        await zone.save();

        updated++;
        logger.debug(`Zone ${zone.zoneName}: risk=${newRisk.toFixed(1)} rain=${predictedRainfall.toFixed(1)}mm`);
      } catch (err) {
        logger.error(`Failed to update zone ${zone.zoneName}:`, err);
      }
    }

    logger.info(`ML pipeline: ${updated}/${zones.length} zones updated`);
    return updated;
  }

  /**
   * Deterministic risk score formula — no static/hardcoded scores.
   */
  computeRiskScore(
    rainfall: number,
    floodDepth: number,
    windSpeed: number,
    humidity: number,
    temperature: number,
  ): number {
    const rainNorm = Math.min(rainfall / 100, 1);
    const depthNorm = Math.min(floodDepth / 10, 1);

    let score = (0.6 * rainNorm + 0.4 * depthNorm) * 10;

    // Environmental adjustments
    if (windSpeed > 40) score *= 1.10;
    if (humidity > 85) score *= 1.05;
    if (temperature < 20) score *= 1.03;

    return Math.min(Math.max(score, 0), 10);
  }

  /**
   * Seed Chennai zones if the collection is empty.
   */
  async initializeFloodZones(): Promise<void> {
    const count = await FloodZone.countDocuments();
    if (count > 0) {
      logger.info(`${count} flood zones already exist`);
      return;
    }

    const zones = [
      { zoneName: 'T. Nagar', centerLat: 13.0418, centerLon: 80.2341, avgFloodDepth: 2.5 },
      { zoneName: 'Velachery', centerLat: 12.9756, centerLon: 80.2207, avgFloodDepth: 4.0 },
      { zoneName: 'Adyar', centerLat: 13.0067, centerLon: 80.2570, avgFloodDepth: 3.2 },
      { zoneName: 'Anna Nagar', centerLat: 13.0850, centerLon: 80.2101, avgFloodDepth: 1.8 },
      { zoneName: 'Mylapore', centerLat: 13.0339, centerLon: 80.2707, avgFloodDepth: 2.0 },
      { zoneName: 'Tambaram', centerLat: 12.9249, centerLon: 80.1000, avgFloodDepth: 3.5 },
      { zoneName: 'Porur', centerLat: 13.0358, centerLon: 80.1559, avgFloodDepth: 2.8 },
      { zoneName: 'Perungudi', centerLat: 12.9611, centerLon: 80.2429, avgFloodDepth: 3.8 },
      { zoneName: 'Sholinganallur', centerLat: 12.9010, centerLon: 80.2279, avgFloodDepth: 4.5 },
      { zoneName: 'Madipakkam', centerLat: 12.9622, centerLon: 80.1986, avgFloodDepth: 3.0 },
      { zoneName: 'Chrompet', centerLat: 12.9516, centerLon: 80.1462, avgFloodDepth: 2.7 },
      { zoneName: 'Pallavaram', centerLat: 12.9675, centerLon: 80.1491, avgFloodDepth: 3.1 },
    ];

    await FloodZone.insertMany(
      zones.map((z) => ({ ...z, currentRiskScore: 0, predictedRainfall: 0, historicalData: [] })),
    );
    logger.info(`Seeded ${zones.length} Chennai flood zones`);
  }

  /**
   * Run pipeline + auto-assign pending incidents.
   */
  async runFullCycle(zoneIds?: string[]): Promise<void> {
    await this.updateFloodZones(zoneIds);
    await driverMatchingService.autoAssignPendingIncidents();
  }
}

export const mlPipelineService = new MLPipelineService();
export default mlPipelineService;
