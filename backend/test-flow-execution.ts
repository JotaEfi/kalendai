import { prisma } from './src/lib/prisma.js';
import { processDailyRollover, processAutomaticReport } from './src/services/kanbanService.js';
import { getTodayInConfiguredTz, getNextRolloverDay } from './src/lib/timeUtils.js';

async function test() {
  console.log('=== INICIANDO TESTE INTEGRADO DE ROLLOVER E RELATÓRIO V3 ===');

  // 1. Obter ou criar usuário
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'test@kalend.ai',
        name: 'Test User',
        passwordHash: 'dummyhash',
        role: 'ADMIN'
      }
    });
  }
  const userId = user.id;
  console.log(`Usando Usuário: ${user.name} (${user.email})`);

  const today = getTodayInConfiguredTz();
  const tomorrow = getNextRolloverDay(today);
  console.log(`Hoje: ${today.toISOString().split('T')[0]}`);
  console.log(`Amanhã: ${tomorrow.toISOString().split('T')[0]}`);

  // 2. Limpar cards antigos deste usuário para o teste
  await prisma.kanbanCard.deleteMany({
    where: { userId }
  });
  await prisma.dailyReport.deleteMany({
    where: { userId }
  });
  console.log('Cards e Relatórios limpos para o teste.');

  // 3. Criar os cards de teste
  const cardOpen = await prisma.kanbanCard.create({
    data: {
      userId,
      title: 'Tarefa Teste Aberta',
      description: 'Esta deve ser rolada para amanhã',
      status: 'OPEN',
      dayDate: today
    }
  });

  const cardDone = await prisma.kanbanCard.create({
    data: {
      userId,
      title: 'Tarefa Teste Concluída',
      description: 'Esta deve permanecer hoje',
      status: 'DONE',
      dayDate: today,
      completedAt: new Date()
    }
  });
  console.log('Cards de teste criados (1 Aberto, 1 Concluído).');

  // 4. Executar o rollover
  console.log('Executando rollover...');
  const { rolledOver } = await processDailyRollover();
  console.log(`Rollover concluído. ${rolledOver.length} card(s) rolado(s).`);

  // 5. Executar o relatório V3
  console.log('Executando relatório V3...');
  await processAutomaticReport(rolledOver);

  // 6. Validar estado do banco
  console.log('\n=== VALIDANDO RESULTADOS NO BANCO DE DADOS ===');

  // Verificar se o card concluído continua hoje
  const dbCardDone = await prisma.kanbanCard.findFirst({
    where: { id: cardDone.id }
  });
  const doneOk = dbCardDone && dbCardDone.dayDate.getTime() === today.getTime();
  console.log(`- Card Concluído continua em hoje: ${doneOk ? '✅ PASS' : '❌ FAIL'}`);

  // Verificar se o card aberto foi para amanhã
  const dbCardOpen = await prisma.kanbanCard.findFirst({
    where: { id: cardOpen.id }
  });
  const openOk = dbCardOpen && dbCardOpen.dayDate.getTime() === tomorrow.getTime();
  console.log(`- Card Aberto foi movido para amanhã: ${openOk ? '✅ PASS' : '❌ FAIL'}`);

  // Verificar se o snapshot foi criado em hoje
  const snapshot = await prisma.kanbanCard.findFirst({
    where: {
      title: 'Tarefa Teste Aberta',
      dayDate: today,
      isSnapshot: true
    }
  });
  console.log(`- Snapshot criado em hoje: ${snapshot ? '✅ PASS' : '❌ FAIL'}`);

  // Verificar se o relatório automático foi gerado com versão 3 e tipo AUTOMATIC
  const report = await prisma.dailyReport.findUnique({
    where: {
      userId_date_version: {
        userId,
        date: today,
        version: 3
      }
    }
  });
  const reportOk = report && report.isAutomatic && report.reportType === 'AUTOMATIC';
  console.log(`- Relatório automático V3 criado em hoje: ${reportOk ? '✅ PASS' : '❌ FAIL'}`);
  if (report) {
    console.log(`- Conteúdo do Relatório: "${report.content.substring(0, 100).replace(/\n/g, ' ')}..."`);
    // Verificar se cita o card transportado
    const containsTitle = report.content.includes('Tarefa Teste Aberta');
    console.log(`- Relatório cita a tarefa transportada: ${containsTitle ? '✅ PASS' : '❌ FAIL'}`);
  }

  console.log('\n=== FIM DO TESTE INTEGRADO ===');
}

test().catch(err => {
  console.error('Erro no teste:', err);
});
