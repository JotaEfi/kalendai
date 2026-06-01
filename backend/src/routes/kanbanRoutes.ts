import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AuthRequest } from '../middleware/authMiddleware.js';
import { generateDailyReport } from '../services/aiProvider.js';
import { uploadFile, getPresignedUrl, deleteFile } from '../services/minioService.js';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';

const storage = multer.memoryStorage();
const maxAttachmentSizeMb = parseInt(process.env.MAX_ATTACHMENT_SIZE_MB || '3', 10);
const allowedAttachmentMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const upload = multer({
  storage,
  limits: { fileSize: maxAttachmentSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!allowedAttachmentMimeTypes.has(file.mimetype)) {
      return callback(new Error('Tipo de arquivo nao permitido. Envie imagens JPG, PNG, WebP ou GIF.'));
    }
    callback(null, true);
  }
});

const router = Router();

router.get('/reports', async (req: AuthRequest, res: any) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const reports = await prisma.dailyReport.findMany({
      where: { userId },
      orderBy: { date: 'desc' }
    });

    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Erro ao buscar relatórios.' });
  }
});

router.get('/report', async (req: AuthRequest, res: any) => {
  try {
    const userId = req.user?.userId;
    const dateStr = req.query.date as string;
    
    if (!userId || !dateStr) return res.status(400).json({ error: 'Missing userId or date' });

    const dayDate = new Date(dateStr);
    
    const report = await prisma.dailyReport.findFirst({
      where: {
        userId,
        date: dayDate
      },
      orderBy: { version: 'desc' }
    });

    if (report) {
      return res.json({ result: report.content });
    } else {
      return res.json({ result: null });
    }
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ error: 'Erro ao buscar relatório' });
  }
});

