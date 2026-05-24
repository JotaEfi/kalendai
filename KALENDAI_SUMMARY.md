# 📅 Resumo do Projeto: KalendAI

Este documento serve como um **guia descritivo completo** do projeto para contextualizar novos agentes de Inteligência Artificial, desenvolvedores e mantenedores. Ele detalha a arquitetura, stack tecnológico, histórico de requisições e todas as funcionalidades implementadas no KalendAI.

---

## 🧭 1. Visão Geral (Overview)

O **KalendAI** é uma aplicação Full-Stack voltada à **gestão focada de tempo e produtividade**. A plataforma une o modelo tradicional de calendário a um sistema de **Kanban diário**, adicionando superpoderes como: upload de evidências (imagens via MinIO/S3), geração autônoma de relatórios de produtividade utilizando IA e um Dashboard de análise de métricas mensais.

---

## 🛠️ 2. Stack Tecnológico

A aplicação está dividida em uma arquitetura limpa (Frontend Single Page Application + Backend API RESTful).

### ✨ Frontend
- **Framework**: React 18 (com Vite para build e HMR).
- **Linguagem**: TypeScript.
- **Estilização**: Tailwind CSS.
- **Ícones e UI**: Lucide-React.
- **Interações**: `@dnd-kit` para abstração de Drag & Drop (usado no Kanban do dia cruzando colunas e reordenação).
- **Requisições HTTP**: Axios (configurado com interceptors para envio automático dos JWT Bearer tokens).
- **Roteamento**: React Router DOM v6.

### ⚙️ Backend
- **Framework e Core**: Node.js + Express.
- **Linguagem**: TypeScript.
- **Database ORM**: Prisma.
- **Banco de Dados**: PostgreSQL com a extensão `pgvector` (via imagem estendida do Docker).
- **Autenticação e Segurança**: JSON Web Tokens (JWT) separando Access Token (curta duração) e Refresh Token (longa duração). Hashing local com `bcryptjs`.
- **Upload e Arquivos**: `multer` lidando com multipart/form-data em memória.
- **Integração S3/Object Storage**: `@aws-sdk/client-s3` (para comunicar com um servidor MinIO/S3 self-hosted).
- **Integração IA**: Múltiplos provedores modulares (suportando `@google/genai` e requisições raw REST via fetchful para Ollama/Deepseek API).

### 🚀 Infraestrutura & CI/CD
- **Containerização**: Docker e `docker-compose.yml` orquestrando Frontend (servido no Nginx em load/proxy route), Backend, e PostgreSQL.
- **CI/CD Pipeline**: GitHub Actions configurado para disparo em merge na `main` (`.github/workflows/deploy.yml`), realizando build, push via Docker Hub, autenticação via SSH e refresh/restart do docker remoto na VPS.

---

## 📦 3. Módulos e Funcionalidades Implementadas

### 🔐 3.1. Autenticação & Gestão de Acesso
- Fluxo de login utilizando `email` e `password`.
- Proteção robusta de senhas (bcrypt).
- **Endpoints**: `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`.
- Geração automática do primeiro administrador via arquivo de seed (`seed.ts` idempotente).

### 📋 3.2. Kanban Diário (Gestão de Tarefas)
Todo dia tem seu próprio board Kanban, desvinculando tarefas infinitas e priorizando "o que preciso fazer hoje".
- **Colunas Base**: OPEN (A Fazer), IN PROGRESS (Fazendo), DONE (Feito).
- **Ações Ativas (CRUD)**: Criação rápida de cards, alteração de cores para etiquetas, suporte a descrição, arrastar/reordenar cards entre colunas.
- **Cálculos de Duração**: O sistema cronometra invisivelmente o momento de criação do card versus o exato momento que ele é dragado/movido para 'DONE' usando `completedAt`, possibilitando métricas de tempo total gasto na tarefa.
- **Rollover**: Visualização ou duplicação/movimentação de tasks incompletas de dias passados.

### 🖼️ 3.3. Armazenamento com MinIO (AWS SDK S3 Compatível)
- Permite que o usuário **anexe imagens limitadas** como "provas" ou evidências diretamente nas tarefas de seu Kanban.
- **Auto-Provisionamento**: Na inicialização (bootstrap) do `server.ts`, se o Bucket do MinIO configurado nas variáveis de ambiente (.env) não existir, ele é gerado auto-magicamente (`CreateBucketCommand`).
- **Segurança S3**: O backend gera **URLs pré-assinadas** (`getSignedUrl`) com expiração contada (ex: 1 hora) para as imagens serem consultadas temporariamente no Frontend. O bucket não precisa ser inteiramente aberto para acesso público.
- **Frontend Lightbox**: Interface UX onde, ao clicar em um anexo thumbnail, ele expande centralizado e em alta resolução (dim da página).

