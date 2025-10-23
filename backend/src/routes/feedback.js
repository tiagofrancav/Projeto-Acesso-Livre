import express from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

router.get('/me', async (req, res) => {
  try {
    const existing = await prisma.questionnaireResponse.findFirst({
      where: { userId: req.user.id },
      select: { id: true, createdAt: true }
    });
    if (!existing) {
      return res.json({ submitted: false });
    }
    return res.json({ submitted: true, submittedAt: existing.createdAt });
  } catch (err) {
    console.error('[feedback] erro ao consultar status', err);
    res.status(500).json({ error: 'Erro ao consultar feedback.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const existing = await prisma.questionnaireResponse.findFirst({
      where: { userId: req.user.id }
    });
    if (existing) {
      return res.status(409).json({ error: 'Questionario ja enviado.' });
    }
    const payload = req.body || {};
    const saved = await prisma.questionnaireResponse.create({
      data: {
        data: payload,
        userId: req.user.id
      }
    });
    res.status(201).json({ id: saved.id });
  } catch (e) {
    console.error('[feedback] erro ao salvar', e);
    res.status(500).json({ error: 'Erro ao salvar feedback.' });
  }
});

export default router;