// POST endpoint to generate daily report via the configured AI provider
router.post('/report', async (req: AuthRequest, res: any) => {
  try {
    const userId = req.user?.userId;
    const { dateStr } = req.body; // e.g., '2026-05-19'
    
    if (!userId || !dateStr) {
      return res.status(400).json({ error: 'Missing userId or dateStr' });
    }

    const aiProvider = process.env.AI_PROVIDER || 'deepseek';
    const aiApiKey = process.env.AI_API_KEY;
    
    if (!aiApiKey) {
      return res.status(500).json({ error: 'AI_API_KEY not configured' });
    }

    const dayDate = new Date(dateStr);

    // Fetch tasks for the specified day
    const dayCards = await prisma.kanbanCard.findMany({
      where: {
        userId,
        dayDate,
        isPendingAssignment: false
      },
      include: {
        images: true
      }
    });

    if (dayCards.length === 0) {
      const emptyText = "Nenhuma tarefa registrada para este dia. Aproveite o dia livre!\n\nRelatório de Atividades:";
      
      const savedReport = await prisma.dailyReport.upsert({
        where: { userId_date_version: { userId, date: dayDate, version: 1 } },
        update: { content: emptyText, isAutomatic: false },
        create: { userId, date: dayDate, content: emptyText, isAutomatic: false, version: 1, reportType: 'AI_MANUAL' }
      });

      return res.json({ result: savedReport.content });
    }

    const tarefas_concluidas = dayCards.filter((c: any) => c.status === 'DONE').map((c: any) => {
      let duracao_minutos = 0;
      if (c.completedAt) {
        const start = c.originalDayDate ? new Date(c.originalDayDate) : new Date(c.createdAt);
        duracao_minutos = Math.max(0, Math.floor((new Date(c.completedAt).getTime() - start.getTime()) / 60000));
      }
      return {
        titulo: c.title,
        descricao: c.description || undefined,
        duracao_minutos,
        tem_imagem: c.images && c.images.length > 0,
        url_imagem: c.images?.[0] ? `https://storage.example.com/${c.images[0].bucket}/${c.images[0].objectKey}` : undefined // placeholder URL for AI context if needed
      }
    });

    const tarefas_em_aberto = dayCards.filter((c: any) => c.status === 'OPEN').map((c: any) => c.title);
    const tarefas_em_progresso = dayCards.filter((c: any) => c.status === 'IN_PROGRESS').map((c: any) => c.title);

    const payload = JSON.stringify({
      data: dateStr,
      tarefas_concluidas,
      tarefas_em_aberto,
      tarefas_em_progresso
    }, null, 2);

    const [yyyy, mm, dd] = dateStr.split('-');
    const formattedDate = `${dd}/${mm}/${yyyy}`;

    const systemPrompt = `Você é um assistente que gera relatórios diários de atividades.
Baseado no seguinte JSON de tarefas, escreva um texto descritivo em português brasileiro.
O relatório deve conter:
- Resumo geral do dia: quantas tarefas foram criadas, quantas foram concluídas, quantas permanecem em andamento.
- Detalhamento de cada tarefa concluída no dia (Título, breve descrição se houver, tempo que levou para ser concluída formatado de forma legível como "X horas e Y minutos", e se havia imagens).
- Listagem das tarefas que ficaram em aberto (sem análise, apenas o título).
NÃO inclua sugestões de melhoria ou críticas ao usuário. Entregue direto o corpo do texto sem cabeçalhos em markdown (use um formato de parágrafos legível).

JSON:
${payload}`;

    let generatedText = '';
    try {
       generatedText = await generateDailyReport(systemPrompt, {
         apiKey: aiApiKey,
         provider: aiProvider,
         model: process.env.AI_MODEL || 'deepseek-chat',
         baseUrl: process.env.AI_BASE_URL
       });
    } catch(aiError: any) {
       console.error("AI Generation error:", aiError);
       return res.status(500).json({ error: 'Erro ao comunicar com o modelo de IA.', details: aiError.message });
    }

    const finalReport = `Relatório de Atividades ${formattedDate}:\n\n${generatedText}`;

    // Upsert the daily report in database (V1 slot for legacy kanban route)
    const savedReport = await prisma.dailyReport.upsert({
      where: {
        userId_date_version: {
          userId,
          date: dayDate,
          version: 1
        }
      },
      update: {
        content: finalReport,
        isAutomatic: false
      },
      create: {
        userId,
        date: dayDate,
        content: finalReport,
        isAutomatic: false,
        version: 1,
        reportType: 'AI_MANUAL'
      }
    });

    res.json({ result: savedReport.content });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Error generating report' });
  }
});

// GET all active (open / in-progress) cards for a user
router.get('/pending', async (req: AuthRequest, res: any) => {
  try {
    const userId = req.user?.userId || 'placeholder-user-id';
    
    const cards = await prisma.kanbanCard.findMany({
      where: {
        userId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        isSnapshot: false,
        isPendingAssignment: false
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }]
    });

    res.json(cards);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar cards pendentes' });
  }
});

router.get('/month/:year/:month', async (req: AuthRequest, res: any) => {
  try {
    const { year, month } = req.params;
    const userId = req.user?.userId || 'placeholder-user-id'; 
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0);

    const cards = await prisma.kanbanCard.findMany({
      where: {
        userId,
        dayDate: {
          gte: startDate,
          lte: endDate,
        },
        isPendingAssignment: false
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }]
    });

    res.json(cards);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar cards do mês' });
  }
});