### 🤖 3.4. Motor de IA e Relacionamento Diário (LLM + Vector Embeddings)
- **Otimização Extrema de Tokens**: Para gerar resumos automáticos sobre o que ocorreu no dia, é montado um payload estrito estruturado contendo dados enxutos (título, tempo formatado em XhYm e flags de imagem).
- **Geração de Embeddings**: Textos do relatório são transformados em _vetores_ matemáticos comunicando com embeddings da Deepseek / Gemini / OpenAI e salvos usando o módulo nativo `pgvector` (`vector(1536)`) em colunas SQL do Prisma `executeRawUnsafe`. Isso prepara o terreno para um futuro sistema de RAG (Busca semântica inteligente).
- **Relatórios Fixos Diários**: Os resumos gerados ficam atrelados ao registro diário (`DailyReport`).

### 📊 3.5. Dashboard de Performance Mensal Analytics
- **Rota Dedicada**: `/dashboard`.
- **Métricas Retornadas e Calculadas**:
  1. Total de Tarefas Criadas no Mês.
  2. Total de Tarefas Efetivamente Concluídas no Mês.
  3. **Taxa de Conclusão**: `(Concluídas / Criadas) * 100`.
  4. **Tempo Médio de Conclusão (Horas)**: Baseado no delta de marcação `createdAt` versus `completedAt`.
- **Gráfico de Semanas**: O backend fragmenta o mês em blocos (Dias 1-7, 8-14, 15-21, 22+) enviando fluxos segmentados. O Frontend desenha colunas bar graph (Azul e Verde) proporcionalmente dinâmicas utilizando flexboxes e math calculations.
- **Logs de Relatório Histórico**: Widget contendo os últimos 5 relatórios de AI com um botão para ler a versão integral deles num Dialog Lightbox.

---

## 🗺️ 4. Mapa das Variáveis de Ambiente Necessárias (`.env.example`)

Os seguintes itens foram mapeados como pilares do env:
- `DATABASE_URL` (Postgres com schema).
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `REFRESH_TOKEN_...`.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
- `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET_NAME`.
- `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`.
- `PORT`, `NODE_ENV`, `TIMEZONE`.

---

## 📜 5. Histórico e Contexto da Implementação (Ações Realizadas)

Durante o processo de arquitetura por prompts, as seguintes migrações e comandos chave foram executados num ciclo encadeado:

1. **Bootstrap e Auth**: Migração do projeto template básico para suporte ao Tailwind Completo. Implementação da estante JWT Bearer no axios (`Frontend > src/services/api.ts`).
2. **Setup do PostgreSQL/PGVector via Prisma**: Substituição completa do inicializador obsoleto 'SQLite' e do `better-sqlite3` corrompido, por um esquema escalável Prisma usando PostgreSQL. Criação dos models.
3. **Módulo de Kanban + Calendário DnD**: Design UX moderno para os cards da SPA, com layout de calendário grande usando grids Tailwind (`Calendar.tsx`). Formatação de datas em relógios locais com Locale PT-BR.
4. **Acoplamento do S3 (MinIO)**: Criação de rotas explícitas REST, middlewares e controllers (`minioService.ts` e `kanbanRoutes.ts`) processando Streams Multipart com o `multer` e invocando comandos `PutObjectCommand`/`GetObjectCommand`. Integração perfeita do painel Front com o MinIO de thumbnail.
5. **Implementações do provedor de IA e Embeds Vetoriais**: Modularização das variáveis (.env) permitindo que o provedor seja customizável (Gemini, Deepseek, OpenAI). Extração dos dados dos nodes e insert raw type `::vector` no banco relacional PostgreSQL (`kanbanService.ts`).
6. **Construção do Dashboard Analítico**: Design limpo, bento-grid modularizado para exibir as contagens estáticas, implementação do gráfico horizontal custom em CSS, interligações com requisições API puras. Fix das datas no Dashboard utilizando ranges fechados do tipo data no Node (`>= startMonthDate` e `< startMonthEnd`).
7. **Bugs Solucionados Pós-Build**: Correção na tipização de Retornos Omitidos e divergências de Types no Vector Embeddings SDK do `@google/genai` (lidando com `.embeddings?.[0]?.values` vs `.embedding.values`), garantindo assim builds TypeScript livres de errors de compilação.

---

> **Aviso ao Novo Agente Mentor:** Nunca ignore o contexto existente neste resumo antes de apagar, deletar, refatorar ou modificar as configurações vitais descritas (MinIO, PostgreSQL, Prisma, e Configs da API JWT/Axios). O projeto está maduro, testado e construído modularmente com total foco em Clean Code no TypeScript.
