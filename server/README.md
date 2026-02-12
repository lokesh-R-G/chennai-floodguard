# Chennai FloodGuard - Backend Server

Backend API server for the Chennai FloodGuard emergency response system.

## Features

- **MongoDB Database** - Scalable NoSQL database
- **Express.js REST API** - Fast and minimal web framework
- **WebSocket Support** - Real-time bidirectional communication
- **JWT Authentication** - Secure token-based auth
- **Push Notifications** - Web Push API for alerts
- **ML Pipeline Automation** - Automated flood risk updates
- **Road-Level Routing** - OSRM integration for safe routes
- **Intelligent Driver Matching** - Optimized assignment algorithm
- **Weather Integration** - Open-Meteo API with fallback
- **Health Monitoring** - Health check endpoints
- **Error Tracking** - Sentry integration (optional)
- **Rate Limiting** - Protection against abuse
- **Comprehensive Logging** - Winston logger

## Prerequisites

- Node.js 18+ or Bun
- MongoDB 6.0+
- Python 3.8+ (for ML pipeline)
- Redis (optional, for caching)

## Installation

```bash
# Install dependencies
npm install
# or
bun install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
```

## Environment Variables

See `.env.example` for all available configuration options.

Key variables:
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `OPEN_METEO_API_URL` - Weather API endpoint
- `OSRM_API_URL` - Routing service endpoint
- `CORS_ORIGIN` - Frontend URL

## Running the Server

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/push-subscription` - Save push subscription

### Incidents
- `GET /api/v1/incidents` - Get all incidents
- `POST /api/v1/incidents` - Create emergency incident
- `GET /api/v1/incidents/:id` - Get single incident
- `PATCH /api/v1/incidents/:id/status` - Update incident status
- `GET /api/v1/incidents/citizen/:citizenId` - Get citizen's active incident

### Drivers
- `GET /api/v1/drivers/:id` - Get driver details
- `PATCH /api/v1/drivers/:id/status` - Update driver status
- `PATCH /api/v1/drivers/:id/location` - Update driver location
- `GET /api/v1/drivers/:id/current-job` - Get current job
- `GET /api/v1/drivers/available` - Get available drivers

### Flood Zones
- `GET /api/v1/flood-zones` - Get all flood zones
- `GET /api/v1/flood-zones/:id` - Get single zone
- `GET /api/v1/flood-zones/:id/history` - Get historical data
- `GET /api/v1/flood-zones/high-risk` - Get high-risk zones

### Camps & Inventory
- `GET /api/v1/camps` - Get all camps
- `GET /api/v1/camps/:id/inventory` - Get camp inventory
- `PATCH /api/v1/camps/:campId/inventory/:itemId` - Update inventory
- `POST /api/v1/camps/:campId/inventory` - Add inventory item
- `GET /api/v1/camps/low-stock` - Get low stock items

### Health
- `GET /api/v1/health` - Overall health check
- `GET /api/v1/health/db` - Database health check

## WebSocket Events

### Client → Server
- `driver:location` - Update driver location
- `floodZones:subscribe` - Subscribe to flood zone updates
- `incidents:subscribe` - Subscribe to incident updates

### Server → Client
- `floodZone:updated` - Flood zone data changed
- `incident:updated` - Incident status changed
- `incident:new` - New incident created
- `driver:assigned` - Driver assigned to incident
- `driver:locationUpdated` - Driver location changed

## ML Pipeline

The ML pipeline automatically updates flood risk scores every 15 minutes (configurable via `ML_UPDATE_CRON`).

Manual trigger:
```bash
npm run ml:update
```

## Testing

```bash
npm test
npm run test:watch
```

## Deployment

### Docker (Recommended)
```bash
docker build -t chennai-floodguard-api .
docker run -p 5000:5000 --env-file .env chennai-floodguard-api
```

### PM2
```bash
npm install -g pm2
pm2 start dist/index.js --name floodguard-api
pm2 save
pm2 startup
```

## Architecture

```
src/
├── config/         # Configuration files
├── models/         # MongoDB models
├── routes/         # API routes
├── services/       # Business logic services
├── middleware/     # Express middleware
├── websocket/      # WebSocket handlers
└── index.ts        # Main entry point
```

## Security Features

- Helmet.js for security headers
- Rate limiting per IP
- JWT token authentication
- Password hashing with bcrypt
- Input validation
- MongoDB injection prevention
- CORS protection

## Monitoring

- Winston logging (file + console)
- Sentry error tracking (optional)
- Health check endpoints
- Real-time metrics via WebSocket

## License

MIT
