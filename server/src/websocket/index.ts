import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import Driver from '../models/Driver.js';
import Incident from '../models/Incident.js';
import FloodZone from '../models/FloodZone.js';
import logger from '../config/logger.js';

interface AuthSocket extends Socket {
  userId?: string;
  userRole?: string;
}

export class WebSocketServer {
  private io: SocketIOServer;

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
        credentials: true
      }
    });

    this.setupMiddleware();
    this.setupEventHandlers();

    logger.info('WebSocket server initialized');
  }

  /**
   * Setup authentication middleware
   */
  private setupMiddleware(): void {
    this.io.use((socket: AuthSocket, next) => {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication error'));
      }

      try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        socket.userId = decoded.id;
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthSocket) => {
      logger.info(`Client connected: ${socket.id} (User: ${socket.userId})`);

      // Join user-specific room
      if (socket.userId) {
        socket.join(`user:${socket.userId}`);
      }

      // Driver location updates
      socket.on('driver:location', async (data: { lat: number; lon: number }) => {
        try {
          if (socket.userId) {
            await Driver.findOneAndUpdate(
              { userId: socket.userId },
              {
                currentLat: data.lat,
                currentLon: data.lon,
                lastLocationUpdate: new Date()
              }
            );

            // Broadcast to relevant rooms
            socket.broadcast.emit('driver:locationUpdated', {
              driverId: socket.userId,
              ...data
            });
          }
        } catch (error) {
          logger.error('Error updating driver location:', error);
        }
      });

      // Subscribe to flood zone updates
      socket.on('floodZones:subscribe', () => {
        socket.join('flood-zones');
        logger.debug(`Client ${socket.id} subscribed to flood zones`);
      });

      // Subscribe to incident updates
      socket.on('incidents:subscribe', (filters: any) => {
        if (filters.citizenId) {
          socket.join(`incidents:citizen:${filters.citizenId}`);
        }
        if (filters.driverId) {
          socket.join(`incidents:driver:${filters.driverId}`);
        }
        logger.debug(`Client ${socket.id} subscribed to incidents`);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Emit flood zone update to all subscribers
   */
  emitFloodZoneUpdate(zone: any): void {
    this.io.to('flood-zones').emit('floodZone:updated', zone);
  }

  /**
   * Emit incident update
   */
  emitIncidentUpdate(incident: any): void {
    // Emit to citizen
    this.io.to(`user:${incident.citizenId}`).emit('incident:updated', incident);

    // Emit to assigned driver
    if (incident.assignedDriverId) {
      this.io.to(`user:${incident.assignedDriverId}`).emit('incident:updated', incident);
    }

    // Emit to subscribers
    this.io.to(`incidents:citizen:${incident.citizenId}`).emit('incident:updated', incident);
    if (incident.assignedDriverId) {
      this.io.to(`incidents:driver:${incident.assignedDriverId}`).emit('incident:updated', incident);
    }
  }

  /**
   * Emit new incident alert to available drivers
   */
  async emitNewIncidentAlert(incident: any): Promise<void> {
    // Get all available drivers
    const availableDrivers = await Driver.find({ status: 'available' });

    for (const driver of availableDrivers) {
      this.io.to(`user:${driver.userId}`).emit('incident:new', incident);
    }
  }

  /**
   * Emit driver assignment notification
   */
  emitDriverAssigned(citizenId: string, incident: any): void {
    this.io.to(`user:${citizenId}`).emit('driver:assigned', incident);
  }

  /**
   * Get WebSocket server instance
   */
  getIO(): SocketIOServer {
    return this.io;
  }
}

export default WebSocketServer;
