

## Project Structure

```
chennai-floodguard/
├── server/                 # Backend (MongoDB + Express)
│   ├── src/
│   │   ├── models/        # MongoDB schemas
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Business logic
│   │   ├── middleware/    # Auth, validation
│   │   ├── websocket/     # Socket.io handlers
│   │   └── config/        # DB, logger config
│   └── package.json
│
├── src/                   # Frontend (React)
│   ├── components/        # UI components
│   ├── lib/              # API clients, utils
│   ├── pages/            # Page components
│   └── hooks/            # Custom React hooks
│
├── public/
│   ├── service-worker.js  # PWA offline support
│   ├── manifest.json      # PWA manifest
│   └── models/           # ML models
│
├── QUICKSTART.md         # 5-minute setup guide
├── SETUP.md              # Full documentation
├── ISSUES_RESOLVED.md    # All fixes documented
└── README.md             # This file
```

## 🎯 User Roles

### 👤 Citizen
- Send emergency alerts with GPS location
- Track driver assignment and ETAs
- View real-time flood risk map
- Receive push notifications

### 🚗 Driver (Emergency Responder)
- Receive emergency alerts
- View safe routes avoiding floods
- Update job status (assigned → in progress → completed)
- Real-time location tracking

### 💊 Pharmacist (Relief Camp Manager)
- Manage camp inventory
- Track stock levels
- Receive low-stock alerts
- Update supplies

## 🔑 Environment Variables

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
REDIS_HOST=localhost
VAPID_PUBLIC_KEY=<generate with web-push>
VAPID_PRIVATE_KEY=<generate with web-push>
SENTRY_DSN=<error tracking>
ML_UPDATE_CRON=0 */15 * * *
```

## 🧪 Testing

```bash
# Backend tests
cd server
npm test

# Watch mode
npm run test:watch
```

## 🚀 Deployment

### Docker
```bash
docker-compose up -d
```

### PM2 (Production)
```bash
# Backend
cd server
npm run build
pm2 start dist/index.js --name floodguard-api

# Frontend (with nginx or PM2)
npm run build
pm2 serve dist 3000 --name floodguard-frontend

pm2 save
pm2 startup
```

### Environment Checklist
- [ ] Set strong JWT_SECRET
- [ ] Configure MongoDB replica set
- [ ] Enable HTTPS
- [ ] Set up Redis caching
- [ ] Configure VAPID keys
- [ ] Enable Sentry error tracking
- [ ] Set up automated backups
- [ ] Configure firewall rules

## 📊 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register user
- `POST /api/v1/auth/login` - Login

### Flood Zones
- `GET /api/v1/flood-zones` - Get all zones
- `GET /api/v1/flood-zones/:id/history` - Historical data

### Incidents
- `POST /api/v1/incidents` - Create emergency
- `GET /api/v1/incidents` - List incidents
- `PATCH /api/v1/incidents/:id/status` - Update status

### Drivers
- `GET /api/v1/drivers/:id/current-job` - Get assigned job
- `PATCH /api/v1/drivers/:id/location` - Update location
- `PATCH /api/v1/drivers/:id/status` - Update availability

### Health
- `GET /api/v1/health` - System health
- `GET /api/v1/health/db` - Database connectivity

Full API documentation: [server/README.md](server/README.md)

## 🎨 Features Showcase

### Interactive Flood Map
- 12 Chennai zones with real-time risk scores
- Color-coded circles (Green → Amber → Orange → Red)
- Clickable markers with detailed zone info
- Auto-zoom to fit all zones
- Legend with risk levels

### Smart Routing
- OSRM road-level routing
- Flood zone avoidance
- Alternative route calculation
- Distance & time estimates
- Waypoint visualization

### Real-Time Updates
- WebSocket connections for instant sync
- Push notifications for critical events
- Live driver location tracking
- Automatic zone risk updates

### Offline Capability
- Works without internet after first load
- Cached flood data
- Queued requests sync when online
- Service Worker manages caching

## 🔐 Security Features

- Helmet.js security headers
- JWT token authentication
- Bcrypt password hashing (12 rounds)
- Rate limiting (100 req/15min)
- CORS protection
- Input validation
- MongoDB injection prevention

## 📈 Performance

- WebSocket replaces polling (90% bandwidth reduction)
- 10-minute weather data caching
- MongoDB indexes for fast queries
- Lazy loading for large datasets
- Compression middleware
- Service Worker caching

## 🆘 Troubleshooting

**MongoDB won't start:**
```bash
sudo systemctl start mongod
sudo systemctl status mongod
```

**Port already in use:**
```bash
lsof -i :5000
kill -9 <PID>
```

**WebSocket connection fails:**
- Check CORS_ORIGIN in server/.env
- Verify no proxy blocking WebSocket upgrade

**Maps not loading:**
```bash
npm install leaflet react-leaflet
```

See [QUICKSTART.md](QUICKSTART.md) for more solutions.

## 📜 License

MIT License - See LICENSE file

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

## 👥 Authors

Built for Chennai flood emergency response.

## 🙏 Acknowledgments

- Open-Meteo for free weather API
- OpenStreetMap & OSRM for routing
- MongoDB for scalable database
- React & Vite communities

---

**Status:** ✅ Production Ready | All 15 Issues Resolved | MongoDB Migrated

**Get Started:** Read [QUICKSTART.md](QUICKSTART.md) to run in 5 minutes!
