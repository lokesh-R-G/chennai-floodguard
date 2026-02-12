import express, { Response } from 'express';
import FloodZone from '../models/FloodZone.js';
import { protect, AuthRequest } from '../middleware/auth.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * @route   GET /api/v1/flood-zones
 * @desc    Get all flood zones
 * @access  Public
 */
router.get(
  '/',
  async (req: AuthRequest, res: Response) => {
    try {
      const zones = await FloodZone.find().sort({ currentRiskScore: -1 });

      res.json({
        success: true,
        count: zones.length,
        data: { zones }
      });
    } catch (error: any) {
      logger.error('Error fetching flood zones:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching flood zones'
      });
    }
  }
);

/**
 * @route   GET /api/v1/flood-zones/:id
 * @desc    Get single flood zone
 * @access  Public
 */
router.get(
  '/:id',
  async (req: AuthRequest, res: Response) => {
    try {
      const zone = await FloodZone.findById(req.params.id);

      if (!zone) {
        return res.status(404).json({
          success: false,
          message: 'Flood zone not found'
        });
      }

      res.json({
        success: true,
        data: { zone }
      });
    } catch (error: any) {
      logger.error('Error fetching flood zone:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching flood zone'
      });
    }
  }
);

/**
 * @route   GET /api/v1/flood-zones/:id/history
 * @desc    Get historical data for flood zone
 * @access  Public
 */
router.get(
  '/:id/history',
  async (req: AuthRequest, res: Response) => {
    try {
      const { days = 7 } = req.query;
      
      const zone = await FloodZone.findById(req.params.id);

      if (!zone) {
        return res.status(404).json({
          success: false,
          message: 'Flood zone not found'
        });
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - Number(days));

      const history = zone.historicalData.filter(
        h => h.timestamp >= cutoffDate
      );

      res.json({
        success: true,
        data: { 
          zoneName: zone.zoneName,
          history 
        }
      });
    } catch (error: any) {
      logger.error('Error fetching zone history:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching history'
      });
    }
  }
);

/**
 * @route   GET /api/v1/flood-zones/high-risk
 * @desc    Get high-risk flood zones (score >= 7)
 * @access  Public
 */
router.get(
  '/high-risk',
  async (req: AuthRequest, res: Response) => {
    try {
      const zones = await FloodZone.find({
        currentRiskScore: { $gte: 7 }
      }).sort({ currentRiskScore: -1 });

      res.json({
        success: true,
        count: zones.length,
        data: { zones }
      });
    } catch (error: any) {
      logger.error('Error fetching high-risk zones:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching high-risk zones'
      });
    }
  }
);

export default router;