router.get('/:date', async (req: AuthRequest, res: any) => {
  try {
    const { date } = req.params;
    const userId = req.user?.userId || 'placeholder-user-id'; 
    const dayDate = new Date(date);
    
    if (isNaN(dayDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format', code: 'INVALID_DATE' });
    }

    const cards = await prisma.kanbanCard.findMany({
      where: {
        userId,
        dayDate,
        isPendingAssignment: false
      },
      include: {
        images: true
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }]
    });
    
    const cardsWithUrls = await Promise.all(cards.map(async (card) => {
      if (card.images && card.images.length > 0) {
        const imagesWithUrls = await Promise.all(card.images.map(async (img) => {
          const url = await getPresignedUrl(img.objectKey);
          return { ...img, url };
        }));
        return { ...card, images: imagesWithUrls };
      }
      return card;
    }));
    
    res.json(cardsWithUrls);
  } catch (error: any) {
    console.error(error);
    if (error.name === 'PrismaClientInitializationError' || (error.code && error.code.startsWith('P'))) {
      const g = global as any;
      g.mockCards = g.mockCards || [];
      const dayDate = new Date(req.params.date);
      const filtered = g.mockCards.filter((c:any) => new Date(c.dayDate).getTime() === dayDate.getTime());
      return res.json(filtered);
    }
    res.status(500).json({ error: 'Error fetching kanban cards', code: 'SERVER_ERROR' });
  }
});

// POST to create a new kanban card
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { title, description, color, dayDate } = req.body;
    const userId = req.user?.userId || 'placeholder-user-id';
    
    const card = await prisma.kanbanCard.create({
      data: {
        title,
        description: description || '',
        color: color || '#0079bf',
        status: 'OPEN',
        dayDate: new Date(dayDate),
        originalDayDate: new Date(dayDate),
        userId
      }
    });

    res.json(card);
  } catch (error: any) {
    console.error(error);
    if (error.name === 'PrismaClientInitializationError' || (error.code && error.code.startsWith('P'))) {
      const g = global as any;
      g.mockCards = g.mockCards || [];
      const newCard = {
        id: Math.random().toString(36).substr(2, 9),
        title: req.body.title,
        description: req.body.description || '',
        color: req.body.color || '#0079bf',
        status: 'OPEN',
        dayDate: new Date(req.body.dayDate),
        originalDayDate: new Date(req.body.dayDate),
        userId: req.user?.userId || 'placeholder-user-id'
      };
      g.mockCards.push(newCard);
      return res.json(newCard);
    }
    res.status(500).json({ error: 'Error creating kanban card', code: 'SERVER_ERROR' });
  }
});

// PUT to edit an existing kanban card
router.put('/:id', async (req: AuthRequest, res: any) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Não autorizado', code: 'UNAUTHORIZED' });

    // Validate ownership (IDOR Protection)
    const existingCard = await prisma.kanbanCard.findUnique({ where: { id } });
    if (!existingCard) return res.status(404).json({ error: 'Card não encontrado', code: 'NOT_FOUND' });
    if (existingCard.userId !== userId) return res.status(403).json({ error: 'Acesso negado', code: 'FORBIDDEN' });

    const { title, description, color, status, order } = req.body;
    
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (color !== undefined) updateData.color = color;
    if (order !== undefined) updateData.order = order;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'DONE') {
        updateData.completedAt = new Date();
      } else {
        updateData.completedAt = null;
      }
    }

    const card = await prisma.kanbanCard.update({
      where: { id },
      data: updateData
    });

    res.json(card);
  } catch (error: any) {
    console.error(error);
    if (error.name === 'PrismaClientInitializationError' || (error.code && error.code.startsWith('P'))) {
      const g = global as any;
      g.mockCards = g.mockCards || [];
      const { id } = req.params;
      const idx = g.mockCards.findIndex((c:any) => c.id === id);
      if (idx !== -1) {
        g.mockCards[idx] = { ...g.mockCards[idx], ...req.body };
        return res.json(g.mockCards[idx]);
      }
      return res.status(404).json({ error: 'Card not found in mock state' });
    }
    res.status(500).json({ error: 'Error updating kanban card', code: 'SERVER_ERROR' });
  }
});

