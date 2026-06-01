import { prisma } from '../lib/prisma.js';
import { getPresignedUrl } from './minioService.js';
import { generateReport, generateReportFallback, generateEmbedding } from './aiService.js';
import crypto from 'crypto';

// Timezone helper for São Paulo (UTC-3, no DST since Brazil eliminated DST in 2019)
function getSaoPauloDate(): Date {
  const now = new Date();
  // BRT is UTC-3 = offset of -180 minutes
  const brtOffset = -3 * 60; // minutes
  const utcOffset = now.getTimezoneOffset(); // local UTC offset in minutes
  const brtMs = now.getTime() + (utcOffset + brtOffset) * 60000;
  const brtDate = new Date(brtMs);
  brtDate.setUTCHours(0, 0, 0, 0);
  return brtDate;
}

export async function processDailyRollover() {
  console.log('Iniciando rollover diário otimizado...');
  try {
    const todayDate = getSaoPauloDate();
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);

    // 1. Fetch all yesterday's active cards for ALL users in a single optimized query (Mitigates N+1)
    const activeCards = await prisma.kanbanCard.findMany({
      where: {
        dayDate: yesterdayDate,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        isSnapshot: false
      },
      include: { images: true }
    });

    if (activeCards.length === 0) {
      console.log('Nenhum card ativo ontem para rollover.');
      return { rolledOver: [] };
    }

    // 2. Build transacted bulk operations using pre-generated UUIDs
    const operations = activeCards.flatMap(card => {
      const snapshotCardId = crypto.randomUUID();
      
      // Promise to create a snapshot card that stays in yesterday
      const createSnapshot = prisma.kanbanCard.create({
        data: {
          id: snapshotCardId,
          title: card.title,
          description: card.description,
          color: card.color,
          status: card.status,
          userId: card.userId,
          dayDate: card.dayDate,
          isRolledOver: card.isRolledOver,
          originalDayDate: card.originalDayDate || card.dayDate,
          isSnapshot: true,
          createdAt: card.createdAt,
          order: card.order
        }
      });

      // Promises to duplicate images for the snapshot card
      const cloneImages = card.images.map(img => prisma.cardImage.create({
        data: {
          cardId: snapshotCardId,
          objectKey: img.objectKey,
          bucket: img.bucket,
          mimeType: img.mimeType
        }
      }));

      // Promise to move original card to today
      const updateOriginal = prisma.kanbanCard.update({
        where: { id: card.id },
        data: {
          dayDate: todayDate,
          isRolledOver: true,
          originalDayDate: card.originalDayDate || card.dayDate
        }
      });

      return [createSnapshot, ...cloneImages, updateOriginal];
    });

    // Execute all bulk updates in a single transaction (Atomic and safe)
    await prisma.$transaction(operations);

    console.log(`Rollover transacional concluído com sucesso. Processados ${activeCards.length} cards.`);
    return { rolledOver: activeCards };
  } catch (err) {
    console.error('Erro no rollover diário:', err);
    return { rolledOver: [] };
  }
}

/**
 * Gets how many AI-manual reports (V1, V2) a user has for a given date.
 * Returns: { count: number, nextVersion: number | null }
 * nextVersion is null when both V1 and V2 are used up.
 */
export async function getNextReportVersion(userId: string, date: Date): Promise<{ count: number; nextVersion: number | null }> {
  const existing = await prisma.dailyReport.findMany({
    where: {
      userId,
      date,
      reportType: 'AI_MANUAL'
    },
    select: { version: true }
  });
  const count = existing.length;
  if (count >= 2) return { count, nextVersion: null };
  return { count, nextVersion: count + 1 };
}

/**
 * Generates an AI-powered daily report for a user.
 * This function handles V1 (first manual) and V2 (second manual) report generation.
 * Maximum 2 AI manual reports per day per user.
 */
