import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:5000';

class WebSocketClient {
  private socket: Socket | null = null;
  private token: string | null = null;

  connect(token: string): Socket {
    this.token = token;

    this.socket = io(WS_URL, {
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  // Driver location update
  updateDriverLocation(lat: number, lon: number): void {
    if (this.socket) {
      this.socket.emit('driver:location', { lat, lon });
    }
  }

  // Subscribe to flood zones
  subscribeToFloodZones(): void {
    if (this.socket) {
      this.socket.emit('floodZones:subscribe');
    }
  }

  // Subscribe to incidents
  subscribeToIncidents(filters: { citizenId?: string; driverId?: string }): void {
    if (this.socket) {
      this.socket.emit('incidents:subscribe', filters);
    }
  }

  // Event listeners
  onFloodZoneUpdate(callback: (zone: any) => void): void {
    if (this.socket) {
      this.socket.on('floodZone:updated', callback);
    }
  }

  onIncidentUpdate(callback: (incident: any) => void): void {
    if (this.socket) {
      this.socket.on('incident:updated', callback);
    }
  }

  onNewIncident(callback: (incident: any) => void): void {
    if (this.socket) {
      this.socket.on('incident:new', callback);
    }
  }

  onDriverAssigned(callback: (incident: any) => void): void {
    if (this.socket) {
      this.socket.on('driver:assigned', callback);
    }
  }

  onDriverLocationUpdate(callback: (data: { driverId: string; lat: number; lon: number }) => void): void {
    if (this.socket) {
      this.socket.on('driver:locationUpdated', callback);
    }
  }

  // Remove listeners
  removeAllListeners(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }
}

export const wsClient = new WebSocketClient();
export default wsClient;
