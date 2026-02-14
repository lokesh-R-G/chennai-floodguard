import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import Driver from '../models/Driver.js';
import { getPubClient, getSubClient } from '../config/redis.js';
import { config } from '../config/env.js';
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
        origin: config.corsOrigin,
        credentials: true,
      },
    });

    this.attachRedisAdapter();
    this.setupMiddleware();
    this.setupEventHandlers();

    logger.info('WebSocket server initialized');
  }

  /**
   * Attach Redis adapter for horizontal scaling.
   * Falls back to in-memory if Redis unavailable.
   */
  private attachRedisAdapter(): void {
    try {
      const pub = getPubClient();
      const sub = getSubClient();
      this.io.adapter(createAdapter(pub, sub));
      logger.info('WebSocket Redis adapter attached');
    } catch (err) {
      logger.warn('Redis adapter unavailable — falling back to in-memory', { error: (err as Error).message });
    }
  }

  private setupMiddleware(): void {
    this.io.use((socket: AuthSocket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication error'));

      try {
        const decoded: any = jwt.verify(token, config.jwtSecret);
        socket.userId = decoded.id;
        next();
      } catch {
        next(new Error('Authentication error'));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthSocket) => {
      logger.info(`Client connected: ${socket.id} (User: ${socket.userId})`);

      if (socket.userId) {
        socket.join(`user:${socket.userId}`);
      }

      // Driver location updates
      socket.on('driver:location', async (data: { lat: number; lon: number }) => {
        try {
          if (socket.userId) {
            await Driver.findOneAndUpdate(
              { userId: socket.userId },
              { currentLat: data.lat, currentLon: data.lon, lastLocationUpdate: new Date() },
            );
            socket.broadcast.emit('driver:locationUpdated', { driverId: socket.userId, ...data });
          }
        } catch (error) {
          logger.error('Error updating driver location:', error);
        }
      });

      socket.on('floodZones:subscribe', () => {
        socket.join('flood-zones');
      });

      socket.on('incidents:subscribe', (filters: any) => {
        if (filters.citizenId) socket.join(`incidents:citizen:${filters.citizenId}`);
        if (filters.driverId) socket.join(`incidents:driver:${filters.driverId}`);
      });

      socket.on('disconnect', () => {
        logger.debug(`Client disconnected: ${socket.id}`);
      });
    });
  }

  emitFloodZoneUpdate(zone: any): void {
    this.io.to('flood-zones').emit('floodZone:updated', zone);
  }

  emitIncidentUpdate(incident: any): void {
    this.io.to(`user:${incident.citizenId}`).emit('incident:updated', incident);
    if (incident.assignedDriverId) {
      this.io.to(`user:${incident.assignedDriverId}`).emit('incident:updated', incident);
    }
    this.io.to(`incidents:citizen:${incident.citizenId}`).emit('incident:updated', incident);
    if (incident.assignedDriverId) {
      this.io.to(`incidents:driver:${incident.assignedDriverId}`).emit('incident:updated', incident);
    }
  }

  async emitNewIncidentAlert(incident: any): Promise<void> {
    const availableDrivers = await Driver.find({ status: 'available' });
    for (const driver of availableDrivers) {
      this.io.to(`user:${driver.userId}`).emit('incident:new', incident);
    }
  }

  emitDriverAssigned(citizenId: string, incident: any): void {
    this.io.to(`user:${citizenId}`).emit('driver:assigned', incident);
  }

  getIO(): SocketIOServer {
    return this.io;
  }
}

export default WebSocketServer;
