# KalendAI

> Calendario, Kanban diario e relatorios inteligentes para transformar rotina em evidencia, foco e evolucao mensuravel.

KalendAI é uma aplicação full-stack para gestão de produtividade pessoal ou corporativa. A ideia central é simples: cada dia tem seu próprio Kanban, as tarefas podem receber evidencias visuais, e uma IA gera relatórios objetivos sobre o que aconteceu. O resultado é uma agenda operacional que não vira lista infinita, mas sim um registro vivo de progresso.

## O Que O Projeto Entrega

- **Calendario + Kanban diario**: organize tarefas por dia nas colunas `OPEN`, `IN_PROGRESS` e `DONE`.
- **Evidencias por tarefa**: anexe imagens a cards, armazenadas em MinIO/S3 com URLs pre-assinadas.
- **Relatorios com IA**: gere resumos diarios a partir das tarefas criadas, concluidas e pendentes.
- **Dashboard mensal**: acompanhe tarefas criadas, concluidas, taxa de conclusao, tempo medio e historico de relatorios.
- **Admin e grupos**: crie grupos, convide usuarios e proponha atribuicoes de tarefas entre membros.
- **Pronto para deploy**: Docker Compose, Prisma migrations e GitHub Actions para CI/CD.

## Stack

| Camada | Tecnologias |
| --- | --- |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, Axios, Zustand, dnd-kit |
| Backend | Node.js, Express, TypeScript, Prisma, JWT, bcrypt, Zod |
| Banco | PostgreSQL com `pgvector` |
| Storage | MinIO/S3 compativel via AWS SDK |
| IA | Provedor unico configuravel via `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL` |
| Infra | Docker, Docker Compose, Nginx, GitHub Actions |

## Como Rodar o Projeto Localmente

O KalendAI utiliza Docker para prover o banco de dados PostgreSQL com `pgvector` e o armazenamento de arquivos MinIO (S3 local). Siga os passos abaixo para subir o ambiente completo de desenvolvimento.

### Pré-requisitos
- Node.js (v20 ou superior)
- Docker e Docker Compose instalados

### Passo 1: Clonar e Instalar Dependências
Instale as dependências na raiz do monorepo:
```bash
npm install
```

### Passo 2: Configurar as Variáveis de Ambiente
Copie o arquivo de exemplo na raiz do projeto:
```bash
cp .env.example .env
```
*(Opcional: Ajuste as variáveis como `JWT_SECRET` ou chaves de IA se necessário).*

### Passo 3: Iniciar a Infraestrutura Local (Docker)
Suba os containers do PostgreSQL com extensão de vetores e do MinIO em segundo plano:
```bash
docker compose -f docker-compose.local.yml up -d
```

### Passo 4: Sincronizar o Banco de Dados e Gerar o Cliente Prisma
Com os containers rodando, envie o esquema de tabelas do Prisma para a instância local do Postgres e gere as tipagens do client:
```bash
# Executado a partir do host (raiz do projeto)
$env:DATABASE_URL="postgresql://postgres:localpass@localhost:5435/kalendai?sslmode=disable"
npx prisma db push --schema backend/prisma/schema.prisma
```

### Passo 5 (Recomendado): Popular Dados de Demonstração (Mostruário)
Para preencher o calendário, o Kanban e o Dashboard com dados realistas (tarefas de alta fidelidade e relatórios diários V1, V2 e V3 para o mês completo de Junho/2026), rode o nosso script de população:
```bash
$env:DATABASE_URL="postgresql://postgres:localpass@localhost:5435/kalendai?sslmode=disable"
npx tsx backend/populateMonth.ts
```
*Credenciais geradas:*
* **Usuário:** `joao@kalend.ai` | **Senha:** `Joao@1234`
* **Administrador Padrão:** `joaodaviabc@gmail.com` | **Senha:** `Bobebelinha5613@1`

### Passo 6: Iniciar os Servidores de Desenvolvimento
Inicie os servidores do Frontend (Vite) e Backend (Express) com hot-reload ativo:
```bash
npm run dev
```

