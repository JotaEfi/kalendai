# 📋 Plano de Execução - Fase 3: Painel Admin, Grupos e Colaboração

Este plano detalha as tarefas e arquivos a serem alterados para implementar o Painel Admin, o SMTP com Fallback de Convite, o controle de grupos e a caixa de entrada (Inbox) de atribuição compartilhada.

---

## 🏗️ Proposta de Mudanças por Componente

### 1. Banco de Dados e ORM (Prisma)

#### [MODIFY] [schema.prisma](file:///c:/Users/Admin/source/repos/kalendai/backend/prisma/schema.prisma)
*   Adicionar o modelo `UserGroup` e relacionar `User` a ele.
*   Adicionar o modelo `Notification` para registrar inbox de aceites/recusas e logs.
*   Executar migração `npx prisma migrate dev --name add_groups_and_notifications` no Postgres.

---

### 2. Backend - Serviço de E-mail (SMTP) e Convites

#### [NEW] [backend/src/services/mailService.ts](file:///c:/Users/Admin/source/repos/kalendai/backend/src/services/mailService.ts)
*   Implementar envio de e-mails usando `nodemailer` parametrizado com variáveis de ambiente.
*   **Template de E-mail Premium KalendAI:** Desenvolver um template de e-mail em HTML altamente estético combinando com a identidade visual do KalendAI:
    *   Uso de tipografia moderna e elegante (Inter/Outfit via Google Fonts).
    *   Paleta de cores premium (Azul institucional `#0079bf`, tons de cinza suave para fundo e contraste cinza escuro sofisticado).
    *   Card central flutuante com bordas suaves, cabeçalho contendo a marca KalendAI, uma mensagem acolhedora de convite e um botão de ação (CTA) vibrante e arredondado para acessar o sistema.
*   Retornar status indicando se o e-mail foi enviado ou se deve rodar fallback manual.

---

### 3. Backend - Novas Rotas e Proteções

#### [NEW] [backend/src/routes/adminRoutes.ts](file:///c:/Users/Admin/source/repos/kalendai/backend/src/routes/adminRoutes.ts)
*   Rotas exclusivas protegidas por `authorizeAdmin` para:
    *   `POST /groups` - Criar um novo grupo.
    *   `POST /users/invite` - Convidar ou criar manualmente um usuário.
    *   `GET /groups` - Listar grupos cadastrados.

#### [NEW] [backend/src/routes/notificationRoutes.ts](file:///c:/Users/Admin/source/repos/kalendai/backend/src/routes/notificationRoutes.ts)
*   Rotas para gerenciar a Inbox do usuário:
    *   `GET /` - Listar notificações ativas/pendentes do usuário.
    *   `PUT /:id/accept` - Aceitar atribuição de card.
    *   `PUT /:id/refuse` - Recusar atribuição de card (devolve ao dono e notifica).

#### [MODIFY] [backend/src/routes/kanbanRoutes.ts](file:///c:/Users/Admin/source/repos/kalendai/backend/src/routes/kanbanRoutes.ts)
*   Adicionar a rota `POST /:id/assign` para enviar/propor atribuição de card para outro membro do grupo.

---

### 4. Frontend - Painel Administrativo e Inbox

#### [NEW] [frontend/src/pages/AdminPanel.tsx](file:///c:/Users/Admin/source/repos/kalendai/frontend/src/pages/AdminPanel.tsx)
*   Visualização exclusiva de Admin para criar grupos e adicionar/convidar usuários.

#### [NEW] [frontend/src/components/Inbox.tsx](file:///c:/Users/Admin/source/repos/kalendai/frontend/src/components/Inbox.tsx)
*   Caixa de entrada exibindo convites pendentes e notificações de recusa, com ações rápidas para aceitar/recusar tarefas.

#### [MODIFY] [frontend/src/components/Layout.tsx](file:///c:/Users/Admin/source/repos/kalendai/frontend/src/components/Layout.tsx)
*   Integrar link para o Painel Administrativo no menu lateral (exibido apenas se `user.role === 'ADMIN'`).
*   Integrar o atalho para a **Inbox** com badge vermelho indicando notificações pendentes.

---

## 🔬 Plano de Verificação

### Testes Manuais
1.  **Criação de Grupos:** Logar com `admin@kalend.ai`, entrar em `/admin`, criar grupo "Time Alfa".
2.  **Criação Manual de Usuários:** Adicionar "João" no grupo "Time Alfa" via formulário manual (sem SMTP).
3.  **Compartilhamento de Tarefa:** Logar como Admin, criar um cartão, clicar em "Atribuir" e selecionar "João" (ambos no mesmo grupo).
4.  **Aceite/Recusa no Inbox:** Logar como "João", abrir a Inbox, ver a notificação de tarefa pendente:
    *   Clicar em "Recusar": O card some da Inbox do João, volta para o Admin, e o Admin recebe aviso de recusa.
    *   Clicar em "Aceitar": O card é inserido diretamente na agenda do João.
