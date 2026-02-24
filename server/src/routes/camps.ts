import express, { Response } from 'express';
import { body } from 'express-validator';
import Inventory from '../models/Inventory.js';
import Camp from '../models/Camp.js';
import { protect, AuthRequest, authorize } from '../middleware/auth.js';
import { UserRole } from '../models/User.js';
import { validate } from '../middleware/validator.js';
import notificationService from '../services/notificationService.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * @route   GET /api/v1/camps/inventory/all
 * @desc    Get all inventory items across camps
 * @access  Private (Pharmacist/Admin)
 */
router.get(
  '/inventory/all',
  protect,
  authorize(UserRole.PHARMACIST, UserRole.ADMIN),
  async (_req: AuthRequest, res: Response) => {
    try {
      const inventory = await Inventory.find()
        .populate('campId', 'name address')
        .sort({ itemName: 1 });

      res.json({
        success: true,
        count: inventory.length,
        data: { inventory }
      });
    } catch (error: any) {
      logger.error('Error fetching all inventory:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching inventory'
      });
    }
  }
);

/**
 * @route   GET /api/v1/camps
 * @desc    Get all camps
 * @access  Public
 */
router.get(
  '/',
  async (req: AuthRequest, res: Response) => {
    try {
      const camps = await Camp.find({ isActive: true })
        .populate('managerId', 'fullName phone');

      res.json({
        success: true,
        count: camps.length,
        data: { camps }
      });
    } catch (error: any) {
      logger.error('Error fetching camps:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching camps'
      });
    }
  }
);

/**
 * @route   GET /api/v1/camps/:id/inventory
 * @desc    Get camp inventory
 * @access  Private
 */
router.get(
  '/:id/inventory',
  protect,
  async (req: AuthRequest, res: Response) => {
    try {
      const inventory = await Inventory.find({ campId: req.params.id })
        .populate('updatedBy', 'fullName')
        .sort({ itemName: 1 });

      res.json({
        success: true,
        count: inventory.length,
        data: { inventory }
      });
    } catch (error: any) {
      logger.error('Error fetching inventory:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching inventory'
      });
    }
  }
);

/**
 * @route   PATCH /api/v1/camps/:campId/inventory/:itemId
 * @desc    Update inventory quantity
 * @access  Private (Pharmacist)
 */
router.patch(
  '/:campId/inventory/:itemId',
  protect,
  authorize(UserRole.PHARMACIST, UserRole.ADMIN),
  [body('quantity').isInt({ min: 0 })],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { quantity } = req.body;

      const item = await Inventory.findByIdAndUpdate(
        req.params.itemId,
        {
          quantity,
          updatedBy: req.userId,
          lastRestocked: quantity > 0 ? new Date() : undefined
        },
        { new: true }
      );

      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        });
      }

      // Check if low stock and send alert
      if (item.isLowStock()) {
        const camp = await Camp.findById(item.campId);
        if (camp && camp.managerId) {
          await notificationService.sendLowStockAlert(
            camp.managerId.toString(),
            item.itemName,
            camp.name
          );
        }
      }

      logger.info(`Inventory updated: ${item.itemName} = ${quantity}`);

      res.json({
        success: true,
        message: 'Inventory updated successfully',
        data: { item }
      });
    } catch (error: any) {
      logger.error('Error updating inventory:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating inventory'
      });
    }
  }
);

/**
 * @route   POST /api/v1/camps/:campId/inventory
 * @desc    Add new inventory item
 * @access  Private (Pharmacist)
 */
router.post(
  '/:campId/inventory',
  protect,
  authorize(UserRole.PHARMACIST, UserRole.ADMIN),
  [
    body('itemName').trim().notEmpty(),
    body('quantity').isInt({ min: 0 }),
    body('unit').optional().trim(),
    body('minThreshold').optional().isInt({ min: 0 })
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { itemName, quantity, unit, minThreshold } = req.body;

      const item = await Inventory.create({
        campId: req.params.campId,
        itemName,
        quantity,
        unit: unit || 'units',
        minThreshold: minThreshold || 10,
        updatedBy: req.userId
      });

      logger.info(`New inventory item added: ${itemName}`);

      res.status(201).json({
        success: true,
        message: 'Inventory item added successfully',
        data: { item }
      });
    } catch (error: any) {
      logger.error('Error adding inventory item:', error);
      res.status(500).json({
        success: false,
        message: 'Error adding inventory item'
      });
    }
  }
);

/**
 * @route   GET /api/v1/camps/low-stock
 * @desc    Get low stock items across all camps
 * @access  Private (Pharmacist)
 */
router.get(
  '/low-stock',
  protect,
  authorize(UserRole.PHARMACIST, UserRole.ADMIN),
  async (req: AuthRequest, res: Response) => {
    try {
      const inventory = await Inventory.find()
        .populate('campId', 'name')
        .sort({ quantity: 1 });

      const lowStockItems = inventory.filter(item => item.isLowStock());

      res.json({
        success: true,
        count: lowStockItems.length,
        data: { items: lowStockItems }
      });
    } catch (error: any) {
      logger.error('Error fetching low stock items:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching low stock items'
      });
    }
  }
);

export default router;
