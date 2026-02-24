import express, { Response } from 'express';
import { body } from 'express-validator';
import Driver, { DriverStatus } from '../models/Driver.js';
import Incident from '../models/Incident.js';
import { protect, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validator.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * @route   GET /api/v1/drivers/by-user/:userId
 * @desc    Get driver details by user id
 * @access  Private
 */
router.get(
  '/by-user/:userId',
  protect,
  async (req: AuthRequest, res: Response) => {
    try {
      const driver = await Driver.findOne({ userId: req.params.userId })
        .populate('userId', 'fullName email phone')
        .populate('vehicleId');

      if (!driver) {
        return res.status(404).json({
          success: false,
          message: 'Driver not found'
        });
      }

      res.json({
        success: true,
        data: { driver }
      });
    } catch (error: any) {
      logger.error('Error fetching driver by user:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching driver'
      });
    }
  }
);

/**
 * @route   GET /api/v1/drivers/:id
 * @desc    Get driver details
 * @access  Private
 */
router.get(
  '/:id',
  protect,
  async (req: AuthRequest, res: Response) => {
    try {
      const driver = await Driver.findById(req.params.id)
        .populate('userId', 'fullName email phone')
        .populate('vehicleId');

      if (!driver) {
        return res.status(404).json({
          success: false,
          message: 'Driver not found'
        });
      }

      res.json({
        success: true,
        data: { driver }
      });
    } catch (error: any) {
      logger.error('Error fetching driver:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching driver'
      });
    }
  }
);

/**
 * @route   PATCH /api/v1/drivers/:id/status
 * @desc    Update driver status
 * @access  Private (Driver)
 */
router.patch(
  '/:id/status',
  protect,
  [body('status').isIn(['available', 'busy', 'offline'])],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { status } = req.body;

      const driver = await Driver.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true }
      );

      if (!driver) {
        return res.status(404).json({
          success: false,
          message: 'Driver not found'
        });
      }

      logger.info(`Driver ${driver._id} status updated to ${status}`);

      res.json({
        success: true,
        message: 'Status updated successfully',
        data: { driver }
      });
    } catch (error: any) {
      logger.error('Error updating driver status:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating status'
      });
    }
  }
);

/**
 * @route   PATCH /api/v1/drivers/:id/location
 * @desc    Update driver location
 * @access  Private (Driver)
 */
router.patch(
  '/:id/location',
  protect,
  [
    body('currentLat').isFloat({ min: -90, max: 90 }),
    body('currentLon').isFloat({ min: -180, max: 180 })
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { currentLat, currentLon } = req.body;

      const driver = await Driver.findByIdAndUpdate(
        req.params.id,
        {
          currentLat,
          currentLon,
          lastLocationUpdate: new Date()
        },
        { new: true }
      );

      if (!driver) {
        return res.status(404).json({
          success: false,
          message: 'Driver not found'
        });
      }

      res.json({
        success: true,
        message: 'Location updated successfully',
        data: { driver }
      });
    } catch (error: any) {
      logger.error('Error updating driver location:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating location'
      });
    }
  }
);

/**
 * @route   GET /api/v1/drivers/:id/current-job
 * @desc    Get driver's current job
 * @access  Private (Driver)
 */
router.get(
  '/:id/current-job',
  protect,
  async (req: AuthRequest, res: Response) => {
    try {
      const incident = await Incident.findOne({
        assignedDriverId: req.params.id,
        status: { $in: ['assigned', 'in_progress'] }
      })
        .populate('citizenId', 'fullName phone')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        data: { incident }
      });
    } catch (error: any) {
      logger.error('Error fetching current job:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching current job'
      });
    }
  }
);

/**
 * @route   GET /api/v1/drivers/available
 * @desc    Get all available drivers
 * @access  Private
 */
router.get(
  '/available',
  protect,
  async (req: AuthRequest, res: Response) => {
    try {
      const drivers = await Driver.find({ status: DriverStatus.AVAILABLE })
        .populate('userId', 'fullName')
        .populate('vehicleId');

      res.json({
        success: true,
        count: drivers.length,
        data: { drivers }
      });
    } catch (error: any) {
      logger.error('Error fetching available drivers:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching drivers'
      });
    }
  }
);

export default router;
