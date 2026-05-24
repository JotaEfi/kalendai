import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware.js';

const router = Router();

router.put('/profile', authenticateToken as any, async (req: AuthRequest, res: any) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Não autorizado' });
    
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Nome e email são obrigatórios' });

    const user = await prisma.user.update({
      where: { id: userId },
      data: { name, email },
    });

    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    const refreshSecret = process.env.REFRESH_TOKEN_SECRET;
    if (!jwtSecret || !refreshSecret) {
      console.error('JWT secrets are not configured.');
      return res.status(500).json({ error: 'Erro de configuracao do servidor', code: 'SERVER_MISCONFIGURED' });
    }

    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas', code: 'INVALID_CREDENTIALS' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Credenciais inválidas', code: 'INVALID_CREDENTIALS' });
    }

    const expiresIn = (process.env.JWT_EXPIRES_IN || '15m') as any;
    const refExpiresIn = (process.env.REFRESH_TOKEN_EXPIRES_IN || '7d') as any;

    const accessToken = jwt.sign({ userId: user.id, role: user.role }, jwtSecret, { expiresIn });
    const refreshToken = jwt.sign({ userId: user.id }, refreshSecret, { expiresIn: refExpiresIn });

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    res.json({ accessToken, refreshToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro no servidor', code: 'SERVER_ERROR' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    const refreshSecret = process.env.REFRESH_TOKEN_SECRET;
    if (!jwtSecret || !refreshSecret) {
      console.error('JWT secrets are not configured.');
      return res.status(500).json({ error: 'Erro de configuracao do servidor', code: 'SERVER_MISCONFIGURED' });
    }

    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token requerido' });

    const storedToken = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!storedToken) return res.status(403).json({ error: 'Refresh token inválido ou revogado' });

    jwt.verify(refreshToken, refreshSecret, async (err: any, decoded: any) => {
      if (err) {
        await prisma.refreshToken.delete({ where: { token: refreshToken } });
        return res.status(403).json({ error: 'Refresh token expirado' });
      }

      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) return res.status(403).json({ error: 'Usuário não encontrado' });

      const expiresIn = (process.env.JWT_EXPIRES_IN || '15m') as any;
      const accessToken = jwt.sign({ userId: user.id, role: user.role }, jwtSecret, { expiresIn });

      res.json({ accessToken });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deslogar' });
  }
});

export default router;
