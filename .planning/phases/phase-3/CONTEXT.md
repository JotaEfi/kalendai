# 🏁 Contexto de Decisão - Fase 3: Painel Admin, Grupos e Colaboração

Este documento registra as especificações e decisões arquiteturais tomadas com o usuário para a execução da **Fase 3: Painel Admin, Grupos e Colaboração** do KalendAI. 

---

## 🔒 Decisões Arquiteturais Definidas (Locked Choices)

### 1. Modelo de Grupos de Usuários (`UserGroup`)
*   **Decisão:** Criação do relacionamento de pertencimento um-para-muitos (Um Grupo possui N Usuários).
*   **Tabela Prisma:** 
    *   `UserGroup` com campos `id`, `name`, `createdAt`.
    *   O model `User` ganha um campo `groupId String?` e relacionamento com `UserGroup`.
*   **Rede Interna Fechada:** Usuários pertencentes a um grupo só conseguem visualizar, comunicar e interagir com membros do mesmo grupo.

### 2. Painel Administrativo e Sistema de Convites
*   **Acesso Restrito:** Apenas usuários com `role === 'ADMIN'` podem acessar a visualização de painel administrativo `/admin`.
*   **Convite via SMTP (E-mail):**
    *   Desenvolvimento de serviço de e-mail no backend com parametrização SMTP segura (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`).
    *   O admin digita o e-mail do convidado, que recebe um link para cadastrar seu perfil.
*   **Criação Manual (Fallback):**
    *   Caso os campos de SMTP não estejam configurados no `.env`, o admin pode preencher manualmente na tela os campos **Nome, E-mail e Senha** do novo usuário para integrá-lo de imediato ao sistema.

### 3. Compartilhamento e Atribuição de Cards no Grupo
*   **Lógica de Atribuição:** Um usuário pode enviar/atribuir um cartão Kanban ativo para outro membro do seu grupo.
*   **Caixa de Entrada (Inbox) e Fluxo de Consentimento:**
    *   Ao enviar o card, cria-se uma notificação de atribuição do tipo `CARD_ASSIGNMENT` para o destinatário.
    *   O destinatário recebe a notificação na sua **Inbox** com duas ações claras:
        *   **Aceitar:** A posse (`userId`) do card é transferida para o destinatário e o card é inserido em seu Kanban. A notificação é marcada como concluída.
        *   **Recusar:** O card permanece com o remetente original. A notificação é encerrada e cria-se uma notificação de recusa para o remetente original, alertando sobre a recusa.
*   **Modelo de Notificação:**
    *   `Notification` com campos: `id`, `userId` (destinatário), `type` (`CARD_ASSIGNMENT`, `INFO`), `title`, `message`, `status` (`PENDING`, `ACCEPTED`, `REJECTED`), `cardId String?`, `senderId String?`, `createdAt`, `read Boolean @default(false)`.

---

## 🛠️ Próximos Passos
1. Consolidar o checklist detalhado no `PLAN.md`.
2. Obter sinal verde do usuário para iniciar a execução da Fase 3 de Colaboração.
