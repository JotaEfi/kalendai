# Plano de Fase - Fase 2: Performance e Otimização de Recursos

Este documento descreve o plano de execução detalhado e acionável para a **Fase 2**. Esta fase resolve gargalos graves de rede, armazenamento e processamento (como o armazenamento inadequado de anexos Base64 gigantes no banco e consultas de banco redundantes em loop N+1), além de simplificar a arquitetura em segundo plano.

---

## 🎯 Objetivos da Fase

1. **Eliminar Bloat de Anexos Base64:** Migrar a colagem (Ctrl+V) e arrastar de arquivos no frontend para que façam uploads multipart diretos para o MinIO usando a rota `POST /api/kanban/:id/images`, salvando apenas os metadados de imagem (CardImage) no Postgres e limpando o campo de banco obsoleto `attachments`.
2. **Reduzir Consultas N+1 no Rollover:** Otimizar o rollover de meia-noite para processar em lotes (Prisma transactions e bulk updates) em vez de iterar de forma síncrona individual por usuário e card.
3. **Consolidar Agendadores Redundantes:** Excluir o arquivo morto/inativo `backend/src/jobs/rollover.ts` para evitar qualquer conflito futuro ou agendamento concorrente do mesmo processo.

---

## 🛠️ Alterações Propostas

### 🟢 1. Modificar: `frontend/src/pages/Calendar.tsx`
*   **Depreciação de Base64 Local:**
    *   Substituir a leitura local `FileReader.readAsDataURL` nas funções `handlePasteAttachment` e no input de anexo por uma chamada imediata de upload via FormData para a API: `POST /api/kanban/${editingCard.id}/images`.
    *   Isso integrará o arquivo colado ou selecionado diretamente com a infraestrutura do MinIO e salvará como um `CardImage` no banco.
    *   Remover o estado obsoleto `editAttachments` e remover a renderização redundante de anexos Base64 no modal, consolidando tudo no grid de imagens nativo do MinIO/CardImage.
    *   Simplificar `handleSaveCardEdits` para remover o payload `attachments: JSON.stringify(editAttachments)`.

### 🟢 2. Modificar: `backend/src/routes/kanbanRoutes.ts`
*   **Limpeza das Propriedades Obsoletas:**
    *   Remover a atualização e sanitização do campo `attachments` nos endpoints `PUT /:id` e `POST /` uma vez que a tabela não armazenará mais strings Base64 gigantescas.

### 🟢 3. Modificar: `backend/src/services/kanbanService.ts`
*   **Rollover Otimizado e Transacional (N+1 Mitigation):**
    *   Reescrever a função `processDailyRollover` para executar todo o rollover em uma única query otimizada por lote e envolver as ações em `prisma.$transaction`.
    *   Identificar todos os cards de ontem que não estão concluídos de uma só vez.
    *   Fazer um `createMany` para os clones (snapshots) do histórico e um `updateMany` para empurrar os cards ativos para o dia de hoje, garantindo atomicidade absoluta (ou tudo passa, ou nada passa).
*   **Otimização do Report N+1:**
    *   Substituir loops em série assíncronos no método de compilação de relatórios diários por resoluções paralelas com `Promise.all` para requisições de assinaturas do MinIO e chamadas de IA.

### 🟢 4. Deletar: `backend/src/jobs/rollover.ts`
*   **Eliminar Duplicidade:**
    *   Remover completamente o arquivo morto `rollover.ts`, consolidando a inicialização de cronjobs estritamente no `cronJobs.ts` que chama as rotas seguras do `kanbanService.ts`.

### 🟢 5. Modificar: `backend/prisma/schema.prisma`
*   **Limpeza do Banco:**
    *   Remover a coluna `attachments` do model `KanbanCard`, pois os anexos e mídias agora residem integralmente e exclusivamente no model relacional `CardImage` gerenciado pelo MinIO.

---

## 🧪 Plano de Verificação

### 1. Testes Automatizados / Scriptados
*   **Verificação de Migração Prisma:** Rodar `npx prisma migrate dev` para registrar a remoção da coluna `attachments` no Postgres sem causar perda de integridade nos relacionamentos das tabelas.
*   **Teste de Performance de Rollover:** Criar um lote de 50 tarefas inacabadas simuladas e testar o tempo de processamento do job de rollover em lote, validando a segurança transacional (interromper a conexão durante a transação deve reverter o banco ao estado original íntegro).

### 2. Testes Manuais
*   **Ctrl+V de Anexo no Modal:** Abrir o modal de edição de um card, colar uma imagem com Ctrl+V ou arrastar um arquivo de imagem e certificar-se de que o upload é feito de imediato para o MinIO e a thumbnail aparece instantaneamente no grid.
*   **Salvar Sem Bloat:** Validar no console de desenvolvimento de rede do navegador se a requisição de salvamento do cartão `PUT /api/kanban/:id` trafega payloads leves e sem strings de dados Base64 longas.
