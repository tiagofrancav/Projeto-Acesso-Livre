import express from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { parsePlaceId } from '../lib/params.js';

const router = express.Router({ mergeParams: true });

router.post('/', requireAuth, async (req, res) => {
  const placeId = parsePlaceId(req, res);
  if (!placeId) return;

  try {
    const place = await prisma.place.findUnique({
      where: { id: placeId },
      select: { id: true }
    });
    if (!place) {
      return res.status(404).json({ error: 'Local não encontrado.' });
    }

    await prisma.favorite.upsert({
      where: { userId_placeId: { userId: req.user.id, placeId } },
      update: {},
      create: { userId: req.user.id, placeId }
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('[favorites] erro ao favoritar', err);
    res.status(500).json({ error: 'Erro ao favoritar local.' });
  }
});

router.delete('/', requireAuth, async (req, res) => {
  const placeId = parsePlaceId(req, res);
  if (!placeId) return;

  try {
    await prisma.favorite
      .delete({
        where: { userId_placeId: { userId: req.user.id, placeId } }
      })
      .catch(() => null);

    res.status(204).send();
  } catch (err) {
    console.error('[favorites] erro ao desfavoritar', err);
    res.status(500).json({ error: 'Erro ao desfavoritar local.' });
  }
});

export default router;
