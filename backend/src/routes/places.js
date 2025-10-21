import express from 'express';
import { prisma } from '../lib/prisma.js';
import { optionalAuth } from '../middleware/auth.js';

import favoritesRouter from './favorites.js';
import reviewsRouter from './reviews.js';

const router = express.Router();

const FEATURE_LABELS = {
  ramp_access: 'Rampa de acesso',
  elevator: 'Elevador',
  accessible_bathroom: 'Banheiro adaptado',
  reserved_parking: 'Vagas especiais',
  tactile_floor: 'Piso tatil',
  braille_signage: 'Sinalizacao em braile',
  audio_description: 'Audio descricao',
  libras_staff: 'Funcionarios treinados em Libras',
  subtitles: 'Legendas / Closed Caption',
  visual_signage: 'Sinalizacao visual',
  priority_service: 'Atendimento prioritario',
  wheelchair_available: 'Cadeira de rodas disponivel',
  accessible_parking: 'Estacionamento acessivel'
};
const FEATURE_KEYS = Object.keys(FEATURE_LABELS);

function average(values = []) {
  if (!values.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(2));
}

function toFloat(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseFeatureKeys(raw = []) {
  if (!raw) return [];
  const values = Array.isArray(raw) ? raw : [raw];
  const keys = values
    .flatMap((item) => (typeof item === 'string' ? item.split(',') : []))
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(keys));
}

function mapFeature(featureRelation) {
  if (!featureRelation?.feature) return null;
  const { feature } = featureRelation;
  return { key: feature.key, label: feature.label };
}

function mapPhoto(photo) {
  if (!photo) return null;
  return { id: photo.id, url: photo.url };
}

function basePlaceResponse(place, currentUserId) {
  const ratings = (place.reviews || []).map((review) => review.rating);
  const photos = (place.photos || []).map(mapPhoto).filter(Boolean);
  const features = (place.features || []).map(mapFeature).filter(Boolean);
  const isFavorite = currentUserId
    ? Boolean(place.favorites?.some((fav) => fav.userId === currentUserId))
    : false;

  return {
    id: place.id,
    name: place.name,
    type: place.type,
    address: place.address,
    accessibilityFlags: place.accessibilityFlags || null,
    phone: place.phone,
    website: place.website,
    description: place.description,
    lat: place.lat,
    lng: place.lng,
    createdAt: place.createdAt,
    features,
    photos,
    stats: {
      reviewCount: place._count?.reviews || (place.reviews?.length ?? 0),
      favoriteCount: place._count?.favorites || 0,
      averageRating: average(ratings)
    },
    isFavorite
  };
}

function detailPlaceResponse(place, currentUserId) {
  const base = basePlaceResponse(place, currentUserId);
  return {
    ...base,
    reviews: (place.reviews || []).map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      user: review.user
        ? {
            id: review.user.id,
            name: review.user.name,
            surname: review.user.surname,
            email: review.user.email
          }
        : null
    }))
  };
}

router.post('/', optionalAuth, async (req, res) => {
  try {
    const {
      nome,
      tipo,
      endereco,
      lat,
      lng,
      descricao,
      telefone,
      site,
      features: rawFeatures,
      fotos: rawPhotos
    } = req.body || {};

    if (!nome || !tipo || !endereco) {
      return res.status(400).json({ error: 'Nome, tipo e endereco sao obrigatorios.' });
    }

    const featureKeys = parseFeatureKeys(rawFeatures);
    const photoItems = Array.isArray(rawPhotos) ? rawPhotos : [];

    const featureData = featureKeys.map((key) => ({
      feature: {
        connectOrCreate: {
          where: { key },
          create: { key, label: FEATURE_LABELS[key] || key }
        }
      }
    }));

    const accessibilityFlags = FEATURE_KEYS.reduce((acc, key) => {
      acc[key] = featureKeys.includes(key);
      return acc;
    }, {});

    const photoData = photoItems
      .map((item) => {
        if (!item) return null;
        if (typeof item === 'string') return { url: item };
        const url = item.url || item.dataUrl || item.base64;
        return url ? { url } : null;
      })
      .filter(Boolean);

    const data = {
      name: nome,
      type: tipo,
      address: endereco,
      description: descricao ?? null,
      phone: telefone ?? null,
      website: site ?? null,
      lat: toFloat(lat),
      lng: toFloat(lng),
      accessibilityFlags,
      ownerId: req.user?.id ?? null
    };

    if (featureData.length) {
      data.features = { create: featureData };
    }
    if (photoData.length) {
      data.photos = { create: photoData };
    }

    const place = await prisma.place.create({
      data,
      include: {
        features: { include: { feature: true } },
        photos: true,
        reviews: true,
        favorites: req.user?.id
          ? { where: { userId: req.user.id }, select: { userId: true } }
          : undefined,
        _count: { select: { reviews: true, favorites: true } }
      }
    });

    res.status(201).json(basePlaceResponse(place, req.user?.id));
  } catch (err) {
    console.error('[places] erro ao cadastrar local', err);
    res.status(500).json({ error: 'Erro ao cadastrar local.' });
  }
});

router.get('/', optionalAuth, async (req, res) => {
  try {
    const { search, tipo, features: rawFeatures, limit: rawLimit } = req.query;
    const featureKeys = parseFeatureKeys(rawFeatures);

    let take = Number(rawLimit);
    if (!Number.isFinite(take) || take <= 0) take = 50;
    take = Math.min(Math.max(Math.trunc(take), 1), 50);

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (tipo) {
      where.type = tipo;
    }
    if (featureKeys.length) {
      where.features = {
        some: {
          feature: {
            key: { in: featureKeys }
          }
        }
      };
    }

    const places = await prisma.place.findMany({
      where,
      include: {
        features: { include: { feature: true } },
        photos: true,
        reviews: { select: { rating: true } },
        favorites: req.user?.id
          ? { where: { userId: req.user.id }, select: { userId: true } }
          : undefined,
        _count: { select: { reviews: true, favorites: true } }
      },
      orderBy: { createdAt: 'desc' },
      take
    });

    const currentUserId = req.user?.id;
    res.json(places.map((place) => basePlaceResponse(place, currentUserId)));
  } catch (err) {
    console.error('[places] erro ao listar locais', err);
    res.status(500).json({ error: 'Erro ao listar locais.' });
  }
});

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Identificador invalido.' });
    }

    const place = await prisma.place.findUnique({
      where: { id },
      include: {
        features: { include: { feature: true } },
        photos: true,
        reviews: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, name: true, surname: true, email: true } }
          }
        },
        favorites: req.user?.id
          ? { where: { userId: req.user.id }, select: { userId: true } }
          : undefined,
        _count: { select: { reviews: true, favorites: true } }
      }
    });

    if (!place) {
      return res.status(404).json({ error: 'Local nao encontrado.' });
    }

    res.json(detailPlaceResponse(place, req.user?.id));
  } catch (err) {
    console.error('[places] erro ao carregar local', err);
    res.status(500).json({ error: 'Erro ao carregar dados do local.' });
  }
});

router.use('/:id/favorites', favoritesRouter);
router.use('/:id/reviews', reviewsRouter);

export default router;




