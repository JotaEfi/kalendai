import cors, { CorsOptions } from 'cors';

export const configureCors = () => {
  const isDev = process.env.NODE_ENV === 'development';
  
  // Lê origens do env
  const allowedOrigins: string[] = [];
  if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL.trim());
  }
  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',')
      .map(origin => origin.trim())
      .filter(Boolean)
      .forEach(origin => {
        if (!allowedOrigins.includes(origin)) {
          allowedOrigins.push(origin);
        }
      });
  }

  // Fallback caso não tenha nada configurado
  if (allowedOrigins.length === 0) {
    allowedOrigins.push('http://localhost:5173');
  }

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      // Em dev, libera localhost/127.0.0.1 em qualquer porta
      if (isDev && origin) {
        const url = new URL(origin);
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
          callback(null, true);
          return;
        }
      }

      // Valida se a origem está na lista permitida ou se é requisição sem origin (ex: Mobile/Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Acesso bloqueado por políticas de CORS.'));
      }
    },
    credentials: true,
  };

  return cors(corsOptions);
};
