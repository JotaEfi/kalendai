import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { processDailyReport, getNextReportVersion } from '../services/kanbanService.js';
import { AuthRequest } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * GET /api/reports/:date
 * Returns ALL reports for a given date (V1, V2, V3) as an array
 */
router.get('/:date', async (req: AuthRequest, res: any) => {
  try {
    const { date } = req.params;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Não autorizado', code: 'UNAUTHORIZED' });

    const parsedDate = new Date(date);
    parsedDate.setUTCHours(0, 0, 0, 0);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Data invalida', code: 'INVALID_DATE' });
    }

    const reports = await prisma.dailyReport.findMany({
      where: { userId, date: parsedDate },
      orderBy: { version: 'asc' }
    });

    res.json(reports);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar relatórios', code: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/reports/count/:date
 * Returns the report count for a date and which version is next available
 */
router.get('/count/:date', async (req: AuthRequest, res: any) => {
  try {
    const { date } = req.params;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Não autorizado', code: 'UNAUTHORIZED' });

    const parsedDate = new Date(date);
    parsedDate.setUTCHours(0, 0, 0, 0);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Data invalida', code: 'INVALID_DATE' });
    }

    const { count, nextVersion } = await getNextReportVersion(userId, parsedDate);
    const hasAutomatic = await prisma.dailyReport.findUnique({
      where: { userId_date_version: { userId, date: parsedDate, version: 3 } }
    });

    res.json({
      date: parsedDate.toISOString().split('T')[0],
      aiManualCount: count,
      nextAvailableVersion: nextVersion,  // null if limit reached
      hasAutomaticReport: !!hasAutomatic,
      canGenerateMore: nextVersion !== null
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar contagem', code: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/reports/generate/:date
 * Generates the next available AI-manual report (V1 or V2) for a date
 * Returns 429 if limit of 2 AI reports is already reached
 */
router.post('/generate/:date', async (req: AuthRequest, res: any) => {
  try {
    const { date } = req.params;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Não autorizado', code: 'UNAUTHORIZED' });

    const parsedDate = new Date(date);
    parsedDate.setUTCHours(0, 0, 0, 0);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Data invalida', code: 'INVALID_DATE' });
    }

    // Check if AI limit reached (max 2 manual reports per day)
    const { nextVersion } = await getNextReportVersion(userId, parsedDate);
    if (nextVersion === null) {
      return res.status(429).json({
        error: 'Limite de relatórios IA atingido para este dia. Máximo 2 relatórios por IA por dia.',
        code: 'REPORT_LIMIT_REACHED'
      });
    }

    // Call service to generate report manually
    await processDailyReport(date, userId, false);

    // Fetch the generated report
    const newReport = await prisma.dailyReport.findUnique({
      where: {
        userId_date_version: {
          userId,
          date: parsedDate,
          version: nextVersion
        }
      }
    });

    res.json(newReport);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao gerar relatório', code: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/reports/
 * Lists all reports for the user, ordered by date desc then version asc
 */
router.get('/', async (req: AuthRequest, res: any) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Não autorizado', code: 'UNAUTHORIZED' });

    const reports = await prisma.dailyReport.findMany({
      where: { userId },
      orderBy: [{ date: 'desc' }, { version: 'asc' }]
    });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar relatórios', code: 'SERVER_ERROR' });
  }
});

export default router;
