# Plano de Fase - Fase 1: Segurança e Alinhamento de Banco de Dados

Este documento serve como o plano de execução detalhado e acionável para a **Fase 1**. Ele aborda vulnerabilidades críticas de segurança (IDOR, SQL Injection, uploads perigosos) e padroniza as conexões com o PostgreSQL local para evitar crashes silenciosos.

---

## 🎯 Objetivos da Fase

1. **Eliminar IDOR nas Rotas Kanban:** Garantir que usuários só possam ler, editar, deletar ou reordenar seus próprios cards.
2. **Prevenir Injeções SQL:** Refatorar as queries brutas de gravação e atualização de embeddings pgvector para usar placeholders parametrizados em vez de interpolação de strings.
3. **Restringir Uploads de Mídia (MIME types):** Configurar um `fileFilter` no Multer para aceitar apenas formatos de imagem seguros (`.png`, `.jpg`, `.jpeg`, `.webp`), bloqueando binários arbitrários.
4. **Padronizar e Limpar Conexão com PostgreSQL:** Habilitar suporte real ao Postgres/pgvector e ajustar esquemas e variáveis de ambiente para evitar os fallbacks de banco de dados corrompidos.

---

## 🛠️ Alterações Propostas

### 🟢 1. Modificar: `backend/src/routes/kanbanRoutes.ts`
*   **Ação REQ-SEC-01 (Mitigação de IDOR):**
    *   No endpoint `PUT /:id` (linha 328), buscar o card primeiro no banco e validar se `card.userId === req.user.userId`. Retornar `403 Forbidden` em caso de divergência.
    *   No endpoint `DELETE /:id` (linha 372), buscar o card no banco, validar propriedade e, ao deletar, realizar a chamada preventiva para excluir os anexos vinculados no MinIO (evitando vazamento de armazenamento S3).
    *   No endpoint `PUT /reorder/bulk` (linha 382), extrair a lista de IDs de cartões enviados no payload, fazer um `prisma.kanbanCard.count` combinando `id: { in: cardIds }` e `userId: req.user.userId`. Se o resultado for menor que o tamanho do lote, rejeitar a transação inteira com `403 Forbidden`.
*   **Ação REQ-SEC-03 (Filtro MIME Multer):**
    *   Configurar a inicialização do Multer na linha 11 com um `fileFilter` robusto:
        ```typescript
        const upload = multer({
          storage,
          limits: { fileSize: 5 * 1024 * 1024 }, // Reduzido para 5MB por segurança
          fileFilter: (req, file, cb) => {
            const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
            if (allowedTypes.includes(file.mimetype)) {
              cb(null, true);
            } else {
              cb(new Error('Tipo de arquivo não suportado. Envie apenas imagens.'));
            }
          }
        });
        ```
    *   Adicionar tratamento de erro apropriado na rota de upload para responder ao usuário com HTTP 400 em caso de erro de formato de arquivo.

### 🟢 2. Modificar: `backend/src/services/kanbanService.ts`
*   **Ação REQ-SEC-02 (SQL Injection pgvector):**
    *   Substituir as chamadas de interpolação direta no `prisma.$executeRawUnsafe` (linhas 180 e 196) por queries parametrizadas seguras usando `prisma.$executeRaw` estruturado como Tagged Template:
        ```typescript
        if (isPostgres && embedding.length > 0) {
          const embeddingFormat = `[${embedding.join(',')}]`;
          await prisma.$executeRaw`UPDATE "DailyReport" SET embedding = ${embeddingFormat}::vector WHERE id = ${existing.id}`;
        }
        ```

### 🟢 3. Modificar: `backend/prisma/schema.prisma`
*   **Ação REQ-ARCH-03 (Esquema PostgreSQL Local):**
    *   Alterar o `datasource db` para usar o provedor `postgresql` em vez de `sqlite`.
    *   Descomentar os enums `Role` e `KanbanStatus` no arquivo para utilizar tipos nativos Postgres do banco relacional, atualizando as colunas correspondentes nos models `User` e `KanbanCard`.
    *   Adicionar as definições de índice `@@index([userId])` e `@@index([dayDate])` no model `KanbanCard` para otimizar pesquisas de data e paginação.

### 🟢 4. Modificar: `backend/.env` e `.env.example`
*   **Ação REQ-ARCH-03 (Env Database Config):**
    *   Adicionar a variável `DATABASE_URL` no `.env` local do backend apontando para o servidor Postgres configurado no Docker Compose (`postgresql://kalend_user:kalend_pass@localhost:5432/kalend_ai?schema=public`).
    *   Alinhar configurações de MinIO e IA locais.

---

## 🧪 Plano de Verificação

### 1. Testes Automatizados / Scriptados
*   **Teste de Segurança (IDOR):** Criar script de requisição usando `curl` ou Axios para tentar chamar `PUT /api/kanban/:id` de um card criado pelo usuário B usando o token JWT do usuário A. O servidor deve responder rigorosamente com `403 Forbidden`.
*   **Teste de Filtro de Upload:** Enviar um arquivo executável (.exe) ou arquivo de texto (.txt) disfarçado para a rota `POST /api/kanban/:id/images`. O servidor deve rejeitar a requisição com HTTP 400.
*   **Verificação de Injeção SQL:** Injetar strings maliciosas de teste no payload do ID ou nas strings de geração para validar se o compilador e o ORM tratam de forma segura através dos bindings de parâmetros.

### 2. Testes Manuais
*   Inicializar o contêiner docker-compose local (`docker compose up -d postgres minio`).
*   Executar as migrações Prisma contra o Postgres local (`npx prisma migrate dev`).
*   Rodar o seeder para garantir a existência do primeiro administrador.
*   Manipular a SPA no navegador para testar drag and drop e upload de thumbnails, validando que o fluxo não dispara erros silenciosos nos consoles do Express ou do navegador.
