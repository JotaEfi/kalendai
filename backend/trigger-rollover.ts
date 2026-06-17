import { processDailyRollover, processAutomaticReport } from './src/services/kanbanService.js';

async function main() {
  console.log('\n=============================================================');
  console.log('🚀 INICIANDO DISPARO MANUAL DA VIRADA DO DIA');
  console.log('=============================================================');

  // Step 1: Executar Rollover
  console.log('\n[Passo 1/2] Rodando rollover diário de cards...');
  const { rolledOver } = await processDailyRollover();
  console.log(`[Passo 1/2] Concluído. ${rolledOver.length} cards processados.`);

  // Step 2: Gerar Relatório Automático V3
  console.log('\n[Passo 2/2] Gerando relatório automático V3...');
  await processAutomaticReport(rolledOver);
  console.log('[Passo 2/2] Concluído.');

  console.log('\n=============================================================');
  console.log('✅ PROCESSO DE VIRADA DO DIA CONCLUÍDO COM SUCESSO!');
  console.log('=============================================================\n');
}

main().catch(err => {
  console.error('❌ Erro crítico ao forçar virada do dia:', err);
  process.exit(1);
});