* **Frontend**: Acesse em [http://localhost:5173](http://localhost:5173)
* **Backend API**: Rodando em [http://localhost:3001](http://localhost:3001)

---

## 🧪 Qualidade de Código & Testes

Mantemos suítes estritas para garantir conformidade de segurança e qualidade do código:

* **Testes de Integração (Vitest)**: Valida Helmet, CORS, Zod Schemas e Rate Limiters.
  ```bash
  npm run test --workspace=backend
  ```
* **Linter Estático de Segurança (SAST)**: Analisa o código em busca de injeções dinâmicas de código.
  ```bash
  npm run lint
  ```
* **Checagem de Licenças de Dependências**: Garante conformidade de licenças comerciais.
  ```bash
  npm run license-check
  ```

## Configurando O `.env`

O arquivo `.env.example` e o contrato oficial de configuracao. Para iniciar, copie para `.env` e ajuste os valores sensiveis localmente ou via secrets do ambiente de deploy.

```bash
cp .env.example .env
```

Variaveis principais:

| Variavel | Uso |
| --- | --- |
| `DATABASE_URL` | String de conexao PostgreSQL usada pelo Prisma. |
| `JWT_SECRET` | Segredo do access token. Troque em producao. |
| `REFRESH_TOKEN_SECRET` | Segredo do refresh token. Troque em producao. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Usuario administrador criado pelo seeder. |
| `MINIO_*` | Credenciais e endpoint do storage S3/MinIO. |
| `AI_PROVIDER` | Provedor de IA ativo, por exemplo `gemini`, `deepseek` ou `openai`. |
| `AI_API_KEY` | Chave do provedor escolhido. Use apenas esta chave de IA. |
| `AI_MODEL` | Modelo de texto usado para gerar relatorios. |
| `AI_BASE_URL` | Base URL opcional para provedores compativeis com OpenAI/Deepseek. |
| `FRONTEND_URL` | Origem permitida no CORS, por exemplo `https://app.seudominio.com`. |
| `MAX_ATTACHMENTS_PER_CARD` | Limite de anexos por card. |
| `MAX_ATTACHMENT_SIZE_MB` | Limite de tamanho por anexo. |
| `SMTP_*` | Configuracao de envio de convites por e-mail. |

Importante: `.env` fica fora do Git. Use `.env.example` somente com placeholders seguros.

## Seeder

O seeder cria ou atualiza o primeiro administrador usando as variaveis:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_NAME`

Ele e idempotente: pode ser executado mais de uma vez sem duplicar o admin.

```bash
npm run seed --workspace=backend
```

No container de producao, o `backend/entrypoint.sh` aplica migrations com `prisma migrate deploy` e executa o seeder antes de subir a API.

## API

Todas as rotas protegidas usam JWT Bearer:

```http
Authorization: Bearer <accessToken>
```

Fluxo de autenticacao:

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kalend.ai","password":"troque-esta-senha"}'
```

Rotas principais:

| Metodo | Rota | Descricao |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Autentica usuario e retorna `accessToken`, `refreshToken` e dados do usuario. |
| `POST` | `/api/auth/refresh` | Renova o access token usando refresh token valido. |
| `POST` | `/api/auth/logout` | Revoga refresh token. |
| `PUT` | `/api/auth/profile` | Atualiza nome e e-mail do usuario autenticado. |
| `GET` | `/api/kanban/:date` | Lista cards de um dia (`YYYY-MM-DD`). |
| `GET` | `/api/kanban/month/:year/:month` | Lista cards do mes. |
| `POST` | `/api/kanban` | Cria card no Kanban diario. |
| `PUT` | `/api/kanban/:id` | Atualiza card. |
| `DELETE` | `/api/kanban/:id` | Remove card e limpa anexos no storage. |
| `PUT` | `/api/kanban/reorder/bulk` | Reordena cards e altera status em lote. |
| `POST` | `/api/kanban/:id/images` | Envia anexo no campo multipart `image`. |
| `DELETE` | `/api/kanban/:id/images/:imageId` | Remove anexo do card. |
| `GET` | `/api/kanban/report?date=YYYY-MM-DD` | Busca relatorio diario salvo. |
| `POST` | `/api/kanban/report` | Gera relatorio manual com IA. |
| `GET` | `/api/dashboard?month=YYYY-MM` | Retorna metricas mensais e ultimos relatorios. |
| `GET` | `/api/admin/groups` | Lista grupos e membros. Requer admin. |
| `POST` | `/api/admin/groups` | Cria grupo. Requer admin. |
| `POST` | `/api/admin/users/invite` | Cria/convida usuario para grupo. Requer admin. |

Exemplo de criacao de card:

```bash
curl -X POST http://localhost:3001/api/kanban \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{"title":"Fechar relatorio","description":"Consolidar entregas do dia","dayDate":"2026-05-24","color":"#0079bf"}'
```

Exemplo de upload:

```bash
curl -X POST http://localhost:3001/api/kanban/<cardId>/images \
  -H "Authorization: Bearer <accessToken>" \
  -F "image=@evidencia.png"
```

## CI/CD

O workflow em `.github/workflows/deploy.yml` roda em pull requests e pushes para `main`:

- instala dependencias com `npm ci`;
- gera Prisma Client;
- executa build do backend e frontend;
- valida build Docker dos dois servicos;
- em push para `main`, publica imagens no Docker Hub;
- faz deploy via SSH na VPS usando Docker Compose.

Secrets esperados no GitHub:

- `DOCKER_USERNAME`
- `DOCKER_PASSWORD`
- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`
- `VPS_APP_DIR` opcional, padrao `kalend-ai`

## Seguranca

- `.env` e arquivos locais sensiveis estao no `.gitignore`.
- Use segredos fortes em producao para JWT, refresh token, admin e storage.
- Configure `FRONTEND_URL` para restringir CORS fora do desenvolvimento.
- Buckets MinIO/S3 devem permanecer privados; o backend entrega acesso via URL pre-assinada.
- Nunca publique `.env` real, dumps de banco, bancos locais ou arquivos de upload.

## Estrutura

```text
kalendai/
  backend/      API Express, Prisma, jobs, servicos de IA e MinIO
  frontend/     SPA React/Vite
  .github/      CI/CD GitHub Actions
  .planning/    Documentacao e contexto GSD do projeto
```

## Licenca

Apache-2.0.
