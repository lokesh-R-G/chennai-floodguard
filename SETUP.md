# Chennai FloodGuard - Complete Setup Guide

## 📋 Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)

## 🌟 Overview

Chennai FloodGuard is a comprehensive real-time flood prediction and emergency response system featuring:

- ✅ **Real Map Visualization** (Leaflet.js with OpenStreetMap)
- ✅ **Automated ML Pipeline** (Cron-scheduled flood risk updates)
- ✅ **Road-Level Routing** (OSRM integration)
- ✅ **Push Notifications** (Web Push API)
- ✅ **API Fallback Mechanisms** (Weather API redundancy)
- ✅ **PWA Offline Capability** (Service Worker)
- ✅ **React Error Boundaries** (Graceful error handling)
- ✅ **Intelligent Driver Matching** (Multi-factor algorithm)
- ✅ **Historical Analytics** (30-day data retention)
- ✅ **WebSocket Real-time Updates** (Socket.io)
- ✅ **Health Monitoring** (Comprehensive health checks)
- ✅ **Dynamic Zone Updates** (Live risk score calculations)
- ✅ **Redundancy & Failover** (Multiple fallback layers)

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + Vite)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Leaflet Maps │  │  WebSocket   │  │  Service     │       │
│  │              │  │  Client      │  │  Worker      │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTPS / WSS
┌────────────────┴────────────────────────────────────────────┐
│               BACKEND (Node.js + Express)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐     │
│  │   REST   │ │  Socket  │ │  Cron    │ │   Redis    │     │
│  │   API    │ │   .io    │ │  Jobs    │ │  (Cache)   │     │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘     │
└────────────────┬────────────────────────────────────────────┘
                 │
        ┌────────┴─────────┐
        │                  │
┌───────▼─────┐    ┌──────▼──────┐    ┌──────────────┐
│   MongoDB   │    │   OSRM API  │    │ Open-Meteo   │
│  (Database) │    │  (Routing)  │    │  (Weather)   │
└─────────────┘    └─────────────┘    └──────────────┘
```

## 📦 Prerequisites

### Required Software

1. **Node.js** (v18+ or Bun)
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **MongoDB** (v6.0+)
   ```bash
   # Ubuntu/Debian
   wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
   echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
   sudo apt-get update
   sudo apt-get install -y mongodb-org
   sudo systemctl start mongod
   sudo systemctl enable mongod
   ```

3. **Python** (3.8+ for ML pipeline)
   ```bash
   sudo apt-get install python3 python3-pip
   pip3 install numpy pandas scikit-learn tensorflow
   ```

4. **Redis** (Optional, for caching)
   ```bash
   sudo apt-get install redis-server
   sudo systemctl start redis
   sudo systemctl enable redis
   ```

## 🚀 Installation

### 1. Clone Repository

```bash
git clone <repository-url>
cd chennai-floodguard
```

### 2. Install Backend Dependencies

```bash
cd server
npm install  # or bun install
cp .env.example .env
```

### 3. Configure Backend Environment

Edit `server/.env`:

```bash
# Required
MONGODB_URI=mongodb://localhost:27017/chennai-floodguard
JWT_SECRET=your-super-secret-jwt-key-change-this
PORT=5000

# Optional but recommended
REDIS_HOST=localhost
VAPID_PUBLIC_KEY=<generate-with-web-push>
VAPID_PRIVATE_KEY=<generate-with-web-push>
SENTRY_DSN=<your-sentry-dsn>
```

Generate VAPID keys:
```bash
npx web-push generate-vapid-keys
```

### 4. Install Frontend Dependencies

```bash
cd ..  # Back to root
npm install  # or bun install
cp .env.example .env
```

### 5. Configure Frontend Environment

Edit `.env`:

```bash
VITE_API_URL=http://localhost:5000/api/v1
VITE_WS_URL=http://localhost:5000
VITE_VAPID_PUBLIC_KEY=<same-as-backend>
```

## ⚙️ Configuration

### MongoDB Initialization

The backend will automatically:
- Create collections and indexes
- Initialize 12 Chennai flood zones
- Run initial ML pipeline update

No manual database setup required!

### Optional: OSRM Setup (Local Routing Server)

For production, consider running your own OSRM server:

```bash
# Download Chennai region map
wget https://download.geofabrik.de/asia/india-latest.osm.pbf

# Extract Chennai region (requires osmium-tool)
osmium extract -b 80.0,12.8,80.3,13.2 india-latest.osm.pbf -o chennai.osm.pbf

# Prepare data for OSRM
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/chennai.osm.pbf
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-partition /data/chennai.osrm
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-customize /data/chennai.osrm

