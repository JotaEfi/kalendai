import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, authorizeAdmin, AuthRequest } from '../middleware/authMiddleware.js';
import { sendInviteEmail, isSmtpConfigured } from '../services/mailService.js';

const router = Router();

// Apply auth & admin middlewares globally to all routes in this router
router.use(authenticateToken as any);
router.use(authorizeAdmin as any);

// POST /groups - Create a new user group
router.post('/groups', async (req: AuthRequest, res: any) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'O nome do grupo é obrigatório', code: 'MISSING_GROUP_NAME' });
    }

    const group = await prisma.userGroup.create({
      data: { name: name.trim() }
    });

    res.status(201).json(group);
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Erro interno ao criar grupo', code: 'SERVER_ERROR' });
  }
});

// GET /groups - List all groups with their members
router.get('/groups', async (req: AuthRequest, res: any) => {
  try {
    const groups = await prisma.userGroup.findMany({
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(groups);
  } catch (error) {
    console.error('Error listing groups:', error);
    res.status(500).json({ error: 'Erro interno ao buscar grupos', code: 'SERVER_ERROR' });
  }
});

// POST /users/invite - Invite or manually create a user inside a group
router.post('/users/invite', async (req: AuthRequest, res: any) => {
  try {
    const { email, name, password, groupId, role } = req.body;

    if (!email || !name || !groupId) {
      return res.status(400).json({ 
        error: 'E-mail, nome e grupo são obrigatórios para o cadastro/convite.', 
        code: 'MISSING_REQUIRED_FIELDS' 
      });
    }

    // Verify group exists
    const group = await prisma.userGroup.findUnique({ where: { id: groupId } });
    if (!group) {
      return res.status(404).json({ error: 'Grupo de destino não encontrado', code: 'GROUP_NOT_FOUND' });
    }

    // Verify email uniqueness
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado no sistema.', code: 'EMAIL_ALREADY_EXISTS' });
    }

    let finalPassword = password;
    let sentEmail = false;

    // Check if SMTP is configured
    const smtpActive = isSmtpConfigured();

    if (!finalPassword) {
      // Automatic invite mode
      if (!smtpActive) {
        return res.status(400).json({
          error: 'O serviço de e-mail (SMTP) não está configurado. Por favor, insira uma senha inicial para criar o usuário manualmente.',
          code: 'SMTP_INACTIVE_PASSWORD_REQUIRED'
        });
      }
      
      // Generate secure temporary password
      finalPassword = crypto.randomBytes(6).toString('hex') + 'A1!'; // e.g. "4b335da2A1!"
    }

    // Hash the final password
    const passwordHash = await bcrypt.hash(finalPassword, 10);

    // Create the user
    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: role === 'ADMIN' ? 'ADMIN' : 'USER',
        groupId
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        group: { select: { name: true } }
      }
    });

    // Send invitation email if SMTP is active
    if (smtpActive) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost';
      const inviteUrl = `${frontendUrl}/login`;
      
      sentEmail = await sendInviteEmail({
        email,
        inviteUrl,
        groupName: group.name
      });
    }

    res.status(201).json({
      success: true,
      user: newUser,
      sentEmail,
      smtpActive,
      // If manually created or SMTP failed, return the temporary password for admin to copy
      temporaryPassword: password ? null : finalPassword
    });

  } catch (error) {
    console.error('Error inviting/creating user:', error);
    res.status(500).json({ error: 'Erro interno ao convidar/criar usuário', code: 'SERVER_ERROR' });
  }
});

export default router;
