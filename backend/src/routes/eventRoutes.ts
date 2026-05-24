import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AuthRequest } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  res.json([]);
});

export default router;
