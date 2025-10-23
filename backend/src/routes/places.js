import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';

import favoritesRouter from './favorites.js';
import reviewsRouter from './reviews.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');
const PLACE_UPLOAD_DIR = path.join(UPLOADS_ROOT, 'places');
const DATA_URL_REGEX = /^data:(?<mime>[^;]+);base64,(?<data>.+)$/i;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
]);
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

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

function mimeToExtension(mime) {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/gif':
      return 'gif';
    case 'image/webp':
      return 'webp';
    default:
      return null;
  }
}

async function ensurePlaceUploadDir() {
  await fs.mkdir(PLACE_UPLOAD_DIR, { recursive: true });
}

async function savePhotoFromPayload(item) {
  if (!item) {
    throw new Error('missing_photo');
  }
  let dataUrl = null;

  if (typeof item === 'string') {
    dataUrl = item;
  } else if (typeof item === 'object') {
    dataUrl = item.dataUrl || item.base64 || item.url || null;
  }

  if (!dataUrl) {
    throw new Error('missing_photo_data');
  }

  const match = DATA_URL_REGEX.exec(dataUrl);
  if (!match || !match.groups) {
    throw new Error('invalid_data_url');
  }

  const { mime, data } = match.groups;
  const normalizedMime = mime?.toLowerCase();

  if (!normalizedMime || !ALLOWED_MIME_TYPES.has(normalizedMime)) {
    throw new Error('unsupported_mime');
  }

  const buffer = Buffer.from((data || '').replace(/\s/g, ''), 'base64');
  if (!buffer.length) {
    throw new Error('empty_photo');
  }
  if (buffer.length > MAX_PHOTO_BYTES) {
    throw new Error('photo_too_large');
  }

  await ensurePlaceUploadDir();

  const extension = mimeToExtension(normalizedMime) || 'bin';
  const filename = `${Date.now()}-${randomUUID()}.${extension}`;
  const filePath = path.join(PLACE_UPLOAD_DIR, filename);
  await fs.writeFile(filePath, buffer);
  return `/uploads/places/${filename}`;
}

async function buildPhotoData(photoItems = []) {
  const limited = photoItems.filter(Boolean).slice(0, MAX_PHOTOS);
  const result = [];

  for (const item of limited) {
    const url = await savePhotoFromPayload(item);
    result.push({ url });
  }

  return result;
}

function average(values = []) {
  if (!values.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(2));
}

function digitsOnly(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\D/g, '');
}

function normalizeCep(value) {
  const digits = digitsOnly(value).slice(0, 8);
  return digits.length === 8 ? digits : null;
}

