# 🚀 Chennai FloodGuard - Deployment Checklist

Use this checklist to ensure proper setup and deployment of the Chennai FloodGuard system.

## ✅ Pre-Deployment Checklist

### 1. System Requirements
- [ ] Node.js v18+ installed (`node --version`)
- [ ] MongoDB v6.0+ installed (`mongod --version`)
- [ ] npm or yarn package manager
- [ ] Git installed
- [ ] 4GB+ RAM available
- [ ] 10GB+ disk space available

### 2. Clone & Install
- [ ] Repository cloned
- [ ] Frontend dependencies installed (`npm install`)
- [ ] Backend dependencies installed (`cd server && npm install`)
- [ ] TypeScript compilation successful (`cd server && npx tsc --noEmit`)

### 3. MongoDB Setup
- [ ] MongoDB service running (`sudo systemctl status mongod`)
- [ ] Database created (auto-creates on first connection)
- [ ] Connection string configured in `server/.env`
- [ ] Test connection successful (use MongoDB Compass or CLI)

### 4. Environment Configuration

#### Frontend (.env)
- [ ] File created from `.env.example`
- [ ] `VITE_API_URL` set to backend URL
- [ ] `VITE_WS_URL` set to WebSocket URL
- [ ] `VITE_VAPID_PUBLIC_KEY` configured (after generating VAPID keys)

#### Backend (server/.env)
- [ ] File created from `server/.env.example`
- [ ] `MONGODB_URI` configured (local or Atlas)
- [ ] `JWT_SECRET` set to strong random string (32+ chars)
- [ ] `PORT` set (default: 5000)
- [ ] `CORS_ORIGIN` matches frontend URL
- [ ] `NODE_ENV` set (development/production)

### 5. Security Configuration
- [ ] VAPID keys generated (`npx web-push generate-vapid-keys`)
- [ ] `VAPID_PUBLIC_KEY` added to backend .env
- [ ] `VAPID_PRIVATE_KEY` added to backend .env
- [ ] `VAPID_SUBJECT` email configured
- [ ] Strong `JWT_SECRET` generated (e.g., `openssl rand -base64 32`)
- [ ] Rate limiting configured (default: 100 req/15min)

### 6. External APIs (Optional)
- [ ] WeatherAPI.com API key obtained (fallback weather)
- [ ] Added to `WEATHERAPI_KEY` in server/.env
- [ ] OSRM endpoint configured (uses public by default)
- [ ] Sentry DSN configured for error tracking (optional)

### 7. Testing
- [ ] Backend tests pass (`cd server && npm test`)
- [ ] Health endpoint responds (`curl http://localhost:5000/api/v1/health`)
- [ ] Database health check passes (`curl http://localhost:5000/api/v1/health/db`)
- [ ] MongoDB indexes created (check logs on first start)
- [ ] Flood zones initialized (12 Chennai zones auto-created)

---

## 🏃 Development Deployment

### Terminal 1: Backend Server
```bash
cd server
npm run dev

# Expected output:
# > Server running on port 5000
# > MongoDB connected successfully
# > WebSocket server initialized
# > ML Pipeline started (runs every 15 minutes)
# > Flood zones initialized with 12 zones
```

### Terminal 2: Frontend Development Server
```bash
npm run dev

# Expected output:
# > VITE ready in 500ms
# > Local: http://localhost:5173/
# > Network: use --host to expose
```

### Verification Steps
- [ ] Backend accessible at http://localhost:5000
- [ ] Frontend accessible at http://localhost:5173
- [ ] No console errors in browser DevTools
- [ ] No TypeScript errors in terminal
- [ ] Service Worker registers successfully (check Application tab in DevTools)
- [ ] WebSocket connection established (check Network WS tab)

---

## 🌐 Production Deployment Checklist

