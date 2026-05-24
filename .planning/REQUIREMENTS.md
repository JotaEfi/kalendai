# 📋 Requisitos de Estabilização e Qualidade - KalendAI

Este documento estabelece os requisitos técnicos e funcionais necessários para estabilizar o KalendAI, corrigir vulnerabilidades de segurança, otimizar a performance do sistema e introduzir uma infraestrutura de qualidade de software robusta.

---

## 🔒 1. Requisitos de Segurança (Security Requirements)

### REQ-SEC-01: Mitigação de IDOR (Insecure Direct Object Reference) no Kanban
*   **Contexto:** Cartões do Kanban podem ser modificados, deletados ou reordenados de forma arbitrária fornecendo IDs nas rotas.
*   **Requisito:** Os endpoints `PUT /api/kanban/:id`, `DELETE /api/kanban/:id` e `PUT /api/kanban/reorder/bulk` devem validar de forma estrita se o `userId` associado ao cartão corresponde ao `userId` extraído do JWT Bearer token da requisição. Caso contrário, devem retornar erro HTTP `403 Forbidden` ou `404 Not Found`.

### REQ-SEC-02: Prevenção de Injeção SQL em Queries Vetoriais
*   **Contexto:** O `kanbanService.ts` utiliza interpolação de strings direta dentro de chamadas `prisma.$executeRawUnsafe` para inserções e consultas pgvector.
*   **Requisito:** Substituir todas as strings interpoladas por queries parametrizadas utilizando `prisma.$executeRaw` ou preparar as variáveis de forma segura, garantindo imunidade a ataques de SQL Injection.

### REQ-SEC-03: Restrição de Upload de Arquivos no Multer
*   **Contexto:** O middleware Multer atualmente aceita qualquer formato de arquivo enviado no multipart/form-data.
*   **Requisito:** Implementar um `fileFilter` customizado no Multer para restringir os uploads estritamente a imagens válidas (`image/png`, `image/jpeg`, `image/webp`). Arquivos executáveis ou de outros formatos devem ser rejeitados imediatamente no nível da requisição HTTP.

---

## ⚡ 2. Requisitos de Performance e Otimização (Performance Requirements)

### REQ-PERF-01: Migração de Anexos Base64 do Banco para o MinIO
*   **Contexto:** O frontend converte anexos colados em strings Base64 de até 3MB e as salva diretamente no banco de dados SQLite, gerando lentidão extrema.
*   **Requisito:** Modificar o fluxo de anexação para que todas as imagens sejam transmitidas ao MinIO Object Storage, armazenando no banco de dados apenas os metadados e as chaves de referência. O banco de dados não deve conter strings gigantes em Base64.

### REQ-PERF-02: Eliminação de Consultas N+1 e Loops Seriais
*   **Contexto:** Processos como rollover diário, cálculo de métricas mensais e geração de URLs pré-assinadas utilizam loops seriais assíncronos (`await` dentro de `for`), provocando gargalos massivos de rede.
*   **Requisito:** Otimizar algoritmos para utilizar queries em lote (`Prisma.createMany`, filtros `in` do SQL) e resolver promessas em paralelo (`Promise.all`), reduzindo o tempo de resposta das rotas críticas.

### REQ-PERF-03: Proteção contra Exaustão de Memória no Multer
*   **Contexto:** O uso de `memoryStorage` com limites altos de tamanho de arquivo expõe o servidor a travamentos OOM (Out Of Memory) sob concorrência.
*   **Requisito:** Configurar limites estritos de tamanho de upload no Multer (ex: máximo de 5MB por arquivo) e implementar controle de concorrência ou rate-limiting nos endpoints de upload.

---

## 🏗️ 3. Requisitos de Arquitetura e Confiabilidade (Architecture & Reliability)

### REQ-ARCH-01: Unificação de Agendadores (Rollover Duplicado)
*   **Contexto:** O sistema possui dois arquivos agendando crons em paralelo (`cronJobs.ts` e `rollover.ts`) para realizar o mesmo rollover de cartões à meia-noite, criando conflitos de escrita.
*   **Requisito:** Unificar a orquestração do rollover diário em um único agendador robusto e desativar stubs inativos (como rotas vazias de `eventRoutes.ts`).

### REQ-ARCH-02: Garantia de Segurança Transacional no Rollover
*   **Contexto:** Cartões inacabados de dias passados são duplicados e movidos sem transações de banco de dados, arriscando corrupção de dados se o servidor cair no meio do processo.
*   **Requisito:** Encapsular todo o fluxo de cópia, atualização e arquivamento de tarefas diárias em uma transação nativa do Prisma (`prisma.$transaction`).

### REQ-ARCH-03: Alinhamento de Ambiente de Banco de Dados
*   **Contexto:** O Prisma está configurado localmente para SQLite, mas o código tem comandos raw dependentes de PostgreSQL/pgvector.
*   **Requisito:** Padronizar o ambiente de desenvolvimento local para utilizar o contêiner Docker do PostgreSQL já configurado no `docker-compose.yml`, ou criar uma camada abstrata de banco de dados robusta para evitar crashes por incompatibilidade de dialetos SQL.

---

## 🧪 4. Requisitos de Qualidade e Testes (Quality Assurance)

### REQ-QA-01: Configuração do Vitest no Monorepo
*   **Requisito:** Configurar o Vitest como suíte de testes unitários e de integração em ambos os workspaces (`backend/` e `frontend/`). O comando `npm run test` na raiz do projeto deve orquestrar e rodar todos os testes.

### REQ-QA-02: Cobertura de Testes das Rotas e Serviços Críticos
*   **Requisito:** Implementar testes de integração usando `supertest` no backend cobrindo rotas de autenticação, rotação de JWT, CRUD de Kanban e segurança IDOR.

### REQ-QA-03: Testes End-to-End (E2E) com Playwright
*   **Requisito:** Configurar o Playwright no frontend para validar os fluxos completos do usuário: Login -> Visualizar Kanban -> Criar Cartão -> Mover Cartão (Drag & Drop) -> Anexar Imagem -> Visualizar Dashboard.