function formatCep(value) {
  const digits = normalizeCep(value);
  if (!digits) return null;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function buildFullAddress({ street, number, complement, neighborhood, city, state, cep }) {
  const parts = [];
  const streetLine = street ? (number ? `${street}, ${number}` : street) : '';
  if (streetLine) parts.push(streetLine);
  if (complement) parts.push(complement);
  if (neighborhood) parts.push(neighborhood);
  const cityState = [city, state].filter(Boolean).join(' - ');
  if (cityState) parts.push(cityState);
  if (cep) {
    const formatted = formatCep(cep);
    if (formatted) parts.push(`CEP ${formatted}`);
  }
  return parts.join(' | ');
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
    cep: place.cep,
    formattedCep: place.cep ? formatCep(place.cep) : null,
    street: place.street,
    number: place.number,
    complement: place.complement,
    neighborhood: place.neighborhood,
    city: place.city,
    state: place.state,
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

router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      nome,
      tipo,
      endereco,
      cep,
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,
      estado,
      lat,
      lng,
      descricao,
      telefone,
      site,
      features: rawFeatures,
      fotos: rawPhotos
    } = req.body || {};

    const name = typeof nome === 'string' ? nome.trim() : '';
    const type = typeof tipo === 'string' ? tipo.trim() : '';
    const streetValue = typeof logradouro === 'string' ? logradouro.trim() : '';
    const numberValue = typeof numero === 'string' ? numero.trim() : '';
    const complementValue = typeof complemento === 'string' ? complemento.trim() : '';
    const neighborhoodValue = typeof bairro === 'string' ? bairro.trim() : '';
    const cityValue = typeof cidade === 'string' ? cidade.trim() : '';
    const stateValue = typeof estado === 'string' ? estado.trim().toUpperCase() : '';
    const cepDigits = normalizeCep(cep);
    const description = typeof descricao === 'string' ? descricao.trim() : '';
    const providedAddress = typeof endereco === 'string' ? endereco.trim() : '';
    const combinedAddress = providedAddress || buildFullAddress({
      street: streetValue,
      number: numberValue,
      complement: complementValue,
      neighborhood: neighborhoodValue,
      city: cityValue,
      state: stateValue,
      cep: cepDigits
    });

    if (!name || !type || !description) {
      return res.status(400).json({ error: 'Nome, tipo e descricao sao obrigatorios.' });
    }
    if (!streetValue || !numberValue || !neighborhoodValue || !cityValue || !stateValue || !cepDigits) {
      return res.status(400).json({
        error: 'CEP, logradouro, numero, bairro, cidade e estado sao obrigatorios.'
      });
    }
    if (stateValue.length !== 2) {
      return res.status(400).json({ error: 'Informe a sigla do estado com 2 caracteres.' });
    }
    if (!combinedAddress) {
      return res.status(400).json({ error: 'Nao foi possivel determinar o endereco do local.' });
    }

    const featureKeys = parseFeatureKeys(rawFeatures);
    const photoItems = Array.isArray(rawPhotos) ? rawPhotos : [];

    if (!photoItems.length) {
      return res.status(400).json({ error: 'Informe ao menos uma foto do local.' });
    }

    let photoData;
    try {
      photoData = await buildPhotoData(photoItems);
    } catch (error) {
      console.error('[places] erro ao processar fotos', error);
      return res.status(400).json({
        error: 'Falha ao processar as fotos. Envie imagens JPG, PNG, GIF ou WEBP de ate 5MB.'
      });
    }

    if (!photoData.length) {
      return res.status(400).json({ error: 'Nao foi possivel salvar as fotos do local.' });
    }

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

    const data = {
      name,
      type,
      address: combinedAddress,
      description,
      cep: cepDigits,
      street: streetValue,
      number: numberValue,
      complement: complementValue || null,
      neighborhood: neighborhoodValue,
      city: cityValue,
      state: stateValue,
      phone: typeof telefone === 'string' && telefone.trim() ? telefone.trim() : null,
      website: typeof site === 'string' && site.trim() ? site.trim() : null,
      lat: toFloat(lat),
      lng: toFloat(lng),
      accessibilityFlags,
      ownerId: req.user.id
    };

    if (featureData.length) {
      data.features = { create: featureData };
    }
    data.photos = { create: photoData };

    const place = await prisma.place.create({
      data,
      include: {
        features: { include: { feature: true } },
        photos: true,
        reviews: true,
        favorites: { where: { userId: req.user.id }, select: { userId: true } },
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
    const {
      search,
      tipo,
      features: rawFeatures,
      limit: rawLimit,
      cep,
      bairro,
      cidade,
      estado,
      logradouro,
      numero,
      complemento
    } = req.query;
    const featureKeys = parseFeatureKeys(rawFeatures);

    let take = Number(rawLimit);
    if (!Number.isFinite(take) || take <= 0) take = 50;
    take = Math.min(Math.max(Math.trunc(take), 1), 50);

    const filters = [];

    if (typeof search === 'string' && search.trim()) {
      const term = search.trim();
      const orFilters = [
        { name: { contains: term, mode: 'insensitive' } },
        { address: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { street: { contains: term, mode: 'insensitive' } },
        { neighborhood: { contains: term, mode: 'insensitive' } },
        { city: { contains: term, mode: 'insensitive' } },
        { state: { contains: term, mode: 'insensitive' } }
      ];
      const searchCep = digitsOnly(term).slice(0, 8);
      if (searchCep) {
        orFilters.push({ cep: { contains: searchCep } });
      }
      filters.push({ OR: orFilters });
    }
    if (typeof tipo === 'string' && tipo.trim()) {
      filters.push({ type: tipo.trim() });
    }
    if (featureKeys.length) {
      filters.push({
        features: {
          some: {
            feature: {
              key: { in: featureKeys }
            }
          }
        }
      });
    }
    if (cep) {
      const cepDigits = digitsOnly(cep).slice(0, 8);
      if (cepDigits) {
        filters.push({ cep: { contains: cepDigits } });
      }
    }
    if (typeof bairro === 'string' && bairro.trim()) {
      filters.push({ neighborhood: { contains: bairro.trim(), mode: 'insensitive' } });
    }
    if (typeof cidade === 'string' && cidade.trim()) {
      filters.push({ city: { contains: cidade.trim(), mode: 'insensitive' } });
    }
    if (typeof estado === 'string' && estado.trim()) {
      filters.push({ state: { equals: estado.trim().toUpperCase() } });
    }
    if (typeof logradouro === 'string' && logradouro.trim()) {
      filters.push({ street: { contains: logradouro.trim(), mode: 'insensitive' } });
    }
    if (typeof numero === 'string' && numero.trim()) {
      filters.push({ number: { contains: numero.trim(), mode: 'insensitive' } });
    }
    if (typeof complemento === 'string' && complemento.trim()) {
      filters.push({ complement: { contains: complemento.trim(), mode: 'insensitive' } });
    }

    const where = filters.length ? { AND: filters } : undefined;

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




