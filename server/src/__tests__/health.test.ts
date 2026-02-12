import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/index.js';

describe('Health Check API', () => {
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/chennai-floodguard-test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('should return 200 for health check', async () => {
    const response = await request(app).get('/api/v1/health');
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.status).toBe('ok');
  });

  it('should return database status', async () => {
    const response = await request(app).get('/api/v1/health/db');
    
    expect(response.status).toBe(200);
    expect(response.body.database).toBe('connected');
  });
});
