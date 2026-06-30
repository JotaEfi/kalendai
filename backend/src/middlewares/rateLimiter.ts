import rateLimit from 'express-rate-limit';

// Limite global de 100 requisições por 15 minutos por IP
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 100,
  standardHeaders: 'draft-7', // Retorna info do rate limit nos headers RateLimit-*
  legacyHeaders: false, // Desativa X-RateLimit-* headers legacy
  message: {
    status: 'error',
    message: 'Muitas requisições originadas deste IP. Tente novamente em 15 minutos.',
  },
});

// Limite estrito de 5 requisições por 15 minutos por IP para endpoints de autenticação
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Muitas tentativas de login/cadastro. Acesso bloqueado por 15 minutos.',
  },
});
