# 🗺️ Roadmap de Evolução e Estabilização - KalendAI

Este roadmap divide a evolução técnica do KalendAI em fases focadas e lógicas, priorizando a segurança e a integridade de dados antes de otimizações de performance e qualidade de software.

---

## 🔒 Fase 1: Segurança e Alinhamento de Banco de Dados (Segurança e Base)
**Objetivo:** Eliminar todas as vulnerabilidades críticas identificadas (IDOR, Injeção SQL, Uploads Suspeitos) e alinhar os ambientes de banco de dados para evitar crashes silenciosos.

### 📋 Itens de Trabalho (Backlog)
- `[ ]` **IDOR Mitigation:** Implementar um middleware ou utilitário de validação de propriedade (`authorizeCardOwner`) nas rotas `PUT /api/kanban/:id`, `DELETE /api/kanban/:id` e `PUT /api/kanban/reorder/bulk`.
- `[ ]` **SQL Injection Prevention:** Refatorar as queries `Prisma.$executeRawUnsafe` no `kanbanService.ts` para usar chamadas parametrizadas `Prisma.$executeRaw` com placeholders seguros para a extensão pgvector.
- `[ ]` **Multer File Filter:** Configurar um filtro estrito de tipo MIME no Multer do backend para rejeitar uploads que não sejam imagens válidas (`png`, `jpg`, `jpeg`, `webp`).
- `[ ]` **PostgreSQL Docker Setup:** Padronizar a conexão local para rodar nativamente contra o PostgreSQL configurado no Docker Compose, eliminando a dependência do SQLite e prevenindo bugs de vetor em tempo de execução.

---

## ⚡ Fase 2: Performance e Otimização de Recursos (Performance e Limpeza)
**Objetivo:** Corrigir gargalos massivos de rede e armazenamento (Base64 no DB, consultas N+1) e simplificar os agendadores em segundo plano.

### 📋 Itens de Trabalho (Backlog)
- `[ ]` **Base64 to S3 Migration:** Modificar o Frontend para que as capturas de tela coladas (clipboard paste) façam upload multipart direto via API para o MinIO, salvando apenas o identificador da imagem no banco de dados.
- `[ ]` **N+1 Query Reduction:** Refatorar o rollover diário, listagem de imagens e consolidação de métricas mensais para rodar queries em lote (`Prisma.createMany`, filtros `in`) e `Promise.all` em vez de loops `for...await` síncronos.
- `[ ]` **Transaction Safety:** Envolver todo o algoritmo de rollover da meia-noite em uma transação robusta do Prisma (`prisma.$transaction`).
- `[ ]` **Cron Consolidation:** Eliminar a redundância de agendamentos consolidando o rollover diário no `cronJobs.ts` e removendo chamadas concorrentes do `rollover.ts`. Remover stubs inativos do `eventRoutes.ts`.

---

## 👥 Fase 3: Painel Admin, Grupos e Colaboração (Novas Funcionalidades)
**Objetivo:** Habilitar o painel administrativo para controle de grupos, convites automatizados de usuários (SMTP ou manual) e o ecossistema de compartilhamento/atribuição de tarefas com aba de Inbox, aceites/recusas e notificações.

### 📋 Itens de Trabalho (Backlog)
- `[ ]` **Database Schema Expansion:** Adicionar os modelos `UserGroup` e `Notification` no Prisma, expandindo o model `User` com relacionamento e executando a migração no Postgres.
- `[ ]` **Painel Administrativo:** Desenvolver uma interface no frontend para administradores criarem grupos de usuários e convidarem novos membros.
- `[ ]` **SMTP & Convites Automatizados:** Implementar serviço de e-mail no backend para convites. Se o SMTP não estiver configurado no `.env`, permitir inserção e senha manuais.
- `[ ]` **Atribuição Compartilhada:** Implementar lógica de backend e frontend para compartilhar e atribuir cards Kanban a membros do mesmo grupo de usuários.
- `[ ]` **Inbox e Notificações de Grupo:** Desenvolver a aba Inbox no frontend com notificações individuais. Permitir aceitar (transfere posse do card) ou recusar (devolve o card com notificação de recusa ao remetente).

---

## 🧪 Fase 4: Infraestrutura de Testes e QA (Qualidade de Software)
**Objetivo:** Configurar testes automatizados e suítes de validação para garantir que as vulnerabilidades resolvidas, a performance otimizada e os fluxos de colaboração não sofram regressões.

### 📋 Itens de Trabalho (Backlog)
- `[ ]` **Monorepo Vitest Setup:** Configurar o Vitest nos workspaces de `backend/` e `frontend/` com orquestração central de scripts no `package.json` raiz.
- `[ ]` **Backend API Integration Tests:** Desenvolver testes de integração com `supertest` cobrindo o fluxo de login, rotação invisível de JWT e verificações de proteção IDOR nas rotas Kanban.
- `[ ]` **Frontend Component & Hook Tests:** Criar testes de unidade para os hooks customizados de autenticação (rotação automática de tokens) e renderização do calendário.
- `[ ]` **Playwright E2E Suite:** Implementar testes ponta a ponta cobrindo toda a jornada do usuário (criar tarefa, atribuir tarefa no grupo, recusar/aceitar via Inbox e visualizar métricas).
- `[ ]` **CI/CD Integration:** Habilitar testes automatizados e checagens estáticas de tipos no workflow de deploy do GitHub Actions.
