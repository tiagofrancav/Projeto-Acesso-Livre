import express from 'express';
import { prisma } from '../lib/prisma.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const payload = req.body || {};
    const saved = await prisma.questionnaireResponse.create({ data: { data: payload } });
    res.status(201).json({ id: saved.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao salvar feedback.' });
  }
});

export default router;

