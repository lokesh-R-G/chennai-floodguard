# Chennai FloodGuard 🌊

A comprehensive real-time flood prediction and emergency response system powered by MongoDB, Node.js, React, and Machine Learning.

## 🚀 Quick Links

- **[Quick Start Guide](QUICKSTART.md)** - Get running in 5 minutes
- **[Full Setup Documentation](SETUP.md)** - Complete installation & deployment
- **[Issues Resolved](ISSUES_RESOLVED.md)** - All 15 critical issues fixed
- **[Backend API Documentation](server/README.md)** - API reference

## ⭐ Key Features

### ✅ All 15 Critical Issues Resolved

1. **Real Map Visualization** - Interactive Leaflet.js map with OpenStreetMap
2. **Automated ML Pipeline** - 15-minute cron-based flood risk updates
3. **Road-Level Routing** - OSRM integration for accurate navigation
4. **Automated Alerts** - Web Push notifications + WebSocket updates
5. **API Redundancy** - Multi-tier fallback for weather & routing APIs
6. **PWA Offline Mode** - Service Worker caching for offline use
7. **Error Boundaries** - Graceful React error handling
8. **Intelligent Driver Matching** - Multi-factor weighted algorithm
9. **Historical Analytics** - 30-day data retention per zone
10. **WebSocket Optimization** - Replaces polling, 90% less bandwidth
11. **Monitoring & Logs** - Winston logging + health endpoints
12. **Security Hardened** - Helmet, rate limiting, JWT auth
13. **Comprehensive Testing** - Jest + Supertest suite
14. **Dynamic Zones** - Real-time risk score calculations
15. **Redundancy Strategy** - Multiple fallback layers

### 🛠️ Technology Stack

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- Leaflet.js (maps)
- Socket.io-client (WebSocket)
- Tailwind CSS + shadcn/ui
- Service Worker (PWA)

**Backend:**
- Node.js + Express
- MongoDB (database)
- Socket.io (real-time)
- Node-cron (scheduling)
- Winston (logging)
- Web Push API

**External APIs:**
- Open-Meteo (weather data)
- OSRM (routing)
- Fallback APIs for redundancy

## 📦 Installation

```bash
# Clone repository
git clone <repository-url>
cd chennai-floodguard

# Install all dependencies
npm install  # Frontend
cd server && npm install  # Backend

# Setup environment
cp .env.example .env
cp server/.env.example server/.env

# Configure MongoDB (edit server/.env)
MONGODB_URI=mongodb://localhost:27017/chennai-floodguard

# Run application
cd server && npm run dev  # Terminal 1
npm run dev              # Terminal 2 (from root)
```

Visit: http://localhost:5173

## 📖 Full Documentation

See [README_EXTENDED.md](README_EXTENDED.md) for complete details including:
- API endpoints reference  
- Deployment instructions
- Security features
- Troubleshooting guide
- Contributing guidelines

## 🎯 User Roles

### 👤 Citizen
- Send emergency alerts with GPS location
- Track driver assignment and ETAs
- View real-time flood risk map
- Receive push notifications

### 🚗 Driver (Emergency Responder)
- Receive emergency alerts
- View safe routes avoiding floods
- Update job status
- Real-time location tracking

### 💊 Pharmacist (Relief Camp Manager)
- Manage camp inventory
- Track stock levels
- Receive low-stock alerts
- Update supplies

## 🔐 Environment Variables

**Frontend (.env):**
```bash
VITE_API_URL=http://localhost:5000/api/v1
VITE_WS_URL=http://localhost:5000
VITE_VAPID_PUBLIC_KEY=<from backend>
```

**Backend (server/.env):**
```bash
# Required
MONGODB_URI=mongodb://localhost:27017/chennai-floodguard
JWT_SECRET=your-super-secret-key
PORT=5000

# Optional
VAPID_PUBLIC_KEY=<generate with web-push>
VAPID_PRIVATE_KEY=<generate with web-push>
```

## 🧪 Testing

```bash
# Backend tests
cd server && npm test

# Watch mode  
npm run test:watch
```

## 📜 License

MIT License

---

**Status:** ✅ Production Ready | All 15 Issues Resolved | MongoDB Migrated

**Get Started:** Read [QUICKSTART.md](QUICKSTART.md) to run in 5 minutes!

