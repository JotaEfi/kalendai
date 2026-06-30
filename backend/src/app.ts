import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { configureHelmet } from './middlewares/security.js';
import { configureCors } from './middlewares/cors.js';
import { globalLimiter } from './middlewares/rateLimiter.js';
import authRoutes from './routes/authRoutes.js';
import kanbanRoutes from './routes/kanbanRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { authenticateToken } from './middleware/authMiddleware.js';

const app = express();

// Configura proxy confiável para ler IP real atrás do Nginx
app.set('trust proxy', process.env.TRUST_PROXY === 'true' || 1);

app.use(configureHelmet());
app.use(configureCors());
app.use(globalLimiter);
app.use(express.json());

// Static Files Fallback for Uploads (MinIO local fallback)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/kanban', authenticateToken, kanbanRoutes);
app.use('/api/events', authenticateToken, eventRoutes);
app.use('/api/reports', authenticateToken, reportRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', authenticateToken, notificationRoutes);

// Basic Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' });
});

export default app;
