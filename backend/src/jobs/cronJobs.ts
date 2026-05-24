import cron from 'node-cron';
import { processDailyRollover, processDailyReport } from '../services/kanbanService.js';

export function setupCronJobs() {
  // Midnight rollover
  cron.schedule('1 0 * * *', async () => {
    await processDailyRollover();
  }, {
    timezone: "America/Sao_Paulo"
  });

  // Daily report generation (18:00)
  cron.schedule('0 18 * * *', async () => {
    await processDailyReport(undefined, undefined, true);
  }, {
    timezone: "America/Sao_Paulo"
  });
}

