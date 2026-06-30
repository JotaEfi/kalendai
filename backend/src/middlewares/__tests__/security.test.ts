import { describe, it, expect, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { configureHelmet } from '../security.js';

describe('Helmet Security Middleware', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should set security headers and hide X-Powered-By', async () => {
    const app = express();
    app.use(configureHelmet());
    app.get('/test', (req, res) => {
      res.send('ok');
    });

    const response = await request(app).get('/test');

    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(response.headers['cross-origin-opener-policy']).toBe('same-origin');
  });

  it('should set HSTS header only in production', async () => {
    // Test without production env
    process.env.NODE_ENV = 'development';
    const appDev = express();
    appDev.use(configureHelmet());
    appDev.get('/test', (req, res) => res.send('ok'));
    const resDev = await request(appDev).get('/test');
    expect(resDev.headers['strict-transport-security']).toBeUndefined();

    // Test with production env
    process.env.NODE_ENV = 'production';
    const appProd = express();
    appProd.use(configureHelmet());
    appProd.get('/test', (req, res) => res.send('ok'));
    const resProd = await request(appProd).get('/test');
    expect(resProd.headers['strict-transport-security']).toBeDefined();
    expect(resProd.headers['strict-transport-security']).toContain('max-age=31536000');
  });
});
