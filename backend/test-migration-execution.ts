import { prisma } from './src/lib/prisma.js';
import { migratePastActiveCards } from './src/services/kanbanService.js';
import { getTodayInConfiguredTz } from './src/lib/timeUtils.js';

async function testMigration() {
  console.log('=============================================================');
  console.log('🚀 INICIANDO TESTE INTEGRADO DA MIGRAÇÃO DE CARDS DO PASSADO');
  console.log('=============================================================');

  // 1. Obter ou criar usuário de teste
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'migration-test@kalend.ai',
        name: 'Migration Test User',
        passwordHash: 'dummyhash',
        role: 'ADMIN'
      }
    });
  }
  const userId = user.id;
  console.log(`Usando Usuário: ${user.name} (${user.email})`);

  const today = getTodayInConfiguredTz();
  
  // Datas no passado
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setUTCDate(today.getUTCDate() - 3);

  const twoDaysAgo = new Date(today);
  twoDaysAgo.setUTCDate(today.getUTCDate() - 2);

  console.log(`Hoje (Configured TZ): ${today.toISOString().split('T')[0]}`);
  console.log(`Há 3 dias: ${threeDaysAgo.toISOString().split('T')[0]}`);
  console.log(`Há 2 dias: ${twoDaysAgo.toISOString().split('T')[0]}`);

  // 2. Limpar cards antigos do usuário de teste
  await prisma.kanbanCard.deleteMany({
    where: { userId }
  });
  console.log('Cards limpos para o teste.');

  // 3. Criar cenários de teste no passado e hoje
  const cardPastOpen = await prisma.kanbanCard.create({
    data: {
      userId,
      title: 'Tarefa Passada Aberta',
      description: 'Deve ser migrada para hoje',
      status: 'OPEN',
      dayDate: threeDaysAgo,
      isSnapshot: false
    }
  });

  const cardPastInProgress = await prisma.kanbanCard.create({
    data: {
      userId,
      title: 'Tarefa Passada Em Progresso',
      description: 'Deve ser migrada para hoje',
      status: 'IN_PROGRESS',
      dayDate: twoDaysAgo,
      isSnapshot: false
    }
  });

  const cardPastDone = await prisma.kanbanCard.create({
    data: {
      userId,
      title: 'Tarefa Passada Concluída',
      description: 'Deve permanecer no passado',
      status: 'DONE',
      dayDate: twoDaysAgo,
      isSnapshot: false,
      completedAt: new Date()
    }
  });

  const cardPastSnapshot = await prisma.kanbanCard.create({
    data: {
      userId,
      title: 'Snapshot Passado Aberto',
      description: 'Deve permanecer no passado (é snapshot)',
      status: 'OPEN',
      dayDate: twoDaysAgo,
      isSnapshot: true
    }
  });

  const cardTodayOpen = await prisma.kanbanCard.create({
    data: {
      userId,
      title: 'Tarefa Criada Hoje',
      description: 'Deve permanecer hoje inalterada',
      status: 'OPEN',
      dayDate: today,
      isSnapshot: false
    }
  });

  console.log('Cards de teste criados com sucesso.');

  // 4. Executar migração
  console.log('\nExecutando migratePastActiveCards()...');
  const result = await migratePastActiveCards();
  console.log(`Migração concluída. Retorno: ${JSON.stringify(result)}`);

  // 5. Validar estado do banco de dados
  console.log('\n=== VALIDANDO RESULTADOS NO BANCO DE DADOS ===');

  // A. Tarfesa Passada Aberta -> Deve estar em hoje e ter isRolledOver: true
  const dbPastOpen = await prisma.kanbanCard.findUnique({ where: { id: cardPastOpen.id } });
  const pastOpenOk = dbPastOpen && dbPastOpen.dayDate.getTime() === today.getTime() && dbPastOpen.isRolledOver === true;
  console.log(`- Card Passado Aberto migrou para Hoje: ${pastOpenOk ? '✅ PASS' : '❌ FAIL'}`);

  // B. Tarefa Passada Em Progresso -> Deve estar em hoje e ter isRolledOver: true
  const dbPastInProgress = await prisma.kanbanCard.findUnique({ where: { id: cardPastInProgress.id } });
  const pastInProgressOk = dbPastInProgress && dbPastInProgress.dayDate.getTime() === today.getTime() && dbPastInProgress.isRolledOver === true;
  console.log(`- Card Passado Em Progresso migrou para Hoje: ${pastInProgressOk ? '✅ PASS' : '❌ FAIL'}`);

  // C. Tarefa Passada Concluída -> Deve continuar no passado
  const dbPastDone = await prisma.kanbanCard.findUnique({ where: { id: cardPastDone.id } });
  const pastDoneOk = dbPastDone && dbPastDone.dayDate.getTime() === twoDaysAgo.getTime();
  console.log(`- Card Passado Concluído permaneceu no passado: ${pastDoneOk ? '✅ PASS' : '❌ FAIL'}`);

  // D. Snapshot Passado -> Deve continuar no passado
  const dbPastSnapshot = await prisma.kanbanCard.findUnique({ where: { id: cardPastSnapshot.id } });
  const pastSnapshotOk = dbPastSnapshot && dbPastSnapshot.dayDate.getTime() === twoDaysAgo.getTime();
  console.log(`- Snapshot Passado permaneceu no passado: ${pastSnapshotOk ? '✅ PASS' : '❌ FAIL'}`);

  // E. Tarefa Criada Hoje -> Deve continuar hoje inalterada
  const dbTodayOpen = await prisma.kanbanCard.findUnique({ where: { id: cardTodayOpen.id } });
  const todayOpenOk = dbTodayOpen && dbTodayOpen.dayDate.getTime() === today.getTime() && dbTodayOpen.isRolledOver === false;
  console.log(`- Card de Hoje continuou em hoje inalterado: ${todayOpenOk ? '✅ PASS' : '❌ FAIL'}`);

  const totalOk = pastOpenOk && pastInProgressOk && pastDoneOk && pastSnapshotOk && todayOpenOk;
  console.log('\n=============================================================');
  if (totalOk) {
    console.log('✅ TODOS OS TESTES INTEGRADOS PASSARAM COM SUCESSO!');
  } else {
    console.log('❌ ALGUNS TESTES INTEGRADOS FALHARAM. VERIFIQUE OS LOGS.');
  }
  console.log('=============================================================\n');
}

testMigration().catch(err => {
  console.error('❌ Erro durante o teste integrado de migração:', err);
});
