import express from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });

function parsePlaceId(req, res) {
  const placeId = Number(req.params.id);
  if (!Number.isFinite(placeId)) {
    res.status(400).json({ error: 'Identificador invalido.' });
    return null;
  }
  return placeId;
}

router.get('/', optionalAuth, async (req, res) => {
  const placeId = parsePlaceId(req, res);
  if (!placeId) return;

  try {
    const reviews = await prisma.review.findMany({
      where: { placeId },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, surname: true, email: true } } }
    });
    res.json(reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      user: review.user
    })));
  } catch (err) {
    console.error('[reviews] erro ao listar', err);
    res.status(500).json({ error: 'Erro ao listar avaliacoes.' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const placeId = parsePlaceId(req, res);
  if (!placeId) return;

  try {
    const place = await prisma.place.findUnique({ where: { id: placeId }, select: { id: true } });
    if (!place) {
      return res.status(404).json({ error: 'Local nao encontrado.' });
    }

    const { rating, comment } = req.body || {};
    const parsedRating = Number(rating);
    if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ error: 'Nota deve ser um numero entre 1 e 5.' });
    }

    const review = await prisma.review.create({
      data: {
        rating: Math.trunc(parsedRating),
        comment: comment?.trim() || null,
        placeId,
        userId: req.user.id
      },
      include: {
        user: { select: { id: true, name: true, surname: true, email: true } }
      }
    });

    res.status(201).json({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      user: review.user
    });
  } catch (err) {
    console.error('[reviews] erro ao criar', err);
    res.status(500).json({ error: 'Erro ao registrar avaliacao.' });
  }
});

export default router;