### 1. Server Setup
- [ ] Production server provisioned (VPS/Cloud)
- [ ] Domain name configured
- [ ] SSL certificate installed (Let's Encrypt)
- [ ] Firewall configured (allow 80, 443, 27017)
- [ ] SSH key authentication enabled
- [ ] Fail2ban or similar brute-force protection

### 2. MongoDB Production
- [ ] MongoDB Atlas cluster created OR
- [ ] Self-hosted MongoDB with replica set
- [ ] Automated backups configured
- [ ] Database user with limited permissions
- [ ] Connection string uses `mongodb+srv://` (Atlas)
- [ ] IP whitelist configured (Atlas)
- [ ] Monitoring enabled

### 3. Environment Variables (Production)
- [ ] `NODE_ENV=production` set
- [ ] Strong `JWT_SECRET` (not reused from dev)
- [ ] Production MongoDB URI
- [ ] Production frontend URL in `CORS_ORIGIN`
- [ ] VAPID keys generated specifically for production
- [ ] API keys for external services
- [ ] Sentry DSN for error tracking
- [ ] Log level set to `warn` or `error`

### 4. Build & Deploy Backend
```bash
# Build TypeScript
cd server
npm run build

# Verify dist/ folder created
ls dist/

# Test production build
node dist/index.js

# Process manager (choose one)
```

#### Option A: PM2
- [ ] PM2 installed globally (`npm install -g pm2`)
- [ ] Backend started with PM2 (`pm2 start dist/index.js --name floodguard-api`)
- [ ] Auto-restart on crash enabled (`pm2 startup`)
- [ ] PM2 ecosystem file created (optional)
- [ ] Logs configured (`pm2 logs floodguard-api`)

#### Option B: Docker
- [ ] Dockerfile created for backend
- [ ] docker-compose.yml configured
- [ ] Images built (`docker-compose build`)
- [ ] Containers started (`docker-compose up -d`)
- [ ] Health check configured
- [ ] Volumes for logs and data

#### Option C: Kubernetes
- [ ] Deployment manifests created
- [ ] ConfigMaps for environment variables
- [ ] Secrets for sensitive data
- [ ] Services for load balancing
- [ ] Ingress for routing
- [ ] Horizontal Pod Autoscaler configured

### 5. Build & Deploy Frontend
```bash
# Build production bundle
npm run build

# Verify dist/ folder created
ls dist/

# Test production build locally
npx serve dist -p 3000
```

#### Hosting Options (choose one)
- [ ] **Vercel**: Connected to GitHub, auto-deploys on push
- [ ] **Netlify**: Drag-and-drop or CLI deploy
- [ ] **nginx**: Static files served from `/var/www/html`
- [ ] **PM2**: `pm2 serve dist 3000 --name floodguard-frontend`
- [ ] **S3 + CloudFront**: AWS static hosting

### 6. Nginx Configuration (if self-hosting)
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    
    # Frontend
    location / {
        root /var/www/floodguard;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

- [ ] Nginx configuration file created
- [ ] Configuration tested (`sudo nginx -t`)
- [ ] Nginx reloaded (`sudo systemctl reload nginx`)
- [ ] SSL certificate auto-renewal configured

### 7. Monitoring & Logging
- [ ] Sentry error tracking configured
- [ ] Winston logs rotating properly (check `server/logs/`)
- [ ] MongoDB monitoring enabled (Atlas or self-hosted tools)
- [ ] Uptime monitoring (UptimeRobot, Pingdom)
- [ ] Performance monitoring (New Relic, Datadog)
- [ ] Log aggregation (Logstash, Papertrail)

### 8. Backup Strategy
- [ ] Automated MongoDB backups (daily recommended)
- [ ] Backup retention policy (30 days minimum)
- [ ] Backup restoration tested
- [ ] Environment variables backed up securely
- [ ] Code repository backed up (GitHub/GitLab)

### 9. Security Hardening
- [ ] HTTPS enforced (no HTTP traffic)
- [ ] Security headers configured (Helmet enabled)
- [ ] Rate limiting active and tested
- [ ] CORS properly configured (not `*` in production)
- [ ] MongoDB not exposed publicly
- [ ] No sensitive data in logs
- [ ] Dependencies updated (`npm audit`)
- [ ] Secrets not committed to Git (.env in .gitignore)

### 10. Performance Optimization
- [ ] Frontend assets minified and compressed
- [ ] Images optimized (if any added later)
- [ ] Lazy loading implemented where needed
- [ ] MongoDB indexes verified (`db.collection.getIndexes()`)
- [ ] Redis caching layer (optional, for high traffic)
- [ ] CDN for static assets (optional)
- [ ] Gzip/Brotli compression enabled

---

## 🧪 Post-Deployment Testing

### Functional Testing
- [ ] User registration works
- [ ] Login returns JWT token
- [ ] Flood map displays 12 Chennai zones
- [ ] Emergency incident creation works
- [ ] Driver auto-assignment triggers
- [ ] Real-time updates via WebSocket functional
- [ ] Push notifications work (HTTPS required)
- [ ] Service Worker caches assets
- [ ] Offline mode displays cached data
- [ ] Error boundaries catch errors gracefully

### API Testing
```bash
# Health check
curl https://yourdomain.com/api/v1/health

# Database health
curl https://yourdomain.com/api/v1/health/db

# Register user
curl -X POST https://yourdomain.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
    "name": "Test User",
    "phone": "1234567890",
    "role": "citizen"
  }'

# Login
curl -X POST https://yourdomain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'

# Get flood zones
curl https://yourdomain.com/api/v1/flood-zones
```

### Load Testing (Optional)
- [ ] Apache Bench: `ab -n 1000 -c 10 https://yourdomain.com/`
- [ ] Artillery: `artillery quick --count 100 --num 10 https://yourdomain.com/`
- [ ] k6 load testing script
- [ ] Monitor server resources during load test

### Security Testing
- [ ] OWASP ZAP scan
- [ ] SSL Labs test (https://www.ssllabs.com/ssltest/)
- [ ] Security headers check (https://securityheaders.com/)
- [ ] SQL injection attempts (should fail)
- [ ] XSS attempts (should be sanitized)
- [ ] CSRF protection verified

---

## 📊 Monitoring Dashboard

### Key Metrics to Track
- [ ] Server uptime %
- [ ] API response times (avg, p95, p99)
- [ ] Error rate %
- [ ] Active WebSocket connections
- [ ] MongoDB query performance
- [ ] Memory usage
- [ ] CPU usage
- [ ] Disk space
- [ ] Network bandwidth

### Alerts to Configure
- [ ] Server down
- [ ] API error rate > 5%
- [ ] MongoDB connection failures
- [ ] Memory usage > 80%
- [ ] Disk space < 20%
- [ ] SSL certificate expiring soon
- [ ] Backup failures

---

## 🎯 Final Checklist

- [ ] All environment variables configured
- [ ] MongoDB production-ready
- [ ] Backend deployed and running
- [ ] Frontend deployed and accessible
- [ ] HTTPS enabled
- [ ] Monitoring configured
- [ ] Backups automated
- [ ] Security hardened
- [ ] Performance optimized
- [ ] Team trained on deployment process
- [ ] Documentation updated
- [ ] Runbook created for common issues

---

## 📞 Emergency Response

### If Backend Crashes
```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs floodguard-api --lines 100

# Restart
pm2 restart floodguard-api

# If persistent, check MongoDB
sudo systemctl status mongod
```

### If Database Issues
```bash
# Check MongoDB logs
sudo tail -n 100 /var/log/mongodb/mongod.log

# Restart MongoDB
sudo systemctl restart mongod

# Check disk space
df -h
```

### If High Traffic
```bash
# Scale PM2 instances
pm2 scale floodguard-api 4

# Or use cluster mode
pm2 start dist/index.js -i max --name floodguard-api
```

---

## 🎓 Resources

- **MongoDB Atlas:** https://www.mongodb.com/cloud/atlas
- **Let's Encrypt SSL:** https://letsencrypt.org/
- **PM2 Documentation:** https://pm2.keymetrics.io/
- **Nginx Documentation:** https://nginx.org/en/docs/
- **VAPID Key Generator:** `npx web-push generate-vapid-keys`
- **JWT Debugger:** https://jwt.io/

---

**Last Updated:** 2024-01-XX  
**Maintained By:** Chennai FloodGuard Team  
**Status:** ✅ Production Ready
