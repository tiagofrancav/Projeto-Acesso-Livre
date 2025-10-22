import process from 'node:process';

let cachedTransporter = null;

async function getTransporter() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  if (cachedTransporter) {
    return cachedTransporter;
  }

  const nodemailer = await import('nodemailer');
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      : undefined
  });

  return cachedTransporter;
}

export async function sendPasswordResetEmail({ to, name, link }) {
  const appName = process.env.APP_NAME || 'Livre Acesso';
  const subject = `${appName} - Redefinicao de senha`;
  const greetingName = name || to;
  const text = [
    `Ola ${greetingName},`,
    '',
    `Recebemos uma solicitacao para redefinir a senha da sua conta no ${appName}.`,
    'Para concluir o processo, acesse o link abaixo:',
    link,
    '',
    'Se voce nao solicitou a redefinicao, ignore este email.',
    '',
    'Equipe Livre Acesso'
  ].join('\n');

  const transporter = await getTransporter();
  if (!transporter) {
    console.info(`[mail] Redefinicao de senha para ${to}: ${link}`);
    return { queued: false, preview: link };
  }

  let hostname = 'localhost';
  try {
    hostname = new URL(link).hostname || hostname;
  } catch (_) {
    /* ignore invalid url */
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || `no-reply@${hostname}`;
  await transporter.sendMail({
    to,
    from,
    subject,
    text,
    html: text.replace(/\n/g, '<br>')
  });

  return { queued: true };
}
