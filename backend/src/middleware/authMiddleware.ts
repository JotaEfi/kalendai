import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('JWT_SECRET is not configured.');
    return res.status(500).json({ error: 'Erro de configuracao do servidor', code: 'SERVER_MISCONFIGURED' });
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido', code: 'NO_TOKEN' });
  }

  jwt.verify(token, jwtSecret, (err: any, user: any) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
         return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
      }
      return res.status(403).json({ error: 'Token inválido', code: 'INVALID_TOKEN' });
    }
    
    req.user = user as { userId: string, role: string };
    next();
  });
};

export const authorizeAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso negado: Requer privilégios de administrador', code: 'FORBIDDEN_ADMIN_ONLY' });
  }
  next();
};
