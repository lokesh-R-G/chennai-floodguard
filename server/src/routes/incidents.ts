import express, { Response } from 'express';
import { body } from 'express-validator';
import Incident, { IncidentStatus } from '../models/Incident.js';
import Driver from '../models/Driver.js';
import { protect, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validator.js';
import driverMatchingService from '../services/driverMatchingService.js';
import notificationService from '../services/notificationService.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * @route   POST /api/v1/incidents
 * @desc    Create emergency incident
 * @access  Private (Citizen)
 */
router.post(
  '/',
  protect,
  [
    body('locationLat').isFloat({ min: -90, max: 90 }),
    body('locationLon').isFloat({ min: -180, max: 180 }),
    body('emergencyType').isIn(['medical', 'water_rescue', 'evacuation', 'shelter', 'supplies', 'other']),
    body('description').optional().isString().trim()
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { locationLat, locationLon, emergencyType, description } = req.body;

      // Create incident
      const incident = await Incident.create({
        citizenId: req.userId,
        locationLat,
        locationLon,
        emergencyType,
        description,
        status: IncidentStatus.PENDING,
        priority: emergencyType === 'medical' ? 10 : 5
      });

      logger.info(`New incident created: ${incident._id}`);

      // Async: Try to find and assign driver
      driverMatchingService.findAndAssignDriver(incident._id.toString())
        .catch(err => logger.error('Error assigning driver:', err));

      res.status(201).json({
        success: true,
        message: 'Emergency alert sent successfully',
        data: { incident }
      });
    } catch (error: any) {
      logger.error('Error creating incident:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating incident',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/v1/incidents
 * @desc    Get incidents (filtered by query params)
 * @access  Private
 */
router.get(
  '/',
  protect,
  async (req: AuthRequest, res: Response) => {
    try {
      const { status, citizenId, driverId, emergencyType } = req.query;

      const filter: any = {};
      if (status) filter.status = status;
      if (citizenId) filter.citizenId = citizenId;
      if (driverId) filter.assignedDriverId = driverId;
      if (emergencyType) filter.emergencyType = emergencyType;

      const incidents = await Incident.find(filter)
        .populate('citizenId', 'fullName email phone')
        .populate('assignedDriverId')
        .sort({ createdAt: -1 })
        .limit(100);

      res.json({
        success: true,
        count: incidents.length,
        data: { incidents }
      });
    } catch (error: any) {
      logger.error('Error fetching incidents:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching incidents'
      });
    }
  }
);

/**
 * @route   GET /api/v1/incidents/:id
 * @desc    Get single incident
 * @access  Private
 */
router.get(
  '/:id',
  protect,
  async (req: AuthRequest, res: Response) => {
    try {
      const incident = await Incident.findById(req.params.id)
        .populate('citizenId', 'fullName email phone')
        .populate({
          path: 'assignedDriverId',
          populate: { path: 'vehicleId userId' }
        });

      if (!incident) {
        return res.status(404).json({
          success: false,
          message: 'Incident not found'
        });
      }

      res.json({
        success: true,
        data: { incident }
      });
    } catch (error: any) {
      logger.error('Error fetching incident:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching incident'
      });
    }
  }
);

/**
 * @route   PATCH /api/v1/incidents/:id/status
 * @desc    Update incident status
 * @access  Private (Driver/Citizen)
 */
router.patch(
  '/:id/status',
  protect,
  [body('status').isIn(['assigned', 'in_progress', 'completed', 'cancelled'])],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { status } = req.body;
      const incident = await Incident.findById(req.params.id);

      if (!incident) {
        return res.status(404).json({
          success: false,
          message: 'Incident not found'
        });
      }

      // Update status
      incident.status = status;

      // Update timestamps based on status
      switch (status) {
        case 'in_progress':
          incident.startedAt = new Date();
          break;
        case 'completed':
          incident.completedAt = new Date();
          // Update driver stats
          if (incident.assignedDriverId) {
            await Driver.findByIdAndUpdate(incident.assignedDriverId, {
              $inc: { completedJobs: 1 },
              status: 'available'
            });
          }
          // Notify citizen
          await notificationService.sendJobCompleted(
            incident.citizenId.toString(),
            incident._id.toString()
          );
          break;
        case 'cancelled':
          incident.cancelledAt = new Date();
          incident.cancellationReason = req.body.reason || 'Not specified';
          // Make driver available again
          if (incident.assignedDriverId) {
            await Driver.findByIdAndUpdate(incident.assignedDriverId, {
              status: 'available'
            });
          }
          break;
      }

      await incident.save();

      logger.info(`Incident ${incident._id} status updated to ${status}`);

      res.json({
        success: true,
        message: 'Status updated successfully',
        data: { incident }
      });
    } catch (error: any) {
      logger.error('Error updating incident status:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating status'
      });
    }
  }
);

/**
 * @route   GET /api/v1/incidents/citizen/:citizenId
 * @desc    Get citizen's active incident
 * @access  Private
 */
router.get(
  '/citizen/:citizenId',
  protect,
  async (req: AuthRequest, res: Response) => {
    try {
      const incident = await Incident.findOne({
        citizenId: req.params.citizenId,
        status: { $in: [IncidentStatus.PENDING, IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS] }
      })
        .populate({
          path: 'assignedDriverId',
          populate: [
            { path: 'userId', select: 'fullName phone' },
            { path: 'vehicleId' }
          ]
        })
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        data: { incident }
      });
    } catch (error: any) {
      logger.error('Error fetching citizen incident:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching incident'
      });
    }
  }
);

export default router;
