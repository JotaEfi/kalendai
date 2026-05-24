# 📅 Projeto KalendAI - Contexto e Visão Geral

Este documento descreve a visão geral, objetivos, stack tecnológica e restrições de arquitetura do projeto **KalendAI**. Ele serve como fonte da verdade de alto nível para o ciclo de vida do projeto e planejamento do GSD.

---

## 🧭 1. Visão Geral (Vision & Overview)

O **KalendAI** é uma plataforma Full-Stack voltada para a **gestão focada de tempo e produtividade pessoal e corporativa**. Diferente de calendários tradicionais com listas infinitas e desanimadoras, o KalendAI une o conceito de agenda tradicional a um **Kanban diário**, incentivando o usuário a planejar e concluir tarefas dentro do dia.

Adicionalmente, o sistema fornece superpoderes de produtividade:
1. **Upload de Evidências:** Os usuários podem anexar capturas de tela/imagens que comprovam a realização de tarefas específicas.
2. **Relatório Diário Automatizado por IA:** Uma IA analisa o que foi feito no dia e gera um relatório construtivo e inteligente.
3. **Dashboard Analítico:** Métricas mensais de produtividade, taxa de conclusão de tarefas e tempo médio gasto, além de gráficos de progresso.
4. **Prontidão RAG (Retrieval-Augmented Generation):** Busca semântica e contextual sobre o histórico de atividades baseada em Vector Embeddings.

---

## 🛠️ 2. Stack Tecnológico

A arquitetura do KalendAI é separada em camadas limpas (SPA no Frontend e API RESTful no Backend):

| Camada | Tecnologia Principal | Descrição / Uso |
| :--- | :--- | :--- |
| **Frontend** | React 18 + Vite | Framework SPA e sistema de build ultra-rápido. |
| **Linguagem** | TypeScript | Tipagem estática em ambas as pontas. |
| **Design / UI** | Tailwind CSS v4 + Lucide | Estilização moderna, responsiva e performática. |
| **Drag & Drop** | `@dnd-kit/core` | Biblioteca para a manipulação dos cartões no Kanban. |
| **State / API** | Zustand + Axios | Controle de estado global e requisições HTTP com interceptores. |
| **Backend** | Node.js + Express | Servidor de aplicação leve e modularizado. |
| **ORM / Banco** | Prisma + PostgreSQL / SQLite | Abstração de dados. Uso de `pgvector` em Postgres para RAG. |
| **Object Storage** | MinIO (Compatível S3) | Servidor local para armazenamento seguro de arquivos de evidências. |
| **Motor de IA** | Gemini SDK (`@google/genai`) | Geração de resumos de atividades e geração de embeddings. |
| **Containers** | Docker & Docker Compose | Orquestração do Frontend (Nginx), Backend, Postgres e MinIO. |
| **CI/CD** | GitHub Actions | Builds automatizados e deploy contínuo em VPS via SSH. |

---

## 🔑 3. Funcionalidades Centrais

*   **Autenticação JWT Segura:** Fluxo de autenticação robusto separando Access Token (curta duração em memória) e Refresh Token (longa duração em cookie seguro HTTP-only).
*   **Kanban de Dia Único:** Board dinâmico com colunas `OPEN` (A Fazer), `IN PROGRESS` (Fazendo) e `DONE` (Feito), com cronometragem invisível de tempo de conclusão.
*   **Upload Efêmero com S3/MinIO:** Anexação de fotos de evidência com links temporários pré-assinados gerados dinamicamente no backend, sem expor o bucket publicamente.
*   **Análise Semântica de Atividades:** Sumarização estruturada do dia e gravação de embeddings vetoriais de 1536 dimensões (`vector(1536)`) no banco de dados para preparar busca contextual inteligente.
*   **Bento-Grid Dashboard:** Visualizações analíticas mensais, gráficos de progresso por semana desenhados em CSS puro e logs dos relatórios históricos de IA.

---

## ⚠️ 4. Restrições e Premissas

1. **Dual-Database Adapter:** O sistema deve suportar desenvolvimento ágil em SQLite (`dev.db`), mas ter compatibilidade total em produção com PostgreSQL e a extensão `pgvector`.
2. **Segurança Extrema:** Nenhuma imagem deve ser acessível publicamente sem assinatura temporária ativa. Os tokens JWT de autenticação devem rotacionar de forma invisível via interceptor Axios.
3. **Responsividade:** A interface precisa ser totalmente responsiva (Mobile-First / Desktop-Optimized) e apresentar estética premium de alta interatividade.
