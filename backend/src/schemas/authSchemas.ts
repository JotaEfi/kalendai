import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z.string({ required_error: 'E-mail é obrigatório' }).email('Formato de e-mail inválido'),
    password: z.string({ required_error: 'Senha é obrigatória' }).min(1, 'Senha não pode ser vazia'),
  }),
});

export const profileSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Nome é obrigatório' }).min(1, 'Nome não pode ser vazio').trim(),
    email: z.string({ required_error: 'E-mail é obrigatório' }).email('Formato de e-mail inválido').trim(),
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string({ required_error: 'Refresh token é obrigatório' }).min(1, 'Refresh token não pode ser vazio'),
  }),
});
