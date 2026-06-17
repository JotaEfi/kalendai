import 'dotenv/config';
import app from './app.js';
import { setupCronJobs } from './jobs/cronJobs.js';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma.js';
import { initializeMinio } from './services/minioService.js';
import { migratePastActiveCards } from './services/kanbanService.js';


const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../frontend/dist')));
  app.get('*', (req, res) => res.sendFile(path.resolve(__dirname, '../../frontend/dist/index.html')));
}

const seedAdmin = async () => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Administrador';

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be configured before seeding the admin user.');
  }

  try {
    const existingAdmin = await prisma.user.findUnique({ where: { email } });
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.user.create({
        data: {
          email,
          passwordHash,
          name,
          role: 'ADMIN' // SQLite workaround
        }
      });
      console.log('✅ Admin user created successfully');
    }
  } catch (err: any) {
    if (err.name === 'PrismaClientInitializationError' || (err.code && err.code.startsWith('P'))) {
      console.log('Skipping seed due to DB error (probably sqlite dev mode issues)');
    } else {
      console.error('Failed to seed admin:', err);
    }
  }
};

seedAdmin().then(async () => {
  // Initialize MinIO Bucket
  await initializeMinio();

  // Executar migração de cards ativos perdidos no passado
  await migratePastActiveCards();

  app.listen(PORT, () => {
    console.log(`🚀 Backend server running on port ${PORT}`);
    
    // Initialize cron jobs
    setupCronJobs();
  });
});
