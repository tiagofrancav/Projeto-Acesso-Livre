import express from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { average, mapFeature, mapPhoto, formatCep } from '../lib/place-utils.js';

const router = express.Router();

function summarizePlace(place) {
  if (!place) return null;
  const ratings = (place.reviews || []).map((review) => review.rating);
  return {
    id: place.id,
    name: place.name,
    type: place.type,
    address: place.address,
    cep: place.cep,
    formattedCep: formatCep(place.cep),
    street: place.street,
    number: place.number,
    complement: place.complement,
    neighborhood: place.neighborhood,
    city: place.city,
    state: place.state,
    lat: place.lat,
    lng: place.lng,
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
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }
    const hash = await bcrypt.hash(String(senha), 10);
    const user = await prisma.user.create({
      data: {
        email: String(email).trim().toLowerCase(),
        passwordHash: hash,
        name: nome || null,
        surname: sobrenome || null
      }
    });
    res
      .status(201)
      .json({ id: user.id, email: user.email, name: user.name, surname: user.surname });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'E-mail já cadastrado.' });
    }
    console.error('[users] erro ao cadastrar usuário', err);
    res.status(500).json({ error: 'Erro ao cadastrar usuário.' });
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
      return res.status(404).json({ error: 'Usuário não encontrado.' });
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
      favorites: (user.favorites || [])
        .map((favorite) => ({
          id: `${favorite.userId}-${favorite.placeId}`,
          addedAt: favorite.createdAt,
          place: summarizePlace(favorite.place)
        }))
        .filter((fav) => fav.place),
      reviews: (user.reviews || [])
        .map((review) => ({
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt,
          place: summarizePlace(review.place)
        }))
        .filter((review) => review.place)
    });
  } catch (err) {
    console.error('[users] erro ao carregar perfil', err);
    res.status(500).json({ error: 'Erro ao carregar dados do perfil.' });
  }
});

export default router;
