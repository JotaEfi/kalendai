import { prisma } from '../lib/prisma.js';
import { getPresignedUrl } from './minioService.js';
import { generateReport, generateReportFallback, generateEmbedding } from './aiService.js';
import {
  getTodayInConfiguredTz,
  getYesterdayInConfiguredTz,
  getNextRolloverDay,
  shouldSkipRolloverToday,
  getConfiguredTimezone,
  areWeekendsDisabled
} from '../lib/timeUtils.js';
import crypto from 'crypto';

export async function processDailyRollover() {
  const tz = getConfiguredTimezone();
  const weekendsDisabled = areWeekendsDisabled();

  console.log(`[Rollover] Iniciando... Timezone: ${tz} | DISABLE_WEEKENDS: ${weekendsDisabled}`);

  // Verifica se o rollover deve ser pulado (ex.: fins de semana quando estão desabilitados)
  if (shouldSkipRolloverToday()) {
    console.log('[Rollover] Fins de semana desabilitados e hoje é fim de semana — rollover ignorado.');
    return { rolledOver: [] };
  }

  try {
    const yesterdayDate = getYesterdayInConfiguredTz();
    // Destino dos cards: próximo dia útil calculado a partir de ontem
    const targetDate = getNextRolloverDay(yesterdayDate);

    console.log(`[Rollover] Origem: ${yesterdayDate.toISOString().split('T')[0]} → Destino: ${targetDate.toISOString().split('T')[0]}`);

    // 1. Buscar todos os cards ativos de ontem em uma única query (anti-N+1)
    const activeCards = await prisma.kanbanCard.findMany({
      where: {
        dayDate: yesterdayDate,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        isSnapshot: false
      },
      include: { images: true }
    });

    if (activeCards.length === 0) {
      console.log('[Rollover] Nenhum card ativo de ontem para processar.');
      return { rolledOver: [] };
    }

    console.log(`[Rollover] ${activeCards.length} card(s) encontrado(s) para transportar.`);

    // 2. Montar operações em batch usando UUIDs pré-gerados
    const operations = activeCards.flatMap(card => {
      const snapshotCardId = crypto.randomUUID();

      // Snapshot: cópia congelada que fica no dia original (ontem)
      const createSnapshot = prisma.kanbanCard.create({
        data: {
          id: snapshotCardId,
          title: card.title,
          description: card.description,
          color: card.color,
          status: card.status,
          userId: card.userId,
          dayDate: card.dayDate,           // ← fica no dia de ontem
          isRolledOver: card.isRolledOver,
          originalDayDate: card.originalDayDate || card.dayDate,
          isSnapshot: true,
          createdAt: card.createdAt,
          order: card.order
        }
      });

      // Duplicar imagens do snapshot
      const cloneImages = card.images.map(img => prisma.cardImage.create({
        data: {
          cardId: snapshotCardId,
          objectKey: img.objectKey,
          bucket: img.bucket,
          mimeType: img.mimeType
        }
      }));

      // Card original: movido para o próximo dia útil
      const updateOriginal = prisma.kanbanCard.update({
        where: { id: card.id },
        data: {
          dayDate: targetDate,             // ← vai para o próximo dia útil
          isRolledOver: true,
          originalDayDate: card.originalDayDate || card.dayDate
        }
      });

      return [createSnapshot, ...cloneImages, updateOriginal];
    });

    // 3. Executar tudo em transação atômica
    await prisma.$transaction(operations);

    console.log(`[Rollover] Concluído com sucesso. ${activeCards.length} card(s) transportado(s) para ${targetDate.toISOString().split('T')[0]}.`);
    return { rolledOver: activeCards };
  } catch (err) {
    console.error('[Rollover] Erro durante a execução:', err);
    return { rolledOver: [] };
  }
}

/**
 * Retorna quantos relatórios AI_MANUAL um usuário tem para uma data,
 * e qual seria a próxima versão disponível (null se limite atingido).
 *
 * Limitações solicitadas:
 * - Datas futuras: 0 relatórios permitidos (retorna nextVersion: null).
 * - Datas passadas: no máximo 1 relatório AI_MANUAL permitido.
 * - Hoje: no máximo 2 relatórios AI_MANUAL permitidos.
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

  const today = getTodayInConfiguredTz();

  // Datas futuras: não é permitido gerar relatório com IA
  if (date.getTime() > today.getTime()) {
    return { count, nextVersion: null };
  }

  // Datas passadas: no máximo 1. Hoje: no máximo 2.
  const isPastDay = date.getTime() < today.getTime();
  const maxAllowed = isPastDay ? 1 : 2;

  if (count >= maxAllowed) return { count, nextVersion: null };
  return { count, nextVersion: count + 1 };
}

/**
 * Gera um relatório AI para um usuário (V1 ou V2 — máximo 2 por dia).
 */
