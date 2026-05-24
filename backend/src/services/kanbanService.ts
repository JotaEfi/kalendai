import { prisma } from '../lib/prisma.js';
import { getPresignedUrl } from './minioService.js';
import { generateReport, generateEmbedding } from './aiService.js';
import crypto from 'crypto';

export async function processDailyRollover() {
  console.log('Iniciando rollover diário otimizado...');
  try {
    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000;
    const localNow = new Date(today.getTime() - offset);
    
    // Day format string for yesterday
    const yesterdayDate = new Date(localNow);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    yesterdayDate.setUTCHours(0, 0, 0, 0);

    const todayDate = new Date(localNow);
    todayDate.setUTCHours(0, 0, 0, 0);

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
      return;
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
  } catch (err) {
    console.error('Erro no rollover diário:', err);
  }
}

export async function processDailyReport(dateStr?: string, userId?: string, isAutomatic: boolean = true) {
  console.log('Iniciando geração de relatório AI...');
  try {
    let targetDate: Date;
    if (dateStr) {
      targetDate = new Date(dateStr);
    } else {
      const today = new Date();
      const offset = today.getTimezoneOffset() * 60000;
      targetDate = new Date(today.getTime() - offset);
    }
    targetDate.setUTCHours(0, 0, 0, 0);

    const users = userId ? await prisma.user.findMany({ where: { id: userId } }) : await prisma.user.findMany();

    for (const user of users) {
      // Fetch cards for the day
      const cards = await prisma.kanbanCard.findMany({
        where: {
          userId: user.id,
          dayDate: targetDate
        },
        include: { images: true }
      });

      if (cards.length === 0) continue;

      const tarefasConcluidas = [];
      const tarefasAbertas = [];
      const tarefasProgresso = [];

      for (const card of cards) {
        if (card.status === 'DONE') {
          let duracao = 0;
          if (card.completedAt) {
            const start = card.originalDayDate ? new Date(card.originalDayDate).getTime() : new Date(card.createdAt).getTime();
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
        total_criadas: cards.length,
        total_concluidas: tarefasConcluidas.length,
        tarefas_concluidas: tarefasConcluidas,
        tarefas_em_aberto: tarefasAbertas,
        tarefas_em_progresso: tarefasProgresso
      };

      try {
        const reportText = await generateReport(reportPayload);
        const embedding = await generateEmbedding(reportText);

        const isPostgres = process.env.DATABASE_URL?.includes('postgresql://') || process.env.DATABASE_URL?.includes('postgres://');
        
        // Check if report exists
        const existing = await prisma.dailyReport.findUnique({
          where: {
            userId_date: {
              userId: user.id,
              date: targetDate
            }
          }
        });

        if (existing) {
          await prisma.dailyReport.update({
            where: { id: existing.id },
            data: {
              content: reportText,
              isAutomatic,
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
              isAutomatic,
              generatedAt: new Date(),
              ...(!isPostgres && embedding.length > 0 ? { embedding: JSON.stringify(embedding) } : {})
            }
          });
          
          if (isPostgres && embedding.length > 0) {
            const embeddingFormat = `[${embedding.join(',')}]`;
            await prisma.$executeRaw`UPDATE "DailyReport" SET embedding = ${embeddingFormat}::vector WHERE id = ${newReport.id}`;
          }
        }
      } catch (err) {
        console.error(`Falha ao gerar o relatorio para o usuario ${user.id}:`, err);
      }
    }
  } catch (err) {
    console.error('Erro geral no relatório diário:', err);
  }
}
