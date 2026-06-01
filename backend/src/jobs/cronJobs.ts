import cron from 'node-cron';
import { processDailyRollover, processAutomaticReport } from '../services/kanbanService.js';
import { getConfiguredTimezone } from '../lib/timeUtils.js';

export function setupCronJobs() {
  // O timezone é lido do .env via timeUtils para consistência
  const timezone = getConfiguredTimezone();

  console.log(`[CronJobs] Configurando jobs com timezone: ${timezone}`);

  // ─────────────────────────────────────────────────────────────
  // 23:59 no timezone configurado — Rollover de cards + Relatório V3
  //
  // Lógica de fim de dia:
  //   1. processDailyRollover() — move cards OPEN/IN_PROGRESS para
  //      o próximo dia útil (respeita DISABLE_WEEKENDS)
  //      e cria snapshots congelados no dia atual
  //   2. processAutomaticReport() — gera relatório V3 automático,
  //      informando quais cards foram transportados
  // ─────────────────────────────────────────────────────────────
  cron.schedule('59 23 * * *', async () => {
    console.log(`[CronJobs] Ciclo de fim de dia iniciado (23:59 ${timezone})...`);

    // Step 1: Rollover — retorna os cards transportados para uso no V3
    const { rolledOver } = await processDailyRollover();

    // Step 2: Relatório V3 automático com contexto do rollover
    await processAutomaticReport(rolledOver);

    console.log('[CronJobs] Ciclo de fim de dia concluído.');
  }, {
    timezone
  });

  // ─────────────────────────────────────────────────────────────
  // Relatórios V1 e V2 são gerados manualmente pelo usuário
  // via: POST /api/reports/generate/:date (máx 2 por dia por IA)
  // O V3 acima é sempre automático e acontece às 23:59.
  // ─────────────────────────────────────────────────────────────
}
