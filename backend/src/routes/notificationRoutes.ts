import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware.js';

const router = Router();

// GET /group-members - List all members of the logged in user's group
router.get('/group-members', async (req: AuthRequest, res: any) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Não autorizado' });

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { groupId: true }
    });

    if (!currentUser || !currentUser.groupId) {
      return res.json([]); // Not in a group yet
    }

    const members = await prisma.user.findMany({
      where: { 
        groupId: currentUser.groupId,
        id: { not: userId } // Exclude current user
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    });

    res.json(members);
  } catch (error) {
    console.error('Error fetching group members:', error);
    res.status(500).json({ error: 'Erro ao buscar membros do grupo', code: 'SERVER_ERROR' });
  }
});

// GET / - List all notifications for the authenticated user
router.get('/', async (req: AuthRequest, res: any) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Não autorizado' });

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Erro ao buscar notificações', code: 'SERVER_ERROR' });
  }
});

// PUT /:id/read - Mark notification as read
router.put('/:id/read', async (req: AuthRequest, res: any) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ error: 'Não autorizado' });

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) {
      return res.status(404).json({ error: 'Notificação não encontrada', code: 'NOT_FOUND' });
    }

    if (notification.userId !== userId) {
      return res.status(403).json({ error: 'Acesso negado', code: 'FORBIDDEN' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Erro ao processar requisição', code: 'SERVER_ERROR' });
  }
});

// PUT /:id/accept - Accept task assignment
router.put('/:id/accept', async (req: AuthRequest, res: any) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ error: 'Não autorizado' });

    // Find notification
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) {
      return res.status(404).json({ error: 'Notificação não encontrada', code: 'NOT_FOUND' });
    }

    if (notification.userId !== userId) {
      return res.status(403).json({ error: 'Acesso negado', code: 'FORBIDDEN' });
    }

    if (notification.status !== 'PENDING' || notification.type !== 'CARD_ASSIGNMENT') {
      return res.status(400).json({ error: 'Esta notificação não está pendente ou não é de atribuição', code: 'INVALID_STATUS' });
    }

    const cardId = notification.cardId;
    if (!cardId) {
      return res.status(400).json({ error: 'Identificador do card ausente na notificação', code: 'MISSING_CARD_ID' });
    }

    // Verify card exists
    const card = await prisma.kanbanCard.findUnique({ where: { id: cardId } });
    if (!card) {
      return res.status(404).json({ error: 'O cartão associado a esta tarefa não existe mais', code: 'CARD_NOT_FOUND' });
    }

    // Execute in a transaction: transfer ownership and accept invitation
    const [updatedCard, updatedNotification] = await prisma.$transaction([
      prisma.kanbanCard.update({
        where: { id: cardId },
        data: { userId } // Transfer ownership to the recipient!
      }),
      prisma.notification.update({
        where: { id },
        data: { status: 'ACCEPTED', read: true }
      })
    ]);

    res.json({ success: true, card: updatedCard, notification: updatedNotification });
  } catch (error) {
    console.error('Error accepting card assignment:', error);
    res.status(500).json({ error: 'Erro ao aceitar a atribuição de tarefa', code: 'SERVER_ERROR' });
  }
});

// PUT /:id/refuse - Refuse task assignment
router.put('/:id/refuse', async (req: AuthRequest, res: any) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ error: 'Não autorizado' });

    // Find notification
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) {
      return res.status(404).json({ error: 'Notificação não encontrada', code: 'NOT_FOUND' });
    }

    if (notification.userId !== userId) {
      return res.status(403).json({ error: 'Acesso negado', code: 'FORBIDDEN' });
    }

    if (notification.status !== 'PENDING' || notification.type !== 'CARD_ASSIGNMENT') {
      return res.status(400).json({ error: 'Esta notificação não está pendente ou não é de atribuição', code: 'INVALID_STATUS' });
    }

    const cardId = notification.cardId;
    const senderId = notification.senderId;

    if (!cardId || !senderId) {
      return res.status(400).json({ error: 'Dados do card ou do remetente ausentes na notificação', code: 'MISSING_DATA' });
    }

    // Get card title and recipient name
    const [card, recipient] = await Promise.all([
      prisma.kanbanCard.findUnique({ where: { id: cardId }, select: { title: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
    ]);

    const cardTitle = card?.title || 'Tarefa sem título';
    const recipientName = recipient?.name || 'Um usuário';

    // Execute in transaction: mark as REJECTED and notify original sender
    const [updatedNotification] = await prisma.$transaction([
      prisma.notification.update({
        where: { id },
        data: { status: 'REJECTED', read: true }
      }),
      prisma.notification.create({
        data: {
          userId: senderId, // Notify the sender!
          type: 'INFO',
          title: 'Atribuição Recusada',
          message: `O usuário "${recipientName}" recusou a tarefa: "${cardTitle}".`,
          senderId: userId,
          status: 'ACCEPTED', // Simple alert notification
          read: false
        }
      })
    ]);

    res.json({ success: true, notification: updatedNotification });
  } catch (error) {
    console.error('Error refusing card assignment:', error);
    res.status(500).json({ error: 'Erro ao recusar a atribuição de tarefa', code: 'SERVER_ERROR' });
  }
});

export default router;
