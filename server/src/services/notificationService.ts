import webpush from 'web-push';
import User from '../models/User.js';
import notificationQueue, { NotificationJobData } from '../queues/notificationQueue.js';
import { config } from '../config/env.js';
import logger from '../config/logger.js';

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string }>;
}

export class NotificationService {
  private initialized = false;

  constructor() {
    if (config.vapidPublicKey && config.vapidPrivateKey) {
      webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);
      this.initialized = true;
    } else {
      logger.warn('VAPID keys not configured — push disabled');
    }
  }

  /* ────────────────────────────────────
   *  Low-level push (processed by worker)
   * ──────────────────────────────────── */

  async sendToUser(userId: string, payload: NotificationPayload): Promise<boolean> {
    if (!this.initialized) return false;

    try {
      const user = await User.findById(userId);
      if (!user?.pushSubscription) return false;

      await webpush.sendNotification(
        user.pushSubscription,
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          icon: payload.icon || '/logo.png',
          badge: payload.badge || '/badge.png',
          data: payload.data || {},
          actions: payload.actions || [],
        }),
      );
      logger.debug(`Push sent to ${userId}`);
      return true;
    } catch (err: any) {
      if (err.statusCode === 410) {
        await User.findByIdAndUpdate(userId, { $unset: { pushSubscription: 1 } });
        logger.info(`Removed stale push sub for ${userId}`);
      } else {
        logger.error(`Push to ${userId} failed:`, err.message);
      }
      return false;
    }
  }

  async sendToMultipleUsers(
    userIds: string[],
    payload: NotificationPayload,
  ): Promise<{ sent: number; failed: number }> {
    const results = await Promise.allSettled(
      userIds.map((uid) => this.sendToUser(uid, payload)),
    );
    const sent = results.filter((r) => r.status === 'fulfilled' && r.value).length;
    return { sent, failed: userIds.length - sent };
  }

  /* ────────────────────────────────────
   *  Queue-backed high-level helpers (non-blocking)
   * ──────────────────────────────────── */

  async enqueueEmergencyAlert(userId: string, incidentId: string, emergencyType: string): Promise<void> {
    await notificationQueue.add({
      type: 'push',
      userId,
      payload: {
        title: '🚨 Emergency Alert',
        body: `New ${emergencyType} emergency request received!`,
        data: { type: 'emergency', incidentId, url: `/dashboard?incident=${incidentId}` },
      },
    });
  }

  async enqueueDriverAssigned(userId: string, driverName: string, vehicleNumber: string): Promise<void> {
    await notificationQueue.add({
      type: 'driver_assigned',
      userId,
      payload: {
        title: '✅ Help is on the way!',
        body: `Driver ${driverName} (${vehicleNumber}) has been assigned.`,
      },
    });
  }

  async enqueueJobCompleted(userId: string, incidentId: string): Promise<void> {
    await notificationQueue.add({
      type: 'job_completed',
      userId,
      payload: {
        title: '✅ Emergency Resolved',
        body: 'Your emergency has been successfully handled. Stay safe!',
        data: { type: 'job_completed', incidentId },
      },
    });
  }

  async enqueueFloodRiskAlert(userIds: string[], zoneName: string, riskScore: number): Promise<void> {
    await notificationQueue.add({
      type: 'flood_alert',
      userIds,
      payload: {
        title: '⚠️ Flood Risk Alert',
        body: `${zoneName} risk score: ${riskScore.toFixed(1)}. Stay alert!`,
        data: { type: 'flood_alert', zoneName, riskScore },
      },
    });
  }

  async enqueueLowStockAlert(userId: string, itemName: string, campName: string): Promise<void> {
    await notificationQueue.add({
      type: 'low_stock',
      userId,
      payload: {
        title: '📦 Low Stock Alert',
        body: `${itemName} at ${campName} is running low. Restock needed.`,
      },
    });
  }

  /**
   * Alias kept for backwards-compatible route code.
   */
  sendEmergencyAlert = this.enqueueEmergencyAlert.bind(this);
  sendDriverAssigned = this.enqueueDriverAssigned.bind(this);
  sendJobCompleted = this.enqueueJobCompleted.bind(this);
  sendFloodRiskAlert = this.enqueueFloodRiskAlert.bind(this);
  sendLowStockAlert = this.enqueueLowStockAlert.bind(this);
}

export const notificationService = new NotificationService();
export default notificationService;
