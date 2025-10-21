import express from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

function average(values = []) {
  if (!values.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(2));
}

function mapFeature(placeFeature) {
  if (!placeFeature?.feature) return null;
  const { feature } = placeFeature;
  return { key: feature.key, label: feature.label };
}

function mapPhoto(photo) {
  if (!photo) return null;
  return { id: photo.id, url: photo.url };
}

function summarizePlace(place) {
  if (!place) return null;
  const ratings = (place.reviews || []).map((review) => review.rating);
  return {
    id: place.id,
    name: place.name,
    type: place.type,
    address: place.address,
    accessibilityFlags: place.accessibilityFlags || null,
    phone: place.phone,
    website: place.website,
    description: place.description,
    features: (place.features || []).map(mapFeature).filter(Boolean),
    photos: (place.photos || []).map(mapPhoto).filter(Boolean),
    stats: {
      reviewCount: place._count?.reviews || (place.reviews?.length ?? 0),
      favoriteCount: place._count?.favorites || 0,
      averageRating: average(ratings)
    }
  };
}

router.post('/', async (req, res) => {
  try {
    const { nome, sobrenome, email, senha } = req.body || {};
    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha sao obrigatorios.' });
    }
    const hash = await bcrypt.hash(senha, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        name: nome || null,
        surname: sobrenome || null
      }
    });
    res.status(201).json({ id: user.id, email: user.email, name: user.name, surname: user.surname });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Email ja cadastrado.' });
    }
    console.error('[users] erro ao cadastrar usuario', err);
    res.status(500).json({ error: 'Erro ao cadastrar usuario.' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        _count: { select: { places: true, reviews: true, favorites: true } },
        places: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            photos: true,
            features: { include: { feature: true } },
            reviews: true,
            _count: { select: { reviews: true, favorites: true } }
          }
        },
        favorites: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            place: {
              include: {
                photos: true,
                features: { include: { feature: true } },
                reviews: true,
                _count: { select: { reviews: true, favorites: true } }
              }
            }
          }
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            place: {
              include: {
                photos: true,
                features: { include: { feature: true } },
                reviews: true,
                _count: { select: { reviews: true, favorites: true } }
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario nao encontrado.' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      surname: user.surname,
      createdAt: user.createdAt,
      stats: {
        places: user._count?.places || 0,
        reviews: user._count?.reviews || 0,
        favorites: user._count?.favorites || 0
      },
      places: (user.places || []).map(summarizePlace).filter(Boolean),
      favorites: (user.favorites || []).map((favorite) => ({
        id: `${favorite.userId}-${favorite.placeId}`,
        addedAt: favorite.createdAt,
        place: summarizePlace(favorite.place)
      })).filter((fav) => fav.place),
      reviews: (user.reviews || []).map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        place: summarizePlace(review.place)
      })).filter((review) => review.place)
    });
  } catch (err) {
    console.error('[users] erro ao carregar perfil', err);
    res.status(500).json({ error: 'Erro ao carregar dados do perfil.' });
  }
});

export default router;


