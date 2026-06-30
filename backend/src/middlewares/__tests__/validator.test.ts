import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validateRequest } from '../validator.js';

describe('Zod validateRequest Middleware', () => {
  const dummySchema = z.object({
    body: z.object({
      name: z.string({ required_error: 'Nome é obrigatório' }).min(2, 'Nome muito curto'),
      email: z.string({ required_error: 'E-mail é obrigatório' }).email('Formato inválido'),
    }).strict(), // strict para testar rejeição de campos extras
  });

  it('calls next() for valid payloads and updates req.body', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', validateRequest(dummySchema), (req, res) => {
      res.json({ success: true, body: req.body });
    });

    const response = await request(app)
      .post('/test')
      .send({ name: 'Maria', email: 'maria@example.com' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.body).toEqual({ name: 'Maria', email: 'maria@example.com' });
  });

  it('returns 400 with structured errors for missing or invalid fields', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', validateRequest(dummySchema), (req, res) => {
      res.json({ success: true });
    });

    const response = await request(app)
      .post('/test')
      .send({ name: 'M', email: 'invalid-email' });

    expect(response.status).toBe(400);
    expect(response.body.status).toBe('error');
    expect(response.body.message).toBe('Erro de validação de dados');
    expect(response.body.errors).toEqual([
      { field: 'name', message: 'Nome muito curto' },
      { field: 'email', message: 'Formato inválido' },
    ]);
  });

  it('rejects extra fields when strict is active in schema', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', validateRequest(dummySchema), (req, res) => {
      res.json({ success: true });
    });

    const response = await request(app)
      .post('/test')
      .send({ name: 'Maria', email: 'maria@example.com', role: 'ADMIN' });

    expect(response.status).toBe(400);
    expect(response.body.errors[0].message).toContain('Unrecognized key(s) in object');
  });

  it('strips non-mapped fields by default when strict is not active', async () => {
    const defaultSchema = z.object({
      body: z.object({
        name: z.string(),
      }),
    });

    const app = express();
    app.use(express.json());
    app.post('/test', validateRequest(defaultSchema), (req, res) => {
      res.json({ body: req.body });
    });

    const response = await request(app)
      .post('/test')
      .send({ name: 'Maria', extra: 'dangerous-input' });

    expect(response.status).toBe(200);
    expect(response.body.body.extra).toBeUndefined(); // O campo extra deve ser limpo/removido
    expect(response.body.body.name).toBe('Maria');
  });
});
