import { z } from 'zod';

export const cardCreateSchema = z.object({
  body: z.object({
    title: z.string({ required_error: 'Título é obrigatório' }).min(1, 'Título não pode ser vazio').trim(),
    description: z.string().optional(),
    color: z.string().optional(),
    dayDate: z.string({ required_error: 'Data é obrigatória' }).refine(val => !isNaN(Date.parse(val)), 'Formato de data inválido'),
  }).strict(),
});

export const cardUpdateSchema = z.object({
  params: z.object({
    id: z.string({ required_error: 'ID do card é obrigatório' }).uuid('ID do card inválido'),
  }),
  body: z.object({
    title: z.string().min(1, 'Título não pode ser vazio').trim().optional(),
    description: z.string().optional(),
    color: z.string().optional(),
    order: z.number().int().optional(),
    status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE']).optional(),
  }).strict(),
});
