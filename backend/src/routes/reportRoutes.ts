import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { processDailyReport } from '../services/kanbanService.js';
import { AuthRequest } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/:date', async (req: AuthRequest, res: any) => {
  try {
    const { date } = req.params;
    const userId = req.user?.userId || 'placeholder-user-id';
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Data invalida', code: 'INVALID_DATE' });
    }

    const report = await prisma.dailyReport.findUnique({
      where: {
        userId_date: {
          userId,
          date: parsedDate
        }
      }
    });

    res.json(report || null);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar relatorio', code: 'SERVER_ERROR' });
  }
});

router.post('/generate/:date', async (req: AuthRequest, res: any) => {
  try {
    const { date } = req.params;
    const userId = req.user?.userId || 'placeholder-user-id';
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Data invalida', code: 'INVALID_DATE' });
    }

    // Call service to generate report manually
    await processDailyReport(date, userId, false);

    // Fetch the generated report
    const newReport = await prisma.dailyReport.findUnique({
      where: {
        userId_date: {
          userId,
          date: parsedDate
        }
      }
    });

    res.json(newReport);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao gerar relatorio', code: 'SERVER_ERROR' });
  }
});

router.get('/', async (req: AuthRequest, res: any) => {
  try {
    const userId = req.user?.userId || 'placeholder-user-id';
    const reports = await prisma.dailyReport.findMany({
      where: { userId },
      orderBy: { date: 'desc' }
    });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar relatorios', code: 'SERVER_ERROR' });
  }
});

export default router;
