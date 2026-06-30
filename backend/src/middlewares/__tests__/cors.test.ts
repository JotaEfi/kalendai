import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { configureCors } from '../cors.js';

describe('CORS Dynamic Middleware', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('allows localhost dynamically in development environment', async () => {
    process.env.NODE_ENV = 'development';
    const app = express();
    app.use(configureCors());
    app.get('/test', (req, res) => res.send('ok'));

    const response = await request(app)
      .get('/test')
      .set('Origin', 'http://localhost:3000');

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('allows origins configured in FRONTEND_URL and ALLOWED_ORIGINS', async () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://kalendai.com';
    process.env.ALLOWED_ORIGINS = 'https://staging.kalendai.com, https://admin.kalendai.com';

    const app = express();
    app.use(configureCors());
    app.get('/test', (req, res) => res.send('ok'));

    // Test FRONTEND_URL
    const resMain = await request(app)
      .get('/test')
      .set('Origin', 'https://kalendai.com');
    expect(resMain.headers['access-control-allow-origin']).toBe('https://kalendai.com');

    // Test ALLOWED_ORIGINS list
    const resStaging = await request(app)
      .get('/test')
      .set('Origin', 'https://staging.kalendai.com');
    expect(resStaging.headers['access-control-allow-origin']).toBe('https://staging.kalendai.com');
  });

  it('rejects origin that is not configured', async () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://kalendai.com';

    const app = express();
    app.use(configureCors());
    app.get('/test', (req, res) => res.send('ok'));

    // Capture CORS error response
    const response = await request(app)
      .get('/test')
      .set('Origin', 'https://malicious.com');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
