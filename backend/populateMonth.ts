import { PrismaClient, KanbanStatus, ReportType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();

const taskPool = [
  {
    title: 'Implementar autenticação JWT',
    description: 'Criar as rotas de login, logout e refresh token usando cookies seguros HttpOnly.',
    color: '#0079bf' // Blue
  },
  {
    title: 'Configurar Helmet e HSTS',
    description: 'Injetar cabeçalhos de segurança HTTP na API Express, protegendo contra XSS e ocultando assinaturas do Node/Express.',
    color: '#34bfa3' // Green
  },
  {
    title: 'Rate Limit nas rotas de Auth',
    description: 'Adicionar limite estrito de 5 requisições por 15 minutos por IP para evitar ataques de brute force no login e cadastro.',
    color: '#f4516c' // Red
  },
  {
    title: 'Validação de inputs com Zod',
    description: 'Implementar middleware de validação validateRequest para sanitizar requisições e mitigar Mass Assignment.',
    color: '#ffb822' // Yellow
  },
  {
    title: 'Configurar bucket no MinIO',
    description: 'Inicializar o bucket local "kalend-ai-images" e definir políticas de leitura pública para as URLs de anexo.',
    color: '#716aca' // Purple
  },
  {
    title: 'Mitigar N+1 queries no Rollover',
    description: 'Refatorar o job diário de rollover para executar operações em lote (transactions e updateMany) em vez de queries síncronas em loop.',
    color: '#0079bf'
  },
  {
    title: 'Mapear arquivos anexados no banco',
    description: 'Estruturar o model CardImage para salvar chaves de objeto do MinIO no PostgreSQL, removendo o campo de Base64 obsoleto.',
    color: '#34bfa3'
  },
  {
    title: 'Revisar configuração de CORS',
    description: 'Permitir origens específicas lidas dinamicamente do .env em produção e liberar automaticamente localhost em desenvolvimento.',
    color: '#ffb822'
  },
  {
    title: 'Escrever testes unitários de rotas',
    description: 'Desenvolver testes com Vitest e Supertest para as rotas Kanban e Auth, validando integridade de retornos 400 e 429.',
    color: '#716aca'
  },
  {
    title: 'Auditoria de licenças de dependências',
    description: 'Configurar o license-checker para identificar e bloquear pacotes com licenças restritivas incompatíveis no build.',
    color: '#f4516c'
  },
  {
    title: 'Refatorar tratamento global de erros',
    description: 'Aprimorar o middleware de erro do Express para não expor stacktraces em produção e retornar JSON estruturado.',
    color: '#0079bf'
  },
  {
    title: 'Integração de npm audit no CI/CD',
    description: 'Incluir step na pipeline do GitHub Actions para falhar o build caso vulnerabilidades de nível High/Critical sejam encontradas.',
    color: '#34bfa3'
  },
  {
    title: 'Configurar linter de segurança',
    description: 'Instalar e ativar as regras do eslint-plugin-security para varrer o código local em busca de injeções dinâmicas.',
    color: '#ffb822'
  },
  {
    title: 'Reunião de alinhamento de Sprint',
    description: 'Apresentar à equipe as melhorias de segurança defensiva implementadas na API do Kanban.',
    color: '#716aca'
  },
  {
    title: 'Preparar documentação de deploy',
    description: 'Escrever as instruções de configuração do .env e proxy reverso Nginx para o ambiente de produção.',
    color: '#34bfa3'
  },
  {
    title: 'Otimizar tempo de build do frontend',
    description: 'Configurar caching de assets no Nginx e otimizar bundle final gerado pelo Vite.',
    color: '#f4516c'
  },
  {
    title: 'Corrigir bug de rollover à meia-noite',
    description: 'Garantir que a compilação do relatório considere o timezone configurado (America/Sao_Paulo) e não apenas UTC puro.',
    color: '#ffb822'
  },
  {
    title: 'Auditar permissões de IDOR',
    description: 'Verificar se todas as rotas Kanban validam que o userId do card pertence ao usuário logado na requisição.',
    color: '#0079bf'
  },
  {
    title: 'Planejar estratégia de marketing',
    description: 'Definir cronograma de lançamento do projeto como open-source no GitHub e postagens promocionais no LinkedIn.',
    color: '#34bfa3'
  },
  {
    title: 'Refatorar lógica de notificações',
    description: 'Implementar a listagem e leitura de notificações na Inbox do usuário quando receber atribuição de tarefas.',
    color: '#716aca'
  }
];

async function main() {
  console.log('🌱 Iniciando população corrigida de alta fidelidade com relatórios diários...');

  // 1. Criar ou buscar grupo de usuários
  const group = await prisma.userGroup.upsert({
    where: { id: 'squad-kalendai-id' },
    update: {},
    create: {
      id: 'squad-kalendai-id',
      name: 'Squad KalendAI'
    }
  });

  // 2. Criar ou buscar usuários de demonstração
  const passwordHash = await bcrypt.hash('Joao@1234', 10);
  const joao = await prisma.user.upsert({
    where: { email: 'joao@kalend.ai' },
    update: { groupId: group.id },
    create: {
      email: 'joao@kalend.ai',
      name: 'João Silva',
      passwordHash,
      role: 'USER',
      groupId: group.id
    }
  });

  const maria = await prisma.user.upsert({
    where: { email: 'maria@kalend.ai' },
    update: { groupId: group.id },
    create: {
      email: 'maria@kalend.ai',
      name: 'Maria Santos',
      passwordHash,
      role: 'USER',
      groupId: group.id
    }
  });

  // 3. Limpar cards e relatórios antigos do João para junho de 2026
  const startDate = new Date(2026, 5, 1);
  const endDate = new Date(2026, 6, 1); // 1 de Julho de 2026
  
  await prisma.kanbanCard.deleteMany({
    where: {
      userId: joao.id,
      dayDate: {
        gte: startDate,
        lt: endDate
      }
    }
  });
  console.log('🧹 Limpeza de cards antigos concluída.');

  await prisma.dailyReport.deleteMany({
    where: {
      userId: joao.id,
      date: {
        gte: startDate,
        lt: endDate
      }
    }
  });
  console.log('🧹 Limpeza de relatórios antigos concluída.');

  // 4. Popular o mês de Junho de 2026 (hoje é dia 30/06/2026)
  let totalCardsCreated = 0;
  let totalReportsCreated = 0;
  
  for (let day = 1; day <= 30; day++) {
    const dayDate = new Date(Date.UTC(2026, 5, day, 0, 0, 0, 0));
    const numCards = Math.floor(Math.random() * 4) + 3; // 3 a 6 cards
    const shuffledPool = [...taskPool].sort(() => Math.random() - 0.5);

    const isToday = day === 30;
    const completedTasksTitles: string[] = [];

    // Gerar Cards
    for (let i = 0; i < numCards; i++) {
      const taskDef = shuffledPool[i % shuffledPool.length];
      
      if (!isToday) {
        // DIAS PASSADOS (1 a 29): Apenas cards DONE!
        const hour = Math.floor(Math.random() * 9) + 9;
        const minute = Math.floor(Math.random() * 60);
        const completedAt = new Date(Date.UTC(2026, 5, day, hour, minute, 0, 0));

        // 10% de chance do card concluído ter sido rolado de ontem ou antes
        const isRolled = Math.random() < 0.10 && day > 1;
        let originalDayDate = dayDate;
        if (isRolled) {
          originalDayDate = new Date(Date.UTC(2026, 5, day - 1, 0, 0, 0, 0));
        }

        await prisma.kanbanCard.create({
          data: {
            userId: joao.id,
            title: taskDef.title,
            description: taskDef.description,
            color: taskDef.color,
            status: 'DONE',
            order: i,
            dayDate,
            originalDayDate,
            isRolledOver: isRolled,
            isSnapshot: false,
            completedAt
          }
        });
        totalCardsCreated++;
        completedTasksTitles.push(taskDef.title);

      } else {
        // HOJE (Dia 30): Mix de DONE, OPEN e IN_PROGRESS
        const roll = Math.random();
        let status: KanbanStatus = 'OPEN';
        let completedAt: Date | null = null;
        
        if (roll < 0.40) {
          status = 'DONE';
          const hour = Math.floor(Math.random() * 9) + 9;
          const minute = Math.floor(Math.random() * 60);
          completedAt = new Date(Date.UTC(2026, 5, day, hour, minute, 0, 0));
          completedTasksTitles.push(taskDef.title);
        } else if (roll < 0.75) {
          status = 'IN_PROGRESS';
        }

        // Simulação de rollover de tarefas ativas vindas do passado (dia 29)
        const isRolled = Math.random() < 0.30;
        let originalDayDate = dayDate;
        if (isRolled) {
          originalDayDate = new Date(Date.UTC(2026, 5, 29, 0, 0, 0, 0));

          // Opcionalmente criamos o Snapshot correspondente no dia 29 para fidelidade total
          await prisma.kanbanCard.create({
            data: {
              userId: joao.id,
              title: taskDef.title,
              description: taskDef.description,
              color: taskDef.color,
              status: 'OPEN',
              order: i,
              dayDate: originalDayDate,
              originalDayDate,
              isRolledOver: false,
              isSnapshot: true, // É o snapshot estático no passado
              completedAt: null
            }
          });
          totalCardsCreated++;
        }

        await prisma.kanbanCard.create({
          data: {
            userId: joao.id,
            title: taskDef.title,
            description: taskDef.description,
            color: taskDef.color,
            status,
            order: i,
            dayDate,
            originalDayDate,
            isRolledOver: isRolled,
            isSnapshot: false, // É o card ativo de hoje
            completedAt
          }
        });
        totalCardsCreated++;
      }
    }

    // Gerar Relatórios para este dia
    // 100% de chance de ter V1
    const v1Content = `### Relatório de Produtividade IA (V1) - Dia ${day}/06/2026\n\nNo dia de hoje, a equipe trabalhou com foco em segurança e otimização. Foram concluídas as seguintes tarefas de alta importância:\n\n` + 
      completedTasksTitles.map(t => `- **${t}**: Finalizado com sucesso.`).join('\n') + 
      `\n\n**Conclusão**: O dia foi extremamente produtivo, atingindo todas as metas operacionais estabelecidas no planejamento da sprint.`;

    await prisma.dailyReport.create({
      data: {
        userId: joao.id,
        date: dayDate,
        content: v1Content,
        version: 1,
        reportType: 'AI_MANUAL',
        isAutomatic: false,
        generatedAt: new Date(Date.UTC(2026, 5, day, 18, 0, 0, 0))
      }
    });
    totalReportsCreated++;

    // 60% de chance de ter V2
    if (Math.random() < 0.60) {
      const v2Content = `### Relatório IA Atualizado (V2) - Dia ${day}/06/2026\n\nRefinamento manual das métricas do dia. Ajustes nas prioridades de rollover diárias. A equipe focou no refinamento do código do monorepo.`;
      await prisma.dailyReport.create({
        data: {
          userId: joao.id,
          date: dayDate,
          content: v2Content,
          version: 2,
          reportType: 'AI_MANUAL',
          isAutomatic: false,
          generatedAt: new Date(Date.UTC(2026, 5, day, 20, 30, 0, 0))
        }
      });
      totalReportsCreated++;
    }

    // 40% de chance de ter V3 (Automático 23:59)
    if (Math.random() < 0.40) {
      const v3Content = `### Relatório de Encerramento Automático (V3) - Dia ${day}/06/2026\n\nSistema fechado às 23:59. Todas as tarefas pendentes foram movidas para o próximo dia útil. Relatório consolidado gerado automaticamente pelo cron do KalendAI.`;
      await prisma.dailyReport.create({
        data: {
          userId: joao.id,
          date: dayDate,
          content: v3Content,
          version: 3,
          reportType: 'AUTOMATIC',
          isAutomatic: true,
          generatedAt: new Date(Date.UTC(2026, 5, day, 23, 59, 0, 0))
        }
      });
      totalReportsCreated++;
    }
  }

  console.log(`🎉 População concluída! Criados ${totalCardsCreated} cards e ${totalReportsCreated} relatórios diários de alta fidelidade.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Erro no script:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
