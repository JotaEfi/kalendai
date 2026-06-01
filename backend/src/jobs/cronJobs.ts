import cron from 'node-cron';
import { processDailyRollover, processAutomaticReport } from '../services/kanbanService.js';

export function setupCronJobs() {
  // ─────────────────────────────────────────────────────────────
  // 23:59 BRT — Rollover de cards + Relatório Automático V3
  // Lógica: todo dia às 23:59 horário de Brasília (America/Sao_Paulo):
  //   1. processDailyRollover() — move cards OPEN/IN_PROGRESS para amanhã
  //      e cria snapshots congelados para o dia atual
  //   2. processAutomaticReport() — gera o relatório V3 automático,
  //      mencionando os cards que foram transportados
  // ─────────────────────────────────────────────────────────────
  cron.schedule('59 23 * * *', async () => {
    console.log('[CronJobs] Iniciando ciclo de fim de dia (23:59 BRT)...');
    
    // Step 1: Rollover — returns the list of rolled-over cards for use in V3 report
    const { rolledOver } = await processDailyRollover();
    
    // Step 2: Generate V3 automatic report with rollover context
    await processAutomaticReport(rolledOver);
    
    console.log('[CronJobs] Ciclo de fim de dia concluído.');
  }, {
    timezone: "America/Sao_Paulo"
  });

  // ─────────────────────────────────────────────────────────────
  // Nota: Relatórios V1 e V2 são gerados manualmente pelo usuário
  // via POST /api/reports/generate/:date (máximo 2 por dia por IA).
  // O V3 acima é sempre automático e acontece às 23:59.
  // ─────────────────────────────────────────────────────────────
}
