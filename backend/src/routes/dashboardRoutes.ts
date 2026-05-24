import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AuthRequest } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', async (req: AuthRequest, res: any) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Não autorizado', code: 'UNAUTHORIZED' });
    }

    const monthStr = (req.query.month as string) || new Date().toISOString().slice(0, 7); // e.g. YYYY-MM
    const [year, month] = monthStr.split('-').map(Number);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Mês informado é inválido. Formato esperado: YYYY-MM', code: 'INVALID_MONTH' });
    }

    // Set boundaries using UTC/local equivalent to be timezone-aligned
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1); // Exclusive: first day of next month

    // Fetch month's cards
    const monthCards = await prisma.kanbanCard.findMany({
      where: {
        userId,
        dayDate: {
          gte: startDate,
          lt: endDate,
        },
        isSnapshot: false, // Avoid double-counting rolled-over tasks
      },
    });

    // Metric 1 & 2: Totals
    const totalCreated = monthCards.length;
    const completedCards = monthCards.filter((c) => c.status === 'DONE');
    const totalCompleted = completedCards.length;

    // Metric 3: Completion percentage rate
    const completionRate = totalCreated > 0 ? parseFloat(((totalCompleted / totalCreated) * 100).toFixed(1)) : 0;

    // Metric 4: Average completion time in hours
    let averageCompletionTimeHours = 0;
    if (totalCompleted > 0) {
      let totalElapsedMs = 0;
      let countWithTime = 0;

      for (const card of completedCards) {
        if (card.completedAt) {
          // Fallback to createdAt if originalDayDate is not specified
          const startTime = card.originalDayDate ? new Date(card.originalDayDate).getTime() : new Date(card.createdAt).getTime();
          const endTime = new Date(card.completedAt).getTime();
          const elapsed = endTime - startTime;

          if (elapsed >= 0) {
            totalElapsedMs += elapsed;
            countWithTime++;
          }
        }
      }

      if (countWithTime > 0) {
        const averageMs = totalElapsedMs / countWithTime;
        averageCompletionTimeHours = parseFloat((averageMs / (1000 * 60 * 60)).toFixed(1)); // Milliseconds to hours
      }
    }

    // Metric 5: Simple double-bar graph parsed per weeks (Week 1: days 1-7, Week 2: 8-14, Week 3: 15-21, Week 4: 22+)
    const weeks = [
      { name: 'Semana 1', start: 1, end: 7, criadas: 0, concluidas: 0 },
      { name: 'Semana 2', start: 8, end: 14, criadas: 0, concluidas: 0 },
      { name: 'Semana 3', start: 15, end: 21, criadas: 0, concluidas: 0 },
      { name: 'Semana 4', start: 22, end: 31, criadas: 0, concluidas: 0 },
    ];

    for (const card of monthCards) {
      const cardDay = new Date(card.dayDate).getUTCDate();
      for (const week of weeks) {
        if (cardDay >= week.start && cardDay <= week.end) {
          week.criadas++;
          if (card.status === 'DONE') {
            week.concluidas++;
          }
          break;
        }
      }
    }

    // Metric 6: Last 5 reports
    const latestReports = await prisma.dailyReport.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 5,
    });

    res.json({
      month: monthStr,
      metrics: {
        totalCreated,
        totalCompleted,
        completionRate,
        averageCompletionTimeHours,
      },
      weeklyChart: weeks.map((w) => ({
        name: w.name,
        Criadas: w.criadas,
        Concluídas: w.concluidas,
      })),
      latestReports: latestReports.map((r) => ({
        id: r.id,
        date: r.date.toISOString().split('T')[0],
        isAutomatic: r.isAutomatic,
        generatedAt: r.generatedAt,
        contentPreview: r.content.substring(0, 100) + '...',
        content: r.content,
      })),
    });
  } catch (error: any) {
    console.error('Error compiling dashboard metrics:', error);
    res.status(500).json({ error: 'Erro ao compilar métricas do dashboard', code: 'SERVER_ERROR' });
  }
});

export default router;