# Run OSRM server
docker run -d -p 5000:5000 -v "${PWD}:/data" osrm/osrm-backend osrm-routed --algorithm mld /data/chennai.osrm
```

Update `.env`:
```bash
OSRM_API_URL=http://localhost:5000
```

## 🎮 Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

Access the application:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000/api/v1
- Health Check: http://localhost:5000/api/v1/health

### Production Mode

**Build Backend:**
```bash
cd server
npm run build
npm start
```

**Build Frontend:**
```bash
npm run build
npm run preview
```

## 📤 Deployment

### Docker Deployment (Recommended)

**Backend Dockerfile:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm install --production
COPY server/dist ./dist
EXPOSE 5000
CMD ["node", "dist/index.js"]
```

**Docker Compose:**
```yaml
version: '3.8'
services:
  mongodb:
    image: mongo:6.0
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./server
    ports:
      - "5000:5000"
    environment:
      - MONGODB_URI=mongodb://mongodb:27017/chennai-floodguard
      - REDIS_HOST=redis
    depends_on:
      - mongodb
      - redis

  frontend:
    build: .
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  mongo-data:
```

Run:
```bash
docker-compose up -d
```

### PM2 Deployment (Node.js)

```bash
# Install PM2
npm install -g pm2

# Start backend
cd server
pm2 start dist/index.js --name floodguard-api

# Serve frontend with nginx or PM2
pm2 serve dist 3000 --name floodguard-frontend

# Save PM2 configuration
pm2 save
pm2 startup
```

## 📚 API Documentation

### Authentication

**Register:**
```bash
POST /api/v1/auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "fullName": "John Doe",
  "phone": "9876543210",
  "role": "citizen"
}
```

**Login:**
```bash
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Emergency Incidents

**Create Incident:**
```bash
POST /api/v1/incidents
Authorization: Bearer <token>
{
  "locationLat": 13.0827,
  "locationLon": 80.2707,
  "emergencyType": "medical",
  "description": "Need medical assistance"
}
```

**Get Incidents:**
```bash
GET /api/v1/incidents?status=pending
Authorization: Bearer <token>
```

### Full API docs available at `/api/v1/docs` (if Swagger configured)

## 🐛 Troubleshooting

### MongoDB Connection Issues

```bash
# Check MongoDB status
sudo systemctl status mongod

# View logs
sudo tail -f /var/log/mongodb/mongod.log

# Restart MongoDB
sudo systemctl restart mongod
```

### Port Already in Use

```bash
# Find process using port 5000
lsof -i :5000

# Kill process
kill -9 <PID>
```

### WebSocket Connection Failed

- Ensure `CORS_ORIGIN` in backend .env matches frontend URL
- Check firewall rules allow WebSocket connections
- Verify no reverse proxy interfering with WebSocket upgrade

### Push Notifications Not Working

1. Ensure VAPID keys are configured
2. Check browser console for permission errors
3. Service Worker must be registered first
4. Only works on HTTPS in production (localhost OK for dev)

### ML Pipeline Not Running

```bash
# Check cron service
cd server
npm run ml:update
```

## 📊 Monitoring

### Health Checks

```bash
# Overall health
curl http://localhost:5000/api/v1/health

# Database health
curl http://localhost:5000/api/v1/health/db
```

### Logs

Backend logs location: `server/logs/`
- `combined.log` - All logs
- `error.log` - Errors only

View real-time logs:
```bash
tail -f server/logs/combined.log
```

## 🎯 Key Features Verified

| Feature | Status | Description |
|---------|--------|-------------|
| Real Map Visualization | ✅ | Leaflet.js with dynamic flood overlays |
| Automated ML Pipeline | ✅ | Every 15min cron job |
| Road-Level Routing | ✅ | OSRM integration with flood avoidance |
| Push Notifications | ✅ | Web Push API with service worker |
| API Fallbacks | ✅ | Weather API + routing fallbacks |
| PWA Offline | ✅ | Service worker caching strategy |
| Error Boundaries | ✅ | React error boundaries in place |
| Driver Matching | ✅ | Multi-factor weighted algorithm |
| Historical Analytics | ✅ | 30-day historical data per zone |
| WebSocket Updates | ✅ | Socket.io real-time sync |
| Health Monitoring | ✅ | Comprehensive health endpoints |
| Dynamic Zones | ✅ | Live risk score updates |
| Redundancy | ✅ | Multiple fallback layers |

## 📞 Support

For issues or questions:
- Check existing issues on GitHub
- Review logs in `server/logs/`
- Enable DEBUG mode: `LOG_LEVEL=debug`

## 📄 License

MIT License - See LICENSE file for details