// DELETE a kanban card
router.delete('/:id', async (req: AuthRequest, res: any) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Não autorizado', code: 'UNAUTHORIZED' });

    // Validate ownership (IDOR Protection)
    const existingCard = await prisma.kanbanCard.findUnique({
      where: { id },
      include: { images: true }
    });
    if (!existingCard) return res.status(404).json({ error: 'Card não encontrado', code: 'NOT_FOUND' });
    if (existingCard.userId !== userId) return res.status(403).json({ error: 'Acesso negado', code: 'FORBIDDEN' });

    // Clean up associated images in MinIO first (LGPD Compliance & Storage Leakage prevention)
    if (existingCard.images && existingCard.images.length > 0) {
      for (const img of existingCard.images) {
        try {
          await deleteFile(img.objectKey);
        } catch (minioError) {
          console.error('Error deleting image from MinIO on card deletion:', minioError);
        }
      }
    }

    await prisma.kanbanCard.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error deleting kanban card', code: 'SERVER_ERROR' });
  }
});

router.put('/reorder/bulk', async (req: AuthRequest, res: any) => {
  try {
    const { updates } = req.body; // { id: string, order: number, status?: string }[]
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Expected array of updates' });
    }
    
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Não autorizado', code: 'UNAUTHORIZED' });

    // Bulk validate ownership using a single optimized count query to prevent N+1 query loops!
    const cardIds = updates.map((u: any) => u.id);
    const count = await prisma.kanbanCard.count({
      where: {
        id: { in: cardIds },
        userId
      }
    });

    if (count !== cardIds.length) {
      return res.status(403).json({ error: 'Acesso negado: Você não é dono de um ou mais cards deste lote.', code: 'FORBIDDEN' });
    }
    
    // update one by one for sqlite limit, or use transaction
    await prisma.$transaction(
      updates.map(u => 
        prisma.kanbanCard.update({
          where: { id: u.id },
          data: { 
            order: u.order, 
            ...(u.status ? { 
              status: u.status, 
              completedAt: u.status === 'DONE' ? new Date() : null 
            } : {}) 
          }
        })
      )
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao reordenar cards' });
  }
});

