import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import FloodZone from '../models/FloodZone.js';
import weatherService from './weatherService.js';
import driverMatchingService from './driverMatchingService.js';
import logger from '../config/logger.js';

const execPromise = promisify(exec);

export class MLPipelineService {
  private cronJob: cron.ScheduledTask | null = null;

  /**
   * Start automated ML pipeline execution
   */
  start(): void {
    const cronSchedule = process.env.ML_UPDATE_CRON || '0 */15 * * *'; // Default: every 15 minutes

    logger.info(`Starting ML pipeline with schedule: ${cronSchedule}`);

    this.cronJob = cron.schedule(cronSchedule, async () => {
      logger.info('Running automated ML pipeline update...');
      await this.runMLPipeline();
    });

    // Run immediately on start
    this.runMLPipeline();
  }

  /**
   * Stop automated ML pipeline
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      logger.info('ML pipeline automation stopped');
    }
  }

  /**
   * Run ML pipeline to update flood zones
   */
  async runMLPipeline(): Promise<void> {
    try {
      const scriptPath = process.env.ML_SCRIPT_PATH || '../public/models/chennai_realtime_flood_heatmap.py';

      logger.info('Executing ML script:', scriptPath);

      // Execute Python script
      const { stdout, stderr } = await execPromise(`python3 ${scriptPath}`);

      if (stderr) {
        logger.warn('ML script stderr:', stderr);
      }

      logger.info('ML script completed successfully');

      // Parse output and update database if script outputs JSON
      // For now, we'll manually fetch weather and update
      await this.updateFloodZonesFromWeather();

      // Trigger auto-assignment for pending incidents
      await driverMatchingService.autoAssignPendingIncidents();

    } catch (error) {
      logger.error('Error running ML pipeline:', error);
    }
  }

  /**
   * Update flood zones based on weather data
   */
  private async updateFloodZonesFromWeather(): Promise<void> {
    try {
      const zones = await FloodZone.find();

      for (const zone of zones) {
        // Get current weather for zone
        const weather = await weatherService.getCurrentWeather(
          zone.centerLat,
          zone.centerLon
        );

        // Get forecast for next 24 hours
        const forecast = await weatherService.getForecast(
          zone.centerLat,
          zone.centerLon,
          24
        );

        // Calculate predicted rainfall (sum of next 3 hours)
        const predictedRainfall = forecast.hourly
          .slice(0, 3)
          .reduce((sum, h) => sum + h.precipitation, 0);

        // Update risk score using formula from original ML script
        const rainNorm = Math.min(predictedRainfall / 100, 1); // Normalize to 0-1
        const depthNorm = Math.min(zone.avgFloodDepth / 10, 1); // Normalize to 0-1
        const newRiskScore = (0.6 * rainNorm + 0.4 * depthNorm) * 10;

        // Store historical data
        zone.historicalData.push({
          timestamp: new Date(),
          riskScore: newRiskScore,
          rainfall: weather.rainfall,
          floodDepth: zone.avgFloodDepth
        });

        // Keep only last 30 days of historical data
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        zone.historicalData = zone.historicalData.filter(
          h => h.timestamp >= thirtyDaysAgo
        );

        // Update zone
        zone.currentRiskScore = newRiskScore;
        zone.predictedRainfall = predictedRainfall;
        zone.lastUpdated = new Date();

        await zone.save();

        logger.debug(`Updated zone ${zone.zoneName}: risk=${newRiskScore.toFixed(1)}, rain=${predictedRainfall.toFixed(1)}mm`);
      }

      logger.info(`Updated ${zones.length} flood zones`);

    } catch (error) {
      logger.error('Error updating flood zones:', error);
    }
  }

  /**
   * Initialize flood zones if they don't exist
   */
  async initializeFloodZones(): Promise<void> {
    try {
      const count = await FloodZone.countDocuments();
      
      if (count > 0) {
        logger.info(`${count} flood zones already exist`);
        return;
      }

      logger.info('Initializing flood zones for Chennai...');

      const chennaiZones = [
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
        { zoneName: 'Pallavaram', centerLat: 12.9675, centerLon: 80.1491, avgFloodDepth: 3.1 }
      ];

      await FloodZone.insertMany(
        chennaiZones.map(zone => ({
          ...zone,
          currentRiskScore: 0,
          predictedRainfall: 0,
          historicalData: []
        }))
      );

      logger.info(`Initialized ${chennaiZones.length} flood zones`);

      // Run initial update
      await this.updateFloodZonesFromWeather();

    } catch (error) {
      logger.error('Error initializing flood zones:', error);
    }
  }
}

export default new MLPipelineService();
