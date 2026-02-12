import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import User from '../models/User.js';
import Driver from '../models/Driver.js';
import { generateToken, generateRefreshToken } from '../middleware/auth.js';
import { validate } from '../middleware/validator.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('fullName').trim().notEmpty(),
    body('role').isIn(['citizen', 'driver', 'pharmacist']),
    body('phone').optional().matches(/^[0-9]{10}$/)
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { email, password, fullName, phone, role } = req.body;

      // Check if user exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists'
        });
      }

      // Create user
      const user = await User.create({
        email,
        password,
        fullName,
        phone,
        role
      });

      // If role is driver, create driver profile
      if (role === 'driver') {
        await Driver.create({
          userId: user._id
        });
      }

      // Generate tokens
      const token = generateToken(user._id.toString());
      const refreshToken = generateRefreshToken(user._id.toString());

      logger.info(`New user registered: ${email}`);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            role: user.role
          },
          token,
          refreshToken
        }
      });
    } catch (error: any) {
      logger.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Error registering user',
        error: error.message
      });
    }
  }
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await User.findOne({ email }).select('+password');
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check if active
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated. Please contact support.'
        });
      }

      // Verify password
      const isMatch = await user.comparePassword(password);
      
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Generate tokens
      const token = generateToken(user._id.toString());
      const refreshToken = generateRefreshToken(user._id.toString());

      logger.info(`User logged in: ${email}`);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            phone: user.phone
          },
          token,
          refreshToken
        }
      });
    } catch (error: any) {
      logger.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Error logging in',
        error: error.message
      });
    }
  }
);

/**
 * @route   POST /api/v1/auth/push-subscription
 * @desc    Save push notification subscription
 * @access  Private
 */
router.post('/push-subscription', async (req: Request, res: Response) => {
  try {
    const { userId, subscription } = req.body;

    await User.findByIdAndUpdate(userId, {
      pushSubscription: subscription
    });

    res.json({
      success: true,
      message: 'Push subscription saved'
    });
  } catch (error: any) {
    logger.error('Push subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving push subscription'
    });
  }
});

export default router;