export async function processDailyReport(dateStr?: string, userId?: string, isAutomatic: boolean = true) {
  console.log('Iniciando geração de relatório AI...');
  try {
    let targetDate: Date;
    if (dateStr) {
      targetDate = new Date(dateStr);
    } else {
      targetDate = getSaoPauloDate();
    }
    targetDate.setUTCHours(0, 0, 0, 0);

    const users = userId ? await prisma.user.findMany({ where: { id: userId } }) : await prisma.user.findMany();

    for (const user of users) {
      // Determine which version to create
      const { nextVersion } = await getNextReportVersion(user.id, targetDate);
      if (nextVersion === null) {
        console.log(`Usuário ${user.id} já tem 2 relatórios AI para ${targetDate.toISOString().split('T')[0]}. Limite atingido.`);
        continue;
      }

      // Fetch cards for the day (exclude snapshots)
      const cards = await prisma.kanbanCard.findMany({
        where: {
          userId: user.id,
          dayDate: targetDate,
          isSnapshot: false
        },
        include: { images: true }
      });

      if (cards.length === 0) continue;

      const tarefasConcluidas: any[] = [];
      const tarefasAbertas: string[] = [];
      const tarefasProgresso: string[] = [];

      for (const card of cards) {
        if (card.status === 'DONE') {
          let duracao = 0;
          if (card.completedAt) {
            const start = card.createdAt.getTime();
            duracao = Math.round((new Date(card.completedAt).getTime() - start) / 60000); // in minutes
          }
          
          let urls: string[] = [];
          if (card.images.length > 0) {
            urls = await Promise.all(card.images.map((img: any) => getPresignedUrl(img.objectKey)));
          }

          tarefasConcluidas.push({
            titulo: card.title,
            descricao: card.description || '',
            duracao_minutos: duracao,
            tem_imagem: card.images.length > 0,
            imagens: urls
          });
        } else if (card.status === 'OPEN') {
          tarefasAbertas.push(card.title);
        } else {
          tarefasProgresso.push(card.title);
        }
      }

      const reportPayload = {
        data: targetDate.toISOString().split('T')[0],
        versao: nextVersion,
        total_criadas: cards.length,
        total_concluidas: tarefasConcluidas.length,
        tarefas_concluidas: tarefasConcluidas,
        tarefas_em_aberto: tarefasAbertas,
        tarefas_em_progresso: tarefasProgresso
      };

      try {
        let reportText: string;
        try {
          reportText = await generateReport(reportPayload);
        } catch (aiErr: any) {
          console.warn(`IA falhou para usuário ${user.id}. Usando fallback local:`, aiErr.message);
          reportText = generateReportFallback(reportPayload);
        }
        
        const embedding = await generateEmbedding(reportText);
        const isPostgres = process.env.DATABASE_URL?.includes('postgresql://') || process.env.DATABASE_URL?.includes('postgres://');
        
        // Upsert for this specific version
        const existing = await prisma.dailyReport.findUnique({
          where: {
            userId_date_version: {
              userId: user.id,
              date: targetDate,
              version: nextVersion
            }
          }
        });

        if (existing) {
          await prisma.dailyReport.update({
            where: { id: existing.id },
            data: {
              content: reportText,
              reportType: 'AI_MANUAL',
              isAutomatic: false,
              generatedAt: new Date(),
              ...(!isPostgres && embedding.length > 0 ? { embedding: JSON.stringify(embedding) } : {})
            }
          });
          if (isPostgres && embedding.length > 0) {
            const embeddingFormat = `[${embedding.join(',')}]`;
            await prisma.$executeRaw`UPDATE "DailyReport" SET embedding = ${embeddingFormat}::vector WHERE id = ${existing.id}`;
          }
        } else {
          const newReport = await prisma.dailyReport.create({
            data: {
              userId: user.id,
              date: targetDate,
              content: reportText,
              version: nextVersion,
              reportType: 'AI_MANUAL',
              isAutomatic: false,
              generatedAt: new Date(),
              ...(!isPostgres && embedding.length > 0 ? { embedding: JSON.stringify(embedding) } : {})
            }
          });
          if (isPostgres && embedding.length > 0) {
            const embeddingFormat = `[${embedding.join(',')}]`;
            await prisma.$executeRaw`UPDATE "DailyReport" SET embedding = ${embeddingFormat}::vector WHERE id = ${newReport.id}`;
          }
        }

        console.log(`Relatório V${nextVersion} gerado com sucesso para usuário ${user.id}`);
      } catch (err) {
        console.error(`Falha ao gerar o relatorio para o usuario ${user.id}:`, err);
      }
    }
  } catch (err) {
    console.error('Erro geral no relatório diário:', err);
  }
}

