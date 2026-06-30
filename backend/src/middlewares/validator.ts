import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

export const validateRequest = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // parseAsync valida e limpa (strip) campos extras do body, query e params
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Substitui no req pelos valores limpos do Zod (mitiga Mass Assignment)
      if (parsed.body !== undefined) req.body = parsed.body;
      if (parsed.query !== undefined) req.query = parsed.query;
      if (parsed.params !== undefined) req.params = parsed.params;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          status: 'error',
          message: 'Erro de validação de dados',
          errors: error.errors.map(err => ({
            field: err.path.slice(1).join('.'), // Remove o primeiro elemento ('body', 'query', etc.) para ficar limpo
            message: err.message,
          })),
        });
        return;
      }
      next(error);
    }
  };
};