// POST to upload an image or document to a card
router.post('/:id/images', upload.single('image'), async (req: AuthRequest, res: any) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Não autorizado', code: 'UNAUTHORIZED' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado', code: 'MISSING_FILE' });
    }

    // Dynamic size validation from environment variable (VPS upgradeable)
    const maxMb = parseInt(process.env.MAX_ATTACHMENT_SIZE_MB || '3');
    if (req.file.size > maxMb * 1024 * 1024) {
      return res.status(400).json({ error: `O tamanho do arquivo excede o limite permitido de ${maxMb}MB.`, code: 'FILE_TOO_LARGE' });
    }

    // Verify card ownership
    const card = await prisma.kanbanCard.findFirst({
      where: { id, userId }
    });

    if (!card) {
      return res.status(404).json({ error: 'Card não encontrado', code: 'NOT_FOUND' });
    }

    // Dynamic count validation from environment variable (VPS upgradeable)
    const currentCount = await prisma.cardImage.count({ where: { cardId: id } });
    const maxAttachments = parseInt(process.env.MAX_ATTACHMENTS_PER_CARD || '3');
    if (currentCount >= maxAttachments) {
      return res.status(400).json({ error: `Limite máximo de ${maxAttachments} anexos por cartão atingido.`, code: 'LIMIT_EXCEEDED' });
    }

    // Generate unique name (UUID + original extension)
    const ext = path.extname(req.file.originalname) || '';
    const uuid = crypto.randomUUID();
    const objectKey = `${uuid}${ext}`;
    const bucketName = process.env.MINIO_BUCKET_NAME || 'kalend-ai-images';

    // Upload to MinIO
    await uploadFile(req.file.buffer, objectKey, req.file.mimetype);

    // Save database reference
    const cardImage = await prisma.cardImage.create({
      data: {
        cardId: id,
        objectKey,
        bucket: bucketName,
        mimeType: req.file.mimetype
      }
    });

    // Generate presigned URL
    const url = await getPresignedUrl(objectKey);

    res.json({ ...cardImage, url });
  } catch (error: any) {
    console.error('Error uploading card attachment:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

// DELETE to remove an image from a card
router.delete('/:id/images/:imageId', async (req: AuthRequest, res: any) => {
  try {
    const { id, imageId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Não autorizado', code: 'UNAUTHORIZED' });
    }

    // Verify card ownership
    const card = await prisma.kanbanCard.findFirst({
      where: { id, userId }
    });

    if (!card) {
      return res.status(404).json({ error: 'Card não encontrado ou não pertence a este usuário', code: 'NOT_FOUND' });
    }

    const image = await prisma.cardImage.findFirst({
      where: { id: imageId, cardId: id }
    });

    if (!image) {
      return res.status(404).json({ error: 'Imagem não encontrada no card', code: 'IMAGE_NOT_FOUND' });
    }

    // Delete from MinIO
    try {
      await deleteFile(image.objectKey);
    } catch (minioError) {
      console.error('Error deleting from MinIO:', minioError);
    }

    // Delete database reference
    await prisma.cardImage.delete({
      where: { id: imageId }
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting card image:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

// POST to propose task assignment to another user in the same group
router.post('/:id/assign', async (req: AuthRequest, res: any) => {
  try {
    const { id } = req.params;
    const { receiverId } = req.body;
    const senderId = req.user?.userId;

    if (!senderId) {
      return res.status(401).json({ error: 'Não autorizado', code: 'UNAUTHORIZED' });
    }

    if (!receiverId) {
      return res.status(400).json({ error: 'Identificador do destinatário é obrigatório', code: 'MISSING_RECEIVER_ID' });
    }

    // 1. Fetch card & verify ownership (IDOR Defense)
    const card = await prisma.kanbanCard.findUnique({
      where: { id }
    });

    if (!card) {
      return res.status(404).json({ error: 'Card não encontrado', code: 'NOT_FOUND' });
    }

    if (card.userId !== senderId) {
      return res.status(403).json({ error: 'Acesso negado: Você só pode atribuir seus próprios cartões', code: 'FORBIDDEN' });
    }

    // 2. Fetch sender & receiver to verify group membership (Internal Network Check)
    const [senderUser, receiverUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: senderId }, select: { groupId: true, name: true } }),
      prisma.user.findUnique({ where: { id: receiverId }, select: { groupId: true } })
    ]);

    if (!senderUser || !receiverUser) {
      return res.status(404).json({ error: 'Remetente ou destinatário não encontrado', code: 'USER_NOT_FOUND' });
    }

    if (!senderUser.groupId || senderUser.groupId !== receiverUser.groupId) {
      return res.status(403).json({ 
        error: 'Acesso negado: Você só pode atribuir tarefas a membros da sua rede interna (mesmo grupo).', 
        code: 'GROUP_MISMATCH' 
      });
    }

    // 3. Check if there is already a pending assignment request for this card
    const existingPending = await prisma.notification.findFirst({
      where: {
        cardId: id,
        userId: receiverId,
        status: 'PENDING',
        type: 'CARD_ASSIGNMENT'
      }
    });

    if (existingPending) {
      return res.status(400).json({ error: 'Já existe uma atribuição pendente para este usuário neste cartão.', code: 'ALREADY_PENDING' });
    }

    // 4. Create the assignment notification in the recipient's Inbox AND set card as pending assignment (flying card state)
    const [notification] = await prisma.$transaction([
      prisma.notification.create({
        data: {
          userId: receiverId,
          type: 'CARD_ASSIGNMENT',
          title: 'Nova Tarefa Atribuída',
          message: `O usuário "${senderUser.name}" gostaria de te atribuir a tarefa: "${card.title}".`,
          cardId: id,
          senderId,
          status: 'PENDING',
          read: false
        }
      }),
      prisma.kanbanCard.update({
        where: { id },
        data: { isPendingAssignment: true }
      })
    ]);

    res.json({ success: true, notification });
  } catch (error: any) {
    console.error('Error proposing card assignment:', error);
    res.status(500).json({ error: 'Erro interno ao propor a atribuição da tarefa', details: error.message });
  }
});

export default router;
