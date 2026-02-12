# Chennai FloodGuard - Quick Start Guide

## 🚀 Quick Start (5 Minutes)

### Prerequisites Check

```bash
# Verify installations
node --version    # Should be v18+
mongo --version   # Should be v6.0+
python3 --version # Should be v3.8+
```

### Installation

```bash
# 1. Install backend dependencies
cd server
npm install
cp .env.example .env

# Edit .env - Set MongoDB URI at minimum
nano .env  # or use your preferred editor

# 2. Install frontend dependencies
cd ..
npm install
cp .env.example .env

# Edit frontend .env
nano .env
```

### Run Application

```bash
# Terminal 1: Start backend
cd server
npm run dev

# Terminal 2: Start frontend
cd ..
npm run dev
```

Visit: http://localhost:5173

### First-time Setup

1. **Register Account**: Click "Sign Up" and create a citizen account
2. **View Map**: See real-time flood zones on Leaflet map
3. **Test Emergency**: Click "Emergency Alert" to test the system

## 📝 Default Test Credentials

After first user registration, you can create test accounts:

```json
{
  "citizens": [
    { "email": "citizen@test.com", "password": "test1234", "role": "citizen" }
  ],
  "drivers": [
    { "email": "driver@test.com", "password": "test1234", "role": "driver" }
  ],
  "pharmacists": [
    { "email": "pharmacy@test.com", "password": "test1234", "role": "pharmacist" }
  ]
}
```

## 🧪 Testing Features

### 1. Test Flood Map
- Navigate to Dashboard
- Map shows 12 Chennai zones with color-coded risk levels
- Click markers for detailed zone information

### 2. Test Emergency System (Citizen)
- Login as citizen
- Click "Get Location" button
- Select emergency type
- Click "Send Emergency Alert"
- System auto-assigns nearest available driver

### 3. Test Driver Panel
- Login as driver
- Update status to "Available"
- Update location (or use GPS button)
- Accept incoming emergency requests
- Mark jobs as in-progress → completed

### 4. Test Inventory (Pharmacist)
- Login as pharmacist
- View camp inventory
- Update quantities (±10 buttons)
- Check low-stock alerts

### 5. Test Real-time Updates
- Open two browser windows
- Login as citizen in window 1, driver in window 2
- Create emergency in window 1
- See real-time update in window 2

### 6. Test Offline Mode
- Open browser DevTools
- Go to Network tab
- Select "Offline"
- App should show offline message but remain functional
- Static content loads from cache

## 🎯 Key Endpoints to Test

```bash
# Health Check
curl http://localhost:5000/api/v1/health

# Get Flood Zones
curl http://localhost:5000/api/v1/flood-zones

# Register User
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test1234",
    "fullName": "Test User",
    "role": "citizen"
  }'

# Login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test1234"
  }'
```

## 🔧 Common Issues & Fixes

### Issue: MongoDB Connection Error
```bash
# Fix: Start MongoDB
sudo systemctl start mongod

# Verify it's running
sudo systemctl status mongod
```

### Issue: Port 5000 Already in Use
```bash
# Fix: Change port in server/.env
PORT=5001

# Update frontend/.env accordingly
VITE_API_URL=http://localhost:5001/api/v1
VITE_WS_URL=http://localhost:5001
```

### Issue: WebSocket Not Connecting
```bash
# Fix: Check CORS settings in server/.env
CORS_ORIGIN=http://localhost:5173

# Restart backend
cd server
npm run dev
```

### Issue: Map Not Loading
```bash
# Fix: Install Leaflet CSS
# Already in package.json, just install dependencies
npm install
```

## 📊 Monitoring During Development

### View Logs
```bash
# Backend logs
tail -f server/logs/combined.log

# Backend errors
tail -f server/logs/error.log
```

### Check Database
```bash
# MongoDB shell
mongosh
use chennai-floodguard
db.floodZones.find().pretty()
db.incidents.find().pretty()
db.users.find().pretty()
```

### WebSocket Debugging
Open browser console:
```javascript
// Check WebSocket connection
console.log('WS Connected:', wsClient.getSocket()?.connected);

// Test manual event
wsClient.getSocket()?.emit('test', { message: 'hello' });
```

## 🎓 Learning Path

1. **Day 1**: Setup & Basic Features
   - Install and run the application
   - Create accounts for all roles
   - Test emergency alert flow

2. **Day 2**: Real-time Features
   - Test WebSocket updates
   - Monitor ML pipeline updates
   - Check push notifications

3. **Day 3**: Advanced Features
   - Test offline mode
   - Analyze safe route calculations
   - Review driver matching algorithm

4. **Day 4**: Production Prep
   - Configure environment for production
   - Test error scenarios
   - Review security settings

## 🌐 Production Deployment Checklist

- [ ] Set strong JWT_SECRET
- [ ] Configure HTTPS
- [ ] Set up MongoDB replica set
- [ ] Enable Redis caching
- [ ] Configure Sentry error tracking
- [ ] Set up VAPID keys for push notifications
- [ ] Configure rate limiting
- [ ] Set up SSL certificates
- [ ] Configure firewall rules
- [ ] Set up automated backups
- [ ] Configure monitoring alerts
- [ ] Test disaster recovery

## 📚 Next Steps

- Read [SETUP.md](SETUP.md) for detailed configuration
- Review [server/README.md](server/README.md) for API details
- Check [Architecture Documentation](#) for system design
- Join community discussions

## 🆘 Getting Help

If stuck, check:
1. Browser console for frontend errors
2. `server/logs/error.log` for backend errors
3. MongoDB logs: `/var/log/mongodb/mongod.log`
4. Network tab in DevTools for API failures

## ✅ Verification Checklist

After setup, verify all features:

- [ ] Map displays with 12 Chennai zones
- [ ] Zones have color-coded risk levels
- [ ] Emergency alerts create incidents
- [ ] Drivers receive notifications
- [ ] WebSocket updates work in real-time
- [ ] Offline mode shows cached content
- [ ] Error boundaries catch errors gracefully
- [ ] ML pipeline updates every 15 minutes
- [ ] Push notifications work (HTTPS required)
- [ ] Health endpoints return OK status

**All set! 🎉 Your Chennai FloodGuard system is ready for development.**
