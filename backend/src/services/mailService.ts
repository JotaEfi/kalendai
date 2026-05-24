import nodemailer from 'nodemailer';

// Helper to check if SMTP settings are fully configured
export const isSmtpConfigured = (): boolean => {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
};

// Create transport configuration lazily so it doesn't crash on boot if environment variables are missing
const getTransporter = () => {
  if (!isSmtpConfigured()) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '585'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

interface SendInviteParams {
  email: string;
  inviteUrl: string;
  groupName: string;
}

export const sendInviteEmail = async ({
  email,
  inviteUrl,
  groupName,
}: SendInviteParams): Promise<boolean> => {
  const transporter = getTransporter();
  
  if (!transporter) {
    console.warn('⚠️ SMTP not configured. Skipping email dispatch.');
    return false;
  }

  const fromAddress = process.env.SMTP_FROM || 'KalendAI <noreply@kalend.ai>';

  const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Convite para o KalendAI</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #F4F5F7;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #172B4D;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #F4F5F7;
      padding: 40px 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      border: 1px solid #DFE1E6;
      box-shadow: 0 4px 12px rgba(9, 30, 66, 0.05);
      overflow: hidden;
    }
    .header {
      padding: 32px;
      text-align: center;
      background-color: #ffffff;
      border-bottom: 1px solid #DFE1E6;
    }
    .logo {
      font-size: 24px;
      font-weight: 800;
      color: #172B4D;
      text-decoration: none;
      letter-spacing: -0.5px;
    }
    .logo-blue {
      color: #0079bf;
    }
    .content {
      padding: 40px 32px;
      text-align: center;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #172B4D;
      margin-top: 0;
      margin-bottom: 16px;
    }
    p {
      font-size: 15px;
      line-height: 24px;
      color: #5E6C84;
      margin-top: 0;
      margin-bottom: 24px;
    }
    .cta-container {
      margin: 32px 0;
    }
    .cta-button {
      background-color: #0079bf;
      color: #ffffff !important;
      padding: 14px 32px;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      border-radius: 8px;
      display: inline-block;
      box-shadow: 0 2px 4px rgba(0, 121, 191, 0.2);
    }
    .group-badge {
      background-color: #E6FCFF;
      color: #0079bf;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      display: inline-block;
      margin-bottom: 16px;
    }
    .footer {
      padding: 24px 32px;
      background-color: #FAFBFC;
      border-top: 1px solid #DFE1E6;
      text-align: center;
      font-size: 12px;
      color: #7A869A;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <span class="logo">Kalend<span class="logo-blue">AI</span></span>
      </div>
      <div class="content">
        <span class="group-badge">${groupName}</span>
        <h1>Você foi convidado!</h1>
        <p>Olá! Você foi convidado para fazer parte da rede interna do <strong>KalendAI</strong> na equipe <strong>${groupName}</strong>.</p>
        <p>Acesse o link abaixo para configurar o seu perfil de usuário e começar a gerenciar suas tarefas de forma inteligente e colaborativa.</p>
        <div class="cta-container">
          <a href="${inviteUrl}" class="cta-button" target="_blank">Configurar meu Perfil</a>
        </div>
        <p style="font-size: 12px; color: #7A869A; margin-bottom: 0;">Se o botão acima não funcionar, copie e cole o seguinte link no seu navegador:<br><a href="${inviteUrl}" style="color: #0079bf; text-decoration: none;">${inviteUrl}</a></p>
      </div>
      <div class="footer">
        Este é um e-mail automático enviado pelo sistema KalendAI.<br>
        &copy; 2026 KalendAI. Todos os direitos reservados.
      </div>
    </div>
  </div>
</body>
</html>
  `;

  try {
    await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject: `Convite para integrar o time ${groupName} no KalendAI`,
      html: htmlContent,
    });
    console.log(`✉️ Automated invite email sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to dispatch automated invite email via SMTP:', error);
    return false;
  }
};