export async function processDailyReport(dateStr?: string, userId?: string, isAutomatic: boolean = true) {
  console.log('[Relatório] Iniciando geração de relatório IA...');
  try {
    let targetDate: Date;
    if (dateStr) {
      targetDate = new Date(dateStr);
    } else {
      targetDate = getTodayInConfiguredTz();
    }
    targetDate.setUTCHours(0, 0, 0, 0);

    const users = userId ? await prisma.user.findMany({ where: { id: userId } }) : await prisma.user.findMany();

    for (const user of users) {
      const { nextVersion } = await getNextReportVersion(user.id, targetDate);
      if (nextVersion === null) {
        console.log(`[Relatório] Usuário ${user.id} já tem 2 relatórios IA para ${targetDate.toISOString().split('T')[0]}.`);
        continue;
      }

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
            duracao = Math.round((new Date(card.completedAt).getTime() - start) / 60000);
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
          console.warn(`[Relatório] IA falhou para usuário ${user.id}. Usando fallback local. Erro: ${aiErr.message}`);
          reportText = generateReportFallback(reportPayload);
        }

        const embedding = await generateEmbedding(reportText);
        const isPostgres = process.env.DATABASE_URL?.includes('postgresql://') || process.env.DATABASE_URL?.includes('postgres://');

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

        console.log(`[Relatório] V${nextVersion} gerado com sucesso para usuário ${user.id}`);
      } catch (err) {
        console.error(`[Relatório] Falha para o usuário ${user.id}:`, err);
      }
    }
  } catch (err) {
    console.error('[Relatório] Erro geral:', err);
  }
}

/**
 * Gera o relatório automático V3 (23:59), chamado APÓS processDailyRollover().
 * Menciona explicitamente quais cards foram transportados para o próximo dia.
 */
export async function processAutomaticReport(rolledOverCards: any[] = []) {
  console.log('[Relatório V3] Iniciando geração do relatório automático...');
  try {
    const todayDate = getTodayInConfiguredTz();
    const users = await prisma.user.findMany();

    for (const user of users) {
      const cards = await prisma.kanbanCard.findMany({
        where: {
          userId: user.id,
          dayDate: todayDate,
          isSnapshot: false
        },
        include: { images: true }
      });

      const openCards = await prisma.kanbanCard.findMany({
        where: {
          userId: user.id,
          dayDate: todayDate,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          isSnapshot: false
        }
      });

      const tarefasConcluidas: any[] = [];
      const tarefasTransportadas: string[] = [];

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
        total_criadas: cards.length,
        total_concluidas: tarefasConcluidas.length,
        tarefas_concluidas: tarefasConcluidas,
        tarefas_transportadas_para_amanha: tarefasTransportadas,
        mensagem_rollover: tarefasTransportadas.length > 0
          ? `${tarefasTransportadas.length} tarefa(s) não foram resolvidas hoje e foram automaticamente transportadas para o próximo dia útil: ${tarefasTransportadas.join(', ')}.`
          : 'Todas as tarefas do dia foram finalizadas!'
      };

      try {
        let reportText: string;
        try {
          reportText = await generateReport(reportPayload);
        } catch (aiErr: any) {
          console.warn(`[Relatório V3] IA falhou para usuário ${user.id}. Usando fallback. Erro: ${aiErr.message}`);
          reportText = generateReportFallback(reportPayload);
        }

        const isPostgres = process.env.DATABASE_URL?.includes('postgresql://') || process.env.DATABASE_URL?.includes('postgres://');

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

        console.log(`[Relatório V3] Gerado com sucesso para usuário ${user.id}`);
      } catch (err) {
        console.error(`[Relatório V3] Falha para o usuário ${user.id}:`, err);
      }
    }
  } catch (err) {
    console.error('[Relatório V3] Erro geral:', err);
  }
}
