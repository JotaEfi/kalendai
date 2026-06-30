import helmet from 'helmet';

export const configureHelmet = () => {
  const isProd = process.env.NODE_ENV === 'production';

  return helmet({
    // Configura CSP estrita recomendada para APIs
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:"], // Suporta uploads de imagens locais/temporárias
        styleSrc: ["'self'"],
        upgradeInsecureRequests: isProd ? [] : null, // Exige HTTPS em produção
      },
    },
    // Protege contra vazamento de informações de compartilhamento cruzado
    crossOriginResourcePolicy: { policy: "same-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    // Oculta informações que revelem Node/Express
    hidePoweredBy: true,
    // HSTS apenas em produção
    hsts: isProd ? {
      maxAge: 31536000, // 1 ano
      includeSubDomains: true,
      preload: true,
    } : false,
  });
};
