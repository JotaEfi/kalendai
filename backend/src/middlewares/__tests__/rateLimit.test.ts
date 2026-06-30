import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { authLimiter } from '../rateLimiter.js';

describe('Rate Limiter Middleware', () => {
  it('allows requests within limits and returns 429 when exceeded on auth paths', async () => {
    const app = express();
    app.use('/auth', authLimiter);
    app.get('/auth/test', (req, res) => res.send('ok'));

    // Realiza 5 chamadas com sucesso (limite = 5)
    for (let i = 0; i < 5; i++) {
      const res = await request(app).get('/auth/test');
      expect(res.status).toBe(200);
      expect(res.text).toBe('ok');
    }

    // A 6ª chamada deve retornar 429
    const resFail = await request(app).get('/auth/test');
    expect(resFail.status).toBe(429);
    expect(resFail.body.status).toBe('error');
    expect(resFail.body.message).toContain('Muitas tentativas de login/cadastro');
  });
});
