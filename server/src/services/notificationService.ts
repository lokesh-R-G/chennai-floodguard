import webpush from 'web-push';
import User from '../models/User.js';
import logger from '../config/logger.js';

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
  }>;
}

export class PushNotificationService {
  constructor() {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@chennaifloodguard.com';

    if (vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    } else {
      logger.warn('VAPID keys not configured. Push notifications will not work.');
    }
  }

  /**
   * Send push notification to a specific user
   */
  async sendToUser(userId: string, payload: NotificationPayload): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      
      if (!user || !user.pushSubscription) {
        logger.debug(`User ${userId} has no push subscription`);
        return false;
      }

      const notificationPayload = JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/logo.png',
        badge: payload.badge || '/badge.png',
        data: payload.data || {},
        actions: payload.actions || []
      });

      await webpush.sendNotification(
        user.pushSubscription,
        notificationPayload
      );

      logger.info(`Push notification sent to user ${userId}`);
      return true;

    } catch (error: any) {
      logger.error(`Error sending push notification to user ${userId}:`, error);

      // If subscription is invalid, remove it
      if (error.statusCode === 410) {
        await User.findByIdAndUpdate(userId, {
          $unset: { pushSubscription: 1 }
        });
        logger.info(`Removed invalid push subscription for user ${userId}`);
      }

      return false;
    }
  }

  /**
   * Send push notification to multiple users
   */
  async sendToMultipleUsers(
    userIds: string[],
    payload: NotificationPayload
  ): Promise<{ sent: number; failed: number }> {
    const results = await Promise.allSettled(
      userIds.map(userId => this.sendToUser(userId, payload))
    );

    const sent = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failed = userIds.length - sent;

    logger.info(`Sent ${sent}/${userIds.length} push notifications`);
    return { sent, failed };
  }

  /**
   * Send emergency alert notification
   */
  async sendEmergencyAlert(userId: string, incidentId: string, emergencyType: string): Promise<void> {
    await this.sendToUser(userId, {
      title: '🚨 Emergency Alert',
      body: `New ${emergencyType} emergency request received!`,
      icon: '/emergency-icon.png',
      data: {
        type: 'emergency',
        incidentId,
        url: `/dashboard?incident=${incidentId}`
      },
      actions: [
        { action: 'view', title: 'View Details' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    });
  }

  
/**
   * Send driver assignment notification to citizen
   */
  async sendDriverAssigned(userId: string, driverName: string, vehicleNumber: string): Promise<void> {
    await this.sendToUser(userId, {
      title: '✅ Help is on the way!',
      body: `Driver ${driverName} (${vehicleNumber}) has been assigned to your emergency.`,
      icon: '/driver-icon.png',
      data: {
        type: 'driver_assigned'
      }
    });
  }

  /**
   * Send job completion notification
   */
  async sendJobCompleted(userId: string, incidentId: string): Promise<void> {
    await this.sendToUser(userId, {
      title: '✅ Emergency Resolved',
      body: 'Your emergency has been successfully handled. Stay safe!',
      icon: '/success-icon.png',
      data: {
        type: 'job_completed',
        incidentId
      }
    });
  }

  /**
   * Send flood zone risk alert
   */
  async sendFloodRiskAlert(userIds: string[], zoneName: string, riskScore: number): Promise<void> {
    await this.sendToMultipleUsers(userIds, {
      title: '⚠️ Flood Risk Alert',
      body: `${zoneName} has reached ${riskScore.toFixed(1)} risk score. Stay alert!`,
      icon: '/warning-icon.png',
      data: {
        type: 'flood_alert',
        zoneName,
        riskScore
      }
    });
  }

  /**
   * Send low stock alert to pharmacists
   */
  async sendLowStockAlert(userId: string, itemName: string, campName: string): Promise<void> {
    await this.sendToUser(userId, {
      title: '📦 Low Stock Alert',
      body: `${itemName} is running low at ${campName}`,
      icon: '/inventory-icon.png',
      data: {
        type: 'low_stock',
        itemName,
        campName
      }
    });
  }
}

export default new PushNotificationService();