/**
 * Generates the automatic V3 report at 23:59.
 * This function is called AFTER processDailyRollover() runs.
 * It records which cards were completed and which were rolled over.
 */
export async function processAutomaticReport(rolledOverCards: any[] = []) {
  console.log('Iniciando geração de relatório automático V3 (23:59)...');
  try {
    const todayDate = getSaoPauloDate();

    const users = await prisma.user.findMany();

    for (const user of users) {
      // Build set of rolled-over card IDs for this user
      const userRolledIds = new Set(
        rolledOverCards
          .filter(c => c.userId === user.id)
          .map(c => c.id)
      );

      // Fetch ALL cards of the day (snapshots are the frozen state from rollover)
      const cards = await prisma.kanbanCard.findMany({
        where: {
          userId: user.id,
          dayDate: todayDate,
          isSnapshot: false
        },
        include: { images: true }
      });

      // Also fetch snapshots created today (rolled-over from yesterday, now frozen)
      // Actually snapshots belong to yesterday's date, we use the passed rolledOverCards list

      const tarefasConcluidas: any[] = [];
      const tarefasTransportadas: string[] = [];
      const tarefasAbertas: string[] = [];
      const tarefasProgresso: string[] = [];

      // Cards that are currently open/in-progress on this day (will be rolled over)
      const openCards = await prisma.kanbanCard.findMany({
        where: {
          userId: user.id,
          dayDate: todayDate,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          isSnapshot: false
        }
      });

      for (const card of cards) {
        if (card.status === 'DONE') {
          let duracao = 0;
          if (card.completedAt) {
            const start = card.createdAt.getTime();
            duracao = Math.round((new Date(card.completedAt).getTime() - start) / 60000);
          }
          tarefasConcluidas.push({
            titulo: card.title,
            descricao: card.description || '',
            duracao_minutos: duracao,
            tem_imagem: card.images.length > 0
          });
        }
      }

      // Cards that will be transported to tomorrow
      for (const card of openCards) {
        tarefasTransportadas.push(card.title);
      }

      if (tarefasConcluidas.length === 0 && tarefasTransportadas.length === 0) {
        continue;
      }

      const reportPayload = {
        data: todayDate.toISOString().split('T')[0],
        versao: 3,
        tipo: 'automatico',
        total_criadas: cards.length + openCards.length,
        total_concluidas: tarefasConcluidas.length,
        tarefas_concluidas: tarefasConcluidas,
        tarefas_transportadas_para_amanha: tarefasTransportadas,
        mensagem_rollover: tarefasTransportadas.length > 0
          ? `${tarefasTransportadas.length} tarefa(s) não foram resolvidas hoje e foram automaticamente transportadas para amanhã: ${tarefasTransportadas.join(', ')}.`
          : 'Todas as tarefas do dia foram finalizadas!'
      };

      try {
        let reportText: string;
        try {
          reportText = await generateReport(reportPayload);
        } catch (aiErr: any) {
          console.warn(`IA falhou para relatório automático do usuário ${user.id}. Usando fallback:`, aiErr.message);
          reportText = generateReportFallback(reportPayload);
        }

        const isPostgres = process.env.DATABASE_URL?.includes('postgresql://') || process.env.DATABASE_URL?.includes('postgres://');

        // V3 always upserts (replaces)
        const existing = await prisma.dailyReport.findUnique({
          where: {
            userId_date_version: {
              userId: user.id,
              date: todayDate,
              version: 3
            }
          }
        });

        if (existing) {
          await prisma.dailyReport.update({
            where: { id: existing.id },
            data: {
              content: reportText,
              reportType: 'AUTOMATIC',
              isAutomatic: true,
              generatedAt: new Date()
            }
          });
        } else {
          await prisma.dailyReport.create({
            data: {
              userId: user.id,
              date: todayDate,
              content: reportText,
              version: 3,
              reportType: 'AUTOMATIC',
              isAutomatic: true,
              generatedAt: new Date()
            }
          });
        }

        console.log(`Relatório automático V3 gerado com sucesso para usuário ${user.id}`);
      } catch (err) {
        console.error(`Falha ao gerar relatório V3 para usuário ${user.id}:`, err);
      }
    }
  } catch (err) {
    console.error('Erro geral no relatório automático V3:', err);
  }
}
