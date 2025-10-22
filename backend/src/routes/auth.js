import crypto from 'node:crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { sendPasswordResetEmail } from '../lib/mailer.js';

const router = express.Router();

function buildPasswordResetLink(req, token) {
  const baseUrl = process.env.APP_PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  return `${baseUrl.replace(/\/+$/, '')}/esqueci-senha.html?token=${token}`;
}

function getResetTokenTtlMinutes() {
  const raw = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES);
  return Number.isFinite(raw) && raw > 0 ? raw : 60;
}

router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body || {};
    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha sao obrigatorios.' });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Credenciais invalidas.' });
    }
    const ok = await bcrypt.compare(senha, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Credenciais invalidas.' });
    }
    const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, surname: user.surname } });
  } catch (err) {
    console.error('[auth] erro login', err);
    res.status(500).json({ error: 'Erro ao efetuar login.' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'Email e obrigatorio.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    const responseMessage = { message: 'Se o email estiver cadastrado, voce recebera instrucoes em instantes.' };

    if (!user) {
      return res.json(responseMessage);
    }

    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { lt: new Date() }
      }
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + getResetTokenTtlMinutes() * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        tokenHash,
        expiresAt,
        userId: user.id
      }
    });

    const resetLink = buildPasswordResetLink(req, rawToken);
    const displayName = [user.name, user.surname].filter(Boolean).join(' ') || null;

    try {
      await sendPasswordResetEmail({
        to: user.email,
        name: displayName,
        link: resetLink
      });
    } catch (mailError) {
      console.warn('[auth] falha ao enviar email de redefinicao', mailError);
    }

    res.json(responseMessage);
  } catch (err) {
    console.error('[auth] erro esqueci senha', err);
    res.status(500).json({ error: 'Erro ao iniciar redefinicao de senha.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, senha } = req.body || {};
    if (!token || !senha) {
      return res.status(400).json({ error: 'Token e nova senha sao obrigatorios.' });
    }

    if (String(senha).length < 8) {
      return res.status(400).json({ error: 'A nova senha deve conter pelo menos 8 caracteres.' });
    }

    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash }
    });

    if (!resetToken) {
      return res.status(400).json({ error: 'Token invalido ou expirado.' });
    }

    if (resetToken.usedAt) {
      return res.status(400).json({ error: 'Token ja utilizado.' });
    }

    if (resetToken.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Token invalido ou expirado.' });
    }

    const passwordHash = await bcrypt.hash(String(senha), 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash }
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() }
      }),
      prisma.passwordResetToken.deleteMany({
        where: {
          userId: resetToken.userId,
          id: { not: resetToken.id }
        }
      })
    ]);

    res.json({ message: 'Senha atualizada com sucesso.' });
  } catch (err) {
    console.error('[auth] erro redefinir senha', err);
    res.status(500).json({ error: 'Erro ao redefinir senha.' });
  }
});

export default router;
