import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Custom metrics ──────────────────────────
const errorRate = new Rate('error_rate');
const authLatency = new Trend('auth_latency', true);
const incidentLatency = new Trend('incident_latency', true);
const healthLatency = new Trend('health_latency', true);
const floodZoneLatency = new Trend('flood_zone_latency', true);

// ── Configuration ───────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const API = `${BASE_URL}/api/v1`;

export const options = {
  scenarios: {
    // Smoke test: sanity check
    smoke: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      startTime: '0s',
      tags: { scenario: 'smoke' },
    },
    // Load test: normal traffic
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '3m', target: 50 },
        { duration: '1m', target: 0 },
      ],
      startTime: '35s',
      tags: { scenario: 'load' },
    },
    // Stress test: find breaking point
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '30s', target: 300 },
        { duration: '1m', target: 0 },
      ],
      startTime: '6m',
      tags: { scenario: 'stress' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    error_rate: ['rate<0.05'],
    auth_latency: ['p(95)<800'],
    incident_latency: ['p(95)<1000'],
    health_latency: ['p(95)<200'],
  },
};

/* ── Helpers ─────────────────────────────────── */

function registerUser(i) {
  const payload = JSON.stringify({
    email: `loadtest_${i}_${Date.now()}@test.com`,
    password: 'TestPass123!',
    fullName: `Load User ${i}`,
    role: 'citizen',
  });
  const res = http.post(`${API}/auth/register`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  authLatency.add(res.timings.duration);
  return res;
}

function loginUser(email) {
  const res = http.post(`${API}/auth/login`, JSON.stringify({
    email,
    password: 'TestPass123!',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  authLatency.add(res.timings.duration);
  return res;
}

/* ── Main test function ──────────────────────── */

export default function () {
  const vu = __VU;

  group('Health Check', () => {
    const res = http.get(`${API}/health`);
    healthLatency.add(res.timings.duration);
    const ok = check(res, {
      'health status 200': (r) => r.status === 200,
      'health body ok': (r) => r.json('status') === 'ok',
    });
    errorRate.add(!ok);
  });

  sleep(0.5);

  group('Auth Flow', () => {
    // Register
    const regRes = registerUser(vu);
    const regOk = check(regRes, {
      'register 201': (r) => r.status === 201,
      'register has token': (r) => !!r.json('data.token'),
    });
    errorRate.add(!regOk);

    if (regRes.status !== 201) return;

    const token = regRes.json('data.token');
    const email = regRes.json('data.user.email');

    // Login
    const loginRes = loginUser(email);
    const loginOk = check(loginRes, {
      'login 200': (r) => r.status === 200,
      'login has token': (r) => !!r.json('data.token'),
    });
    errorRate.add(!loginOk);
  });

  sleep(0.5);

  group('Flood Zones', () => {
    const res = http.get(`${API}/flood-zones`);
    floodZoneLatency.add(res.timings.duration);
    const ok = check(res, {
      'zones 200': (r) => r.status === 200,
    });
    errorRate.add(!ok);
  });

  sleep(0.3);

  group('Health DB endpoint', () => {
    const res = http.get(`${API}/health/db`);
    const ok = check(res, {
      'db health 200': (r) => r.status === 200,
    });
    errorRate.add(!ok);
  });

  sleep(1);
}

/* ── Lifecycle hooks ─────────────────────────── */

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
    'k6-results.json': JSON.stringify(data, null, 2),
  };
}

// k6 built-in
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.3/index.js';
