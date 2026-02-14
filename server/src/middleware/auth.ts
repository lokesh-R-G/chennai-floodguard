import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import User, { UserRole } from '../models/User.js';
import RefreshToken, { hashToken } from '../models/RefreshToken.js';
import { config } from '../config/env.js';
import logger from '../config/logger.js';

export interface AuthRequest extends Request {
  user?: any;
  userId?: string;
}

/**
 * Protect route — validates JWT access token.
 */
export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }

    try {
      const decoded: any = jwt.verify(token, config.jwtSecret);
      const user = await User.findById(decoded.id).select('-password');

      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User not found or inactive',
        });
      }

      req.user = user;
      req.userId = user._id.toString();
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in authentication',
    });
  }
};

/**
 * Authorize specific roles.
 */
export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role ${req.user.role} is not authorized`,
      });
    }
    next();
  };
};

/**
 * Generate short-lived access token (15 min default).
 */
export function generateToken(id: string): string {
  return jwt.sign({ id }, config.jwtSecret, {
    expiresIn: config.jwtExpire,
  });
}

/**
 * Generate a cryptographically random refresh token,
 * store its hash in MongoDB, and return the raw token.
 */
export async function generateRefreshToken(
  userId: string,
  family?: string,
  meta?: { userAgent?: string; ip?: string }
): Promise<string> {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHsh = hashToken(rawToken);
  const tokenFamily = family || crypto.randomUUID();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await RefreshToken.create({
    userId,
    tokenHash: tokenHsh,
    family: tokenFamily,
    expiresAt,
    userAgent: meta?.userAgent,
    ip: meta?.ip,
  });

  return rawToken;
}

/**
 * Rotate a refresh token: validate the old one, revoke it,
 * issue a new pair. If the old token was already used (replay),
 * revoke the entire family.
 */
export async function rotateRefreshToken(
  rawOldToken: string,
  meta?: { userAgent?: string; ip?: string }
): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
  const oldHash = hashToken(rawOldToken);
  const stored = await RefreshToken.findOne({ tokenHash: oldHash });

  if (!stored) {
    throw new Error('Invalid refresh token');
  }

  // Already revoked ⇒ potential replay attack – revoke whole family
  if (stored.revokedAt) {
    await RefreshToken.updateMany(
      { family: stored.family },
      { revokedAt: new Date() }
    );
    logger.warn(`Refresh token replay detected for family ${stored.family}, revoking all`);
    throw new Error('Refresh token reuse detected');
  }

  if (stored.expiresAt < new Date()) {
    throw new Error('Refresh token expired');
  }

  // Revoke old token
  stored.revokedAt = new Date();

  // Issue new pair
  const newRaw = crypto.randomBytes(40).toString('hex');
  const newHash = hashToken(newRaw);
  stored.replacedByHash = newHash;
  await stored.save();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await RefreshToken.create({
    userId: stored.userId,
    tokenHash: newHash,
    family: stored.family,
    expiresAt,
    userAgent: meta?.userAgent,
    ip: meta?.ip,
  });

  const accessToken = generateToken(stored.userId.toString());
  return { accessToken, refreshToken: newRaw, userId: stored.userId.toString() };
}

/**
 * Revoke all refresh tokens for a user (logout everywhere).
 */
export async function revokeAllTokens(userId: string): Promise<void> {
  await RefreshToken.updateMany(
    { userId, revokedAt: { $exists: false } },
    { revokedAt: new Date() }
  );
}


// Generate Refresh Token
export const generateRefreshToken = (id: string): string => {
  return jwt.sign(
    { id },
    process.env.JWT_REFRESH_SECRET || 'refresh-secret',
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d'
    }
  );
};
